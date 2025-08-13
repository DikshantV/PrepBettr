const admin = require('firebase-admin');
const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const { createAuthenticatedFunction, authMiddleware } = require('../shared/authMiddleware');

// Initialize services
let firebaseInitialized = false;
let cosmosClient;
let blobServiceClient;

async function initializeServices() {
  if (firebaseInitialized && cosmosClient && blobServiceClient) return;

  try {
    // Get secrets from Azure Key Vault
    const credential = new DefaultAzureCredential();
    const vaultName = process.env.AZURE_KEYVAULT_NAME;
    const url = `https://${vaultName}.vault.azure.net`;
    const secretClient = new SecretClient(url, credential);

    // Initialize Firebase Admin
    if (!firebaseInitialized) {
      const serviceAccountSecret = await secretClient.getSecret('firebase-service-account-key');
      const serviceAccount = JSON.parse(serviceAccountSecret.value);

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
      }
      firebaseInitialized = true;
    }

    // Initialize Cosmos DB client
    if (!cosmosClient) {
      const connectionString = process.env.AZURE_COSMOS_DB_CONNECTION_STRING;
      cosmosClient = new CosmosClient(connectionString);
    }

    // Initialize Azure Storage client
    if (!blobServiceClient) {
      const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);
    }

    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    throw error;
  }
}

// Collections to delete from Azure Cosmos DB
const COLLECTIONS_TO_DELETE = [
  'users',
  'profiles',
  'resumes',
  'interviews',
  'feedback',
  'usage',
  'notifications',
  'emailVerifications',
  'gdprRequests'
];

// Internal function that handles the actual deletion logic
async function handleDeleteUserData(context, req, authenticatedUser) {
  const startTime = Date.now();

  // Set CORS headers
  context.res = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Functions-Key',
      'Content-Type': 'application/json'
    }
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    context.res.status = 204;
    context.res.body = '';
    return;
  }

  try {
    await initializeServices();

    const { requestId, userId, reason } = req.body || {};
    const requestingUserId = authenticatedUser.uid;
    const isAdmin = authenticatedUser.custom_claims?.roles?.includes('admin') || false;
    
    if (!userId) {
      context.res.status = 400;
      context.res.body = { 
        error: 'User ID is required',
        code: 'MISSING_USER_ID'
      };
      return;
    }

    // Verify authorization - either admin or user deleting their own data
    if (!isAdmin && requestingUserId !== userId) {
      context.res.status = 403;
      context.res.body = { 
        error: 'Users can only delete their own data. You are authenticated as: ' + requestingUserId,
        code: 'PERMISSION_DENIED'
      };
      return;
    }

    const database = cosmosClient.database('PrepBettrDB');
    const deletedCollections = [];
    const deletionErrors = [];

    // Create deletion request record
    const deletionRequestId = requestId || `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const deletionRequest = {
      id: deletionRequestId,
      userId,
      requestedBy: requestingUserId || userId,
      requestDate: new Date().toISOString(),
      reason: reason || 'User requested account deletion',
      status: 'processing',
      deletedData: [],
      errors: []
    };

    try {
      await database.container('gdprRequests').items.create(deletionRequest);
      context.log(`Created deletion request: ${deletionRequestId} for user: ${userId}`);
    } catch (error) {
      context.log.error('Failed to create deletion request record:', error);
    }

    // Delete from Azure Cosmos DB collections
    for (const containerName of COLLECTIONS_TO_DELETE) {
      try {
        const container = database.container(containerName);
        
        // Query for user documents
        const querySpec = {
          query: 'SELECT c.id FROM c WHERE c.userId = @userId',
          parameters: [{ name: '@userId', value: userId }]
        };

        const { resources: documents } = await container.items.query(querySpec).fetchAll();
        
        if (documents.length > 0) {
          // Delete documents in batches
          const batchSize = 25;
          let deletedCount = 0;
          
          for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            const deletePromises = batch.map(doc => 
              container.item(doc.id, userId).delete().catch(err => {
                context.log.warn(`Failed to delete document ${doc.id} from ${containerName}:`, err);
                return null;
              })
            );
            
            const results = await Promise.all(deletePromises);
            deletedCount += results.filter(result => result !== null).length;
          }
          
          deletedCollections.push({ collection: containerName, count: deletedCount });
          context.log(`Deleted ${deletedCount} documents from ${containerName}`);
        }
      } catch (error) {
        context.log.error(`Error deleting from ${containerName}:`, error);
        deletionErrors.push({ collection: containerName, error: error.message });
      }
    }

    // Delete from Azure Blob Storage
    try {
      const containerClient = blobServiceClient.getContainerClient('user-files');
      const prefix = `users/${userId}/`;
      
      let deletedBlobsCount = 0;
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        try {
          await containerClient.deleteBlob(blob.name);
          deletedBlobsCount++;
        } catch (error) {
          context.log.warn(`Failed to delete blob ${blob.name}:`, error);
        }
      }
      
      if (deletedBlobsCount > 0) {
        deletedCollections.push({ collection: 'azure-storage', count: deletedBlobsCount });
        context.log(`Deleted ${deletedBlobsCount} files from Azure Storage`);
      }
    } catch (error) {
      context.log.error('Error deleting from Azure Storage:', error);
      deletionErrors.push({ collection: 'azure-storage', error: error.message });
    }

    // Delete Firebase Authentication record
    try {
      await admin.auth().deleteUser(userId);
      deletedCollections.push({ collection: 'firebase-auth', count: 1 });
      context.log(`Deleted Firebase authentication record for user: ${userId}`);
    } catch (error) {
      context.log.error('Error deleting Firebase auth record:', error);
      deletionErrors.push({ collection: 'firebase-auth', error: error.message });
    }

    // Update deletion request status
    try {
      const updatedRequest = {
        ...deletionRequest,
        status: deletionErrors.length > 0 ? 'completed-with-errors' : 'completed',
        completedDate: new Date().toISOString(),
        deletedData: deletedCollections,
        errors: deletionErrors
      };

      await database.container('gdprRequests').item(deletionRequestId, userId).replace(updatedRequest);
    } catch (error) {
      context.log.error('Failed to update deletion request status:', error);
    }

    // Log audit trail
    try {
      await database.container('auditLog').items.create({
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        action: 'data_deletion_completed',
        timestamp: new Date().toISOString(),
        deletedCollections: deletedCollections.map(c => c.collection),
        errors: deletionErrors,
        requestId: deletionRequestId,
        requestedBy: requestingUserId || userId,
        duration: Date.now() - startTime
      });
    } catch (error) {
      context.log.error('Failed to create audit log:', error);
    }

    const duration = Date.now() - startTime;
    context.log(`Data deletion completed for user: ${userId} in ${duration}ms`);

    const totalDeleted = deletedCollections.reduce((sum, col) => sum + col.count, 0);
    
    context.res.status = 200;
    context.res.body = {
      success: true,
      requestId: deletionRequestId,
      userId,
      totalDeleted,
      deletedCollections,
      errors: deletionErrors,
      duration,
      status: deletionErrors.length > 0 ? 'completed-with-errors' : 'completed',
      message: `User data deletion ${deletionErrors.length > 0 ? 'completed with some errors' : 'completed successfully'}`
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    context.log.error(`Error in deleteUserData function (${duration}ms):`, error);
    
    // Try to update deletion request status to failed
    if (deletionRequestId && cosmosClient) {
      try {
        const database = cosmosClient.database('PrepBettrDB');
        await database.container('gdprRequests').item(deletionRequestId, userId).patch([
          { op: 'replace', path: '/status', value: 'failed' },
          { op: 'replace', path: '/error', value: error.message },
          { op: 'replace', path: '/failedAt', value: new Date().toISOString() }
        ]);
      } catch (updateError) {
        context.log.error('Failed to update deletion request status to failed:', updateError);
      }
    }
    
    context.res.status = 500;
    context.res.body = { 
      error: 'Failed to delete user data',
      code: 'DELETION_FAILED',
      details: error.message 
    };
  }
}

// Export authenticated function
module.exports = createAuthenticatedFunction(handleDeleteUserData);
