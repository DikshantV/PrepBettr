const { CosmosClient } = require('@azure/cosmos');
const axios = require('axios');

// Initialize Cosmos client
let cosmosClient;

function getCosmosClient() {
  if (!cosmosClient) {
    const connectionString = process.env.AZURE_COSMOS_DB_CONNECTION_STRING;
    cosmosClient = new CosmosClient(connectionString);
  }
  return cosmosClient;
}

module.exports = async function (context, myTimer) {
  const startTime = Date.now();
  const timeStamp = new Date().toISOString();

  if (myTimer.isPastDue) {
    context.log('Timer function is running late!');
  }

  context.log('Scheduled deletion process started at:', timeStamp);

  try {
    const client = getCosmosClient();
    const database = client.database('PrepBettrDB');
    const gdprContainer = database.container('gdprRequests');

    // Find deletion requests that are 30 days old and still pending
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const querySpec = {
      query: `
        SELECT c.id, c.userId, c.requestDate, c.reason, c.requestedBy 
        FROM c 
        WHERE c.status = 'pending' 
        AND c.requestDate <= @thirtyDaysAgo
        ORDER BY c.requestDate ASC
      `,
      parameters: [
        { name: '@thirtyDaysAgo', value: thirtyDaysAgo.toISOString() }
      ]
    };

    const { resources: pendingRequests } = await gdprContainer.items.query(querySpec).fetchAll();

    context.log(`Found ${pendingRequests.length} deletion requests to process`);

    if (pendingRequests.length === 0) {
      context.log('No pending deletion requests to process');
      return {
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        duration: Date.now() - startTime
      };
    }

    const results = {
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      processed: [],
      failed: []
    };

    // Get the function key for calling the deleteUserData function
    const functionKey = process.env.DELETE_USER_DATA_FUNCTION_KEY;
    const functionAppName = process.env.AZURE_FUNCTION_APP_NAME;
    const deleteUserDataUrl = `https://${functionAppName}.azurewebsites.net/api/deleteUserData`;

    // Process each pending request
    for (const request of pendingRequests) {
      const requestStartTime = Date.now();
      
      try {
        context.log(`Processing scheduled deletion for request: ${request.id}, user: ${request.userId}`);

        // Mark request as processing
        await gdprContainer.item(request.id, request.userId).patch([
          { op: 'replace', path: '/status', value: 'processing' },
          { op: 'replace', path: '/processingStarted', value: new Date().toISOString() }
        ]);

        // Call the deleteUserData function
        const deletionResponse = await axios.post(deleteUserDataUrl, {
          requestId: request.id,
          userId: request.userId,
          reason: 'Automatic 30-day deletion process',
          requestingUserId: 'system',
          isAdmin: true
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-Functions-Key': functionKey
          },
          timeout: 300000 // 5 minute timeout
        });

        if (deletionResponse.data?.success) {
          results.successCount++;
          results.processed.push({
            requestId: request.id,
            userId: request.userId,
            status: 'completed',
            duration: Date.now() - requestStartTime,
            deletedItems: deletionResponse.data.totalDeleted
          });

          context.log(`Successfully processed scheduled deletion for request: ${request.id}`);
        } else {
          throw new Error(`Deletion function returned unsuccessful result: ${JSON.stringify(deletionResponse.data)}`);
        }

      } catch (error) {
        const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
        
        context.log.error(`Error processing deletion request ${request.id}:`, errorMessage);

        // Mark as failed in database
        try {
          await gdprContainer.item(request.id, request.userId).patch([
            { op: 'replace', path: '/status', value: 'failed' },
            { op: 'replace', path: '/error', value: errorMessage },
            { op: 'replace', path: '/failedAt', value: new Date().toISOString() }
          ]);
        } catch (updateError) {
          context.log.error(`Failed to update status for request ${request.id}:`, updateError);
        }

        results.failedCount++;
        results.failed.push({
          requestId: request.id,
          userId: request.userId,
          error: errorMessage,
          duration: Date.now() - requestStartTime
        });
      }

      results.processedCount++;
      
      // Add small delay between requests to avoid overwhelming the system
      if (results.processedCount < pendingRequests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Log summary of scheduled deletion batch
    const totalDuration = Date.now() - startTime;
    
    try {
      await database.container('auditLog').items.create({
        id: `scheduled_deletion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        action: 'scheduled_deletion_batch',
        timestamp: new Date().toISOString(),
        processedCount: results.processedCount,
        successCount: results.successCount,
        failedCount: results.failedCount,
        duration: totalDuration,
        processed: results.processed,
        failed: results.failed
      });
    } catch (auditError) {
      context.log.error('Failed to create audit log for scheduled deletion batch:', auditError);
    }

    context.log(`Scheduled deletion process completed: ${results.successCount}/${results.processedCount} successful in ${totalDuration}ms`);

    return {
      ...results,
      duration: totalDuration,
      timestamp: timeStamp
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    context.log.error(`Error in scheduled deletion process (${duration}ms):`, error);
    
    // Log the error for monitoring
    try {
      const client = getCosmosClient();
      const database = client.database('PrepBettrDB');
      await database.container('auditLog').items.create({
        id: `scheduled_deletion_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        action: 'scheduled_deletion_error',
        timestamp: new Date().toISOString(),
        error: error.message,
        duration,
        stack: error.stack
      });
    } catch (auditError) {
      context.log.error('Failed to log scheduled deletion error:', auditError);
    }
    
    throw error;
  }
};
