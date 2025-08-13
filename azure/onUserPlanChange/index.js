const { CosmosClient } = require('@azure/cosmos');

// Initialize Cosmos client
let cosmosClient;

function getCosmosClient() {
  if (!cosmosClient) {
    const connectionString = process.env.AZURE_COSMOS_DB_CONNECTION_STRING;
    cosmosClient = new CosmosClient(connectionString);
  }
  return cosmosClient;
}

// Plan limits configuration
const PLAN_LIMITS = {
  free: {
    interviews: { count: 0, limit: 3 },
    resumeTailor: { count: 0, limit: 2 },
    autoApply: { count: 0, limit: 1 }
  },
  premium: {
    interviews: { count: 0, limit: -1 },
    resumeTailor: { count: 0, limit: -1 },
    autoApply: { count: 0, limit: -1 }
  },
  pro: {
    interviews: { count: 0, limit: -1 },
    resumeTailor: { count: 0, limit: -1 },
    autoApply: { count: 0, limit: -1 }
  }
};

module.exports = async function (context, documents) {
  const startTime = Date.now();
  
  if (!documents || documents.length === 0) {
    context.log('No documents to process');
    return;
  }

  const client = getCosmosClient();
  const database = client.database('PrepBettrDB');
  const usageContainer = database.container('usage');
  
  const processedUsers = [];

  try {
    for (const document of documents) {
      // Check if this is a plan change by looking at the operation type and changes
      const userId = document.id;
      
      // Azure Cosmos DB doesn't provide "before/after" like Firestore
      // We need to detect plan changes differently
      if (document.plan && userId) {
        const newPlan = document.plan;
        
        // Get current usage data to check if plan actually changed
        try {
          const { resource: currentUsage } = await usageContainer.item(userId, userId).read();
          
          // If user doesn't have usage record or plan is different, reset usage
          if (!currentUsage || !currentUsage.plan || currentUsage.plan !== newPlan) {
            const newPlanLimits = PLAN_LIMITS[newPlan] || PLAN_LIMITS.free;
            const timestamp = new Date().toISOString();
            
            const usageDocument = {
              id: userId,
              userId: userId,
              plan: newPlan,
              previousPlan: currentUsage?.plan || 'free',
              ...newPlanLimits,
              lastReset: timestamp,
              updatedAt: timestamp,
              createdAt: currentUsage?.createdAt || timestamp
            };
            
            // Upsert the usage document
            await usageContainer.items.upsert(usageDocument);
            
            processedUsers.push({
              userId,
              oldPlan: currentUsage?.plan || 'free',
              newPlan,
              resetAt: timestamp
            });
            
            context.log(`Usage counters reset for user: ${userId}, plan changed from ${currentUsage?.plan || 'free'} to ${newPlan}`);
          }
        } catch (usageError) {
          // If usage document doesn't exist, create it
          if (usageError.code === 404) {
            const newPlanLimits = PLAN_LIMITS[newPlan] || PLAN_LIMITS.free;
            const timestamp = new Date().toISOString();
            
            const usageDocument = {
              id: userId,
              userId: userId,
              plan: newPlan,
              previousPlan: 'free',
              ...newPlanLimits,
              lastReset: timestamp,
              updatedAt: timestamp,
              createdAt: timestamp
            };
            
            await usageContainer.items.create(usageDocument);
            
            processedUsers.push({
              userId,
              oldPlan: 'free',
              newPlan,
              resetAt: timestamp
            });
            
            context.log(`Initial usage counters created for user: ${userId}, plan: ${newPlan}`);
          } else {
            context.log.error(`Error processing usage for user ${userId}:`, usageError);
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    context.log(`Processed ${processedUsers.length} plan changes in ${duration}ms:`, 
      processedUsers.map(u => `${u.userId}: ${u.oldPlan} → ${u.newPlan}`).join(', '));

    // Return summary for monitoring
    return {
      processedCount: processedUsers.length,
      totalDocuments: documents.length,
      duration,
      changes: processedUsers
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    context.log.error(`Error processing plan changes (${duration}ms):`, error);
    throw error;
  }
};
