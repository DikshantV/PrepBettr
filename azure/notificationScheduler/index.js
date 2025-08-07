const { app } = require('@azure/functions');

// Timer trigger function for scheduled notification processing
// Runs every 15 minutes for batched notifications and daily at 9 AM for summaries
app.timer('notificationScheduler', {
    // Cron expression: "0 */15 * * * *" = every 15 minutes
    // Cron expression: "0 0 9 * * *" = daily at 9 AM UTC
    schedule: '0 */15 * * * *',
    handler: async (myTimer, context) => {
        context.log('Notification Scheduler triggered at:', new Date().toISOString());

        try {
            const { jobNotificationIntegration } = require('../../lib/services/job-notification-integration');
            const { notificationService } = require('../../lib/services/notification-service');

            const now = new Date();
            const hour = now.getUTCHours();
            
            // Process batched notifications every 15 minutes
            context.log('Processing batched notifications...');
            await processBatchedNotifications(context);
            
            // Send daily summaries at 9 AM UTC (adjust timezone as needed)
            if (hour === 9 && now.getUTCMinutes() < 15) {
                context.log('Processing daily summaries...');
                await processDailySummaries(context);
            }
            
            // Clean up old notification events once per day at 2 AM UTC
            if (hour === 2 && now.getUTCMinutes() < 15) {
                context.log('Cleaning up old notification events...');
                await cleanupOldNotificationEvents(context);
            }

            context.log('Notification Scheduler completed successfully');

        } catch (error) {
            context.log('Error in Notification Scheduler:', error);
            throw error;
        }
    }
});

/**
 * Process batched notifications for users with hourly/daily frequency preferences
 */
async function processBatchedNotifications(context) {
    try {
        // Import here to avoid module loading issues
        const { jobNotificationIntegration } = require('../../lib/services/job-notification-integration');
        
        await jobNotificationIntegration.processBatchedNotifications();
        
        context.log('Batched notifications processed successfully');
    } catch (error) {
        context.log('Error processing batched notifications:', error);
        throw error;
    }
}

/**
 * Process daily summaries for all eligible users
 */
async function processDailySummaries(context) {
    try {
        // Import here to avoid module loading issues
        const { jobNotificationIntegration } = require('../../lib/services/job-notification-integration');
        
        await jobNotificationIntegration.sendDailySummaries();
        
        context.log('Daily summaries processed successfully');
    } catch (error) {
        context.log('Error processing daily summaries:', error);
        throw error;
    }
}

/**
 * Clean up old notification events
 */
async function cleanupOldNotificationEvents(context) {
    try {
        // Import here to avoid module loading issues
        const { notificationService } = require('../../lib/services/notification-service');
        
        // Clean up events older than 90 days
        const result = await notificationService.cleanupOldEvents(90);
        
        context.log(`Cleaned up ${result.deleted} old notification events`);
    } catch (error) {
        context.log('Error cleaning up old notification events:', error);
        throw error;
    }
}
