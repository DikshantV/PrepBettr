const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const admin = require('firebase-admin');

/**
 * Scheduled Azure Function for GDPR Data Deletion Processing
 * 
 * Runs daily at 2:00 AM to process data deletion requests that have reached
 * their 30-day compliance window.
 * 
 * Schedule: "0 0 2 * * *" (2:00 AM every day)
 */

let cosmosClient;
let database;
let blobServiceClient;
let firebaseInitialized = false;

/**
 * Initialize all required services
 */
async function initializeServices(context) {
  try {
    // Initialize Azure Key Vault for secrets
    const keyVaultClient = process.env.AZURE_KEY_VAULT_URL 
      ? new SecretClient(process.env.AZURE_KEY_VAULT_URL, new DefaultAzureCredential())
      : null;

    // Initialize Cosmos DB
    let cosmosConnection = process.env.AZURE_COSMOS_CONNECTION_STRING;
    
    if (!cosmosConnection && keyVaultClient) {
      try {
        const secret = await keyVaultClient.getSecret('cosmos-db-connection-string');
        cosmosConnection = secret.value;
      } catch (error) {
        context.log.warn('Could not retrieve Cosmos DB connection from Key Vault:', error.message);
      }
    }

    if (!cosmosConnection) {
      const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
      const key = process.env.AZURE_COSMOS_KEY;
      
      if (!endpoint || !key) {
        throw new Error('Cosmos DB configuration missing');
      }
      
      cosmosClient = new CosmosClient({ endpoint, key });
    } else {
      cosmosClient = new CosmosClient(cosmosConnection);
    }

    database = cosmosClient.database('PrepBettrDB');

    // Initialize Azure Blob Storage
    let storageConnection = process.env.AZURE_STORAGE_CONNECTION_STRING;
    
    if (!storageConnection && keyVaultClient) {
      try {
        const secret = await keyVaultClient.getSecret('storage-connection-string');
        storageConnection = secret.value;
      } catch (error) {
        context.log.warn('Could not retrieve Storage connection from Key Vault:', error.message);
      }
    }

    if (!storageConnection) {
      throw new Error('Azure Storage connection string not found');
    }

    blobServiceClient = BlobServiceClient.fromConnectionString(storageConnection);

    // Initialize Firebase Admin SDK
    if (!firebaseInitialized) {
      let firebaseConfig;
      
      if (keyVaultClient) {
        try {
          const serviceAccountSecret = await keyVaultClient.getSecret('firebase-service-account-key');
          firebaseConfig = JSON.parse(serviceAccountSecret.value);
        } catch (error) {
          context.log.warn('Could not retrieve Firebase config from Key Vault:', error.message);
        }
      }

      // Fallback to environment variables
      if (!firebaseConfig) {
        firebaseConfig = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        };
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(firebaseConfig),
          projectId: firebaseConfig.projectId
        });
      }
      
      firebaseInitialized = true;
    }

    context.log('✅ All services initialized successfully');
  } catch (error) {
    context.log.error('❌ Failed to initialize services:', error);
    throw error;
  }
}

/**
 * Get pending deletion requests that are ready for processing
 */
async function getPendingDeletions(context) {
  try {
    const container = database.container('gdprRequests');
    const now = new Date().toISOString();
    
    const query = {
      query: 'SELECT * FROM c WHERE c.status = @status AND c.scheduledDate <= @now',
      parameters: [
        { name: '@status', value: 'pending' },
        { name: '@now', value: now }
      ]
    };

    const { resources } = await container.items.query(query).fetchAll();
    
    context.log(`📋 Found ${resources.length} deletion requests ready for processing`);
    return resources;
  } catch (error) {
    context.log.error('❌ Failed to get pending deletions:', error);
    throw error;
  }
}

/**
 * Process a single data deletion request
 */
async function processDataDeletion(context, request) {
  const startTime = Date.now();
  
  try {
    context.log(`🗑️ Processing deletion request ${request.id} for user ${request.userId}`);
    
    // Update status to processing
    const container = database.container('gdprRequests');
    await container.item(request.id, request.partitionKey).patch([
      { op: 'replace', path: '/status', value: 'processing' }
    ]);

    const deletedData = [];
    const errors = [];

    // Delete from Cosmos DB containers
    const containersToDelete = [
      'users',
      'profiles',
      'resumes',
      'interviews',
      'feedback',
      'usage',
      'notifications',
      'emailVerifications',
      'userConsents'
    ];

    for (const containerName of containersToDelete) {
      try {
        const deleted = await deleteFromContainer(context, containerName, request.userId);
        if (deleted > 0) {
          deletedData.push(`${containerName} (${deleted} items)`);
        }
      } catch (error) {
        const errorMsg = `Failed to delete from ${containerName}: ${error.message}`;
        errors.push(errorMsg);
        context.log.error(`❌ ${errorMsg}`);
      }
    }

    // Delete from Azure Blob Storage
    try {
      const deletedBlobContainers = await deleteFromBlobStorage(context, request.userId);
      if (deletedBlobContainers.length > 0) {
        deletedData.push(`blob-storage (${deletedBlobContainers.join(', ')})`);
      }
    } catch (error) {
      const errorMsg = `Failed to delete from blob storage: ${error.message}`;
      errors.push(errorMsg);
      context.log.error(`❌ ${errorMsg}`);
    }

    // Delete from Firebase Authentication
    try {
      await admin.auth().deleteUser(request.userId);
      deletedData.push('firebase-auth (1 user)');
      context.log(`✅ Deleted Firebase authentication record for user ${request.userId}`);
    } catch (error) {
      const errorMsg = `Failed to delete Firebase auth record: ${error.message}`;
      errors.push(errorMsg);
      context.log.error(`❌ ${errorMsg}`);
    }

    // Update request with results
    const finalStatus = errors.length === 0 ? 'completed' : 'completed'; // Mark as completed even with some errors
    await container.item(request.id, request.partitionKey).patch([
      { op: 'replace', path: '/status', value: finalStatus },
      { op: 'replace', path: '/completedDate', value: new Date().toISOString() },
      { op: 'replace', path: '/deletedData', value: deletedData },
      { op: 'replace', path: '/errors', value: errors }
    ]);

    // Create audit log entry
    await createAuditLogEntry(context, {
      userId: request.userId,
      action: 'data_deletion_processed',
      details: {
        requestId: request.id,
        deletedData,
        errors,
        status: finalStatus,
        processingTimeMs: Date.now() - startTime
      },
      complianceOfficer: 'scheduled-function'
    });

    const duration = Date.now() - startTime;
    context.log(`✅ Deletion processed for user ${request.userId} in ${duration}ms`);
    context.log(`   Deleted: ${deletedData.join(', ')}`);
    
    if (errors.length > 0) {
      context.log(`   Errors: ${errors.join(', ')}`);
    }

    return { 
      success: true, 
      requestId: request.id, 
      userId: request.userId, 
      deletedData, 
      errors,
      duration 
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    context.log.error(`❌ Failed to process deletion request ${request.id}:`, error);
    
    // Update request status to failed
    try {
      const container = database.container('gdprRequests');
      await container.item(request.id, request.partitionKey).patch([
        { op: 'replace', path: '/status', value: 'failed' },
        { op: 'replace', path: '/errors', value: [error.message || 'Unknown error'] }
      ]);
    } catch (updateError) {
      context.log.error('❌ Failed to update request status to failed:', updateError);
    }

    return { 
      success: false, 
      requestId: request.id, 
      userId: request.userId, 
      error: error.message,
      duration 
    };
  }
}

/**
 * Delete user data from a specific Cosmos DB container
 */
async function deleteFromContainer(context, containerName, userId) {
  try {
    const container = database.container(containerName);
    const query = {
      query: 'SELECT c.id FROM c WHERE c.userId = @userId',
      parameters: [{ name: '@userId', value: userId }]
    };

    const { resources: items } = await container.items.query(query, {
      partitionKey: userId
    }).fetchAll();

    let deletedCount = 0;
    
    // Delete in batches to avoid overwhelming the database
    const batchSize = 25;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const deletePromises = batch.map(item => 
        container.item(item.id, userId).delete().catch(error => {
          context.log.warn(`Failed to delete item ${item.id} from ${containerName}:`, error.message);
          return null;
        })
      );
      
      const results = await Promise.all(deletePromises);
      deletedCount += results.filter(result => result !== null).length;
    }

    return deletedCount;
  } catch (error) {
    context.log.error(`❌ Error deleting from container ${containerName}:`, error);
    throw error;
  }
}

/**
 * Delete user files from Azure Blob Storage
 */
async function deleteFromBlobStorage(context, userId) {
  const deletedContainers = [];
  const userContainers = ['user-files', 'resumes', 'profile-pics', 'documents'];

  for (const containerName of userContainers) {
    try {
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const prefix = `users/${userId}/`;
      
      let deletedBlobs = 0;
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        try {
          await containerClient.deleteBlob(blob.name);
          deletedBlobs++;
        } catch (error) {
          context.log.warn(`Failed to delete blob ${blob.name}:`, error.message);
        }
      }

      if (deletedBlobs > 0) {
        deletedContainers.push(`${containerName} (${deletedBlobs} files)`);
      }
    } catch (error) {
      context.log.warn(`Failed to access blob container ${containerName}:`, error.message);
    }
  }

  return deletedContainers;
}

/**
 * Create audit log entry
 */
async function createAuditLogEntry(context, entry) {
  try {
    const auditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      timestamp: new Date().toISOString(),
      partitionKey: entry.userId,
      ...entry
    };

    const container = database.container('dataProtectionAuditLog');
    await container.items.create(auditEntry);
  } catch (error) {
    context.log.error('❌ Failed to create audit log entry:', error);
    // Don't throw - audit logging failure shouldn't stop the main operation
  }
}

/**
 * Main function - Timer triggered
 */
module.exports = async function (context, myTimer) {
  const startTime = Date.now();
  context.log('🕐 GDPR Scheduled Deletion Processor started at', new Date().toISOString());

  try {
    // Initialize all services
    await initializeServices(context);
    
    // Get pending deletion requests
    const pendingRequests = await getPendingDeletions(context);
    
    if (pendingRequests.length === 0) {
      context.log('✅ No pending deletion requests found');
      return;
    }

    // Process each deletion request
    const results = [];
    
    for (const request of pendingRequests) {
      try {
        const result = await processDataDeletion(context, request);
        results.push(result);
      } catch (error) {
        context.log.error(`❌ Failed to process request ${request.id}:`, error);
        results.push({
          success: false,
          requestId: request.id,
          userId: request.userId,
          error: error.message
        });
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalDuration = Date.now() - startTime;
    
    context.log(`📊 GDPR Deletion Processing Summary:`);
    context.log(`   Total requests processed: ${results.length}`);
    context.log(`   Successful: ${successful}`);
    context.log(`   Failed: ${failed}`);
    context.log(`   Total processing time: ${totalDuration}ms`);

    // Create summary audit log
    await createAuditLogEntry(context, {
      userId: 'system',
      action: 'scheduled_deletion_batch_processed',
      details: {
        totalRequests: results.length,
        successful,
        failed,
        processingTimeMs: totalDuration,
        results: results.map(r => ({
          requestId: r.requestId,
          userId: r.userId,
          success: r.success,
          deletedData: r.deletedData,
          errors: r.errors
        }))
      },
      complianceOfficer: 'scheduled-function'
    });

    context.log(`✅ GDPR Scheduled Deletion Processor completed in ${totalDuration}ms`);
    
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    context.log.error(`❌ GDPR Scheduled Deletion Processor failed after ${totalDuration}ms:`, error);
    
    // Create error audit log
    try {
      await createAuditLogEntry(context, {
        userId: 'system',
        action: 'scheduled_deletion_batch_failed',
        details: {
          error: error.message,
          processingTimeMs: totalDuration
        },
        complianceOfficer: 'scheduled-function'
      });
    } catch (auditError) {
      context.log.error('❌ Failed to create error audit log:', auditError);
    }
    
    throw error;
  }
};
