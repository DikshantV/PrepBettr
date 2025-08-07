const { app } = require('@azure/functions');
const queueService = require('../lib/services/queue-service');
const automationLogger = require('../lib/services/automation-logs');

// Timer trigger function - runs every 15 minutes
app.timer('searchSchedulerTimer', {
    schedule: '0 */15 * * * *',
    handler: async (myTimer, context) => {
        const timeStamp = new Date().toISOString();
        context.log('Search Scheduler timer trigger function ran!', timeStamp);

        try {
            await automationLogger.logInfo(
                'search_scheduler_started',
                'Search scheduler timer triggered',
                { timestamp: timeStamp }
            );

            // Get active users with auto-apply enabled
            const activeUsers = await getActiveAutoApplyUsers();
            
            if (activeUsers.length === 0) {
                context.log('No active users found for job search scheduling');
                return;
            }

            let scheduledSearches = 0;
            let errors = 0;

            for (const user of activeUsers) {
                try {
                    // Check if user needs a new job search based on their settings
                    const needsSearch = await shouldScheduleSearch(user);
                    
                    if (needsSearch) {
                        await scheduleJobSearch(user);
                        scheduledSearches++;
                        
                        await automationLogger.logInfo(
                            'job_search_scheduled',
                            `Job search scheduled for user ${user.id}`,
                            { userId: user.id, searchFilters: user.autoApplySettings.filters }
                        );
                    }
                } catch (userError) {
                    errors++;
                    context.log(`Error processing user ${user.id}:`, userError);
                    await automationLogger.logError(
                        'search_scheduling_error',
                        userError,
                        { userId: user.id }
                    );
                }
            }

            await automationLogger.logInfo(
                'search_scheduler_completed',
                `Search scheduling completed. Scheduled: ${scheduledSearches}, Errors: ${errors}`,
                { scheduledSearches, errors, processedUsers: activeUsers.length }
            );

        } catch (error) {
            context.log('Error in search scheduler:', error);
            await automationLogger.logError('search_scheduler_error', error);
            throw error;
        }
    }
});

// HTTP trigger for manual job search scheduling
app.http('searchSchedulerHttp', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        try {
            const body = await request.json();
            const { userId, filters, immediate = false } = body;

            if (!userId) {
                return {
                    status: 400,
                    jsonBody: {
                        success: false,
                        error: 'userId is required'
                    }
                };
            }

            await automationLogger.logInfo(
                'manual_search_requested',
                `Manual job search requested for user ${userId}`,
                { userId, immediate, filters }
            );

            // Create job search message
            const searchMessage = {
                userId,
                filters: filters || await getUserSearchFilters(userId),
                requestId: require('uuid').v4(),
                requestedAt: new Date().toISOString(),
                priority: immediate ? 'high' : 'normal'
            };

            // Add to search queue
            await queueService.addMessage(
                queueService.queues.SEARCH_JOBS,
                searchMessage,
                {
                    visibilityTimeout: immediate ? 0 : 60 // Process immediately or in 1 minute
                }
            );

            await automationLogger.logInfo(
                'job_search_queued',
                `Job search queued for user ${userId}`,
                { userId, requestId: searchMessage.requestId }
            );

            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: 'Job search scheduled successfully',
                    requestId: searchMessage.requestId
                }
            };

        } catch (error) {
            context.log('Error in HTTP search scheduler:', error);
            await automationLogger.logError('manual_search_error', error);
            
            return {
                status: 500,
                jsonBody: {
                    success: false,
                    error: 'Internal server error'
                }
            };
        }
    }
});

/**
 * Get users with active auto-apply settings
 */
async function getActiveAutoApplyUsers() {
    try {
        // TODO: In production, this would query Firebase Firestore or another database
        // For now, return mock data
        console.log('Fetching active auto-apply users...');
        
        return [
            {
                id: 'user123',
                email: 'user@example.com',
                autoApplySettings: {
                    isEnabled: true,
                    filters: {
                        keywords: ['React', 'Frontend', 'JavaScript'],
                        locations: ['San Francisco', 'Remote'],
                        jobTypes: ['full-time'],
                        workArrangements: ['remote', 'hybrid'],
                        portals: ['LinkedIn', 'Indeed'],
                        minimumRelevancyScore: 75
                    },
                    dailyApplicationLimit: 5,
                    autoApplyThreshold: 80,
                    lastSearchAt: '2024-01-15T06:00:00Z'
                }
            }
        ];
    } catch (error) {
        console.error('Error fetching active users:', error);
        return [];
    }
}

/**
 * Determine if a user needs a new job search
 */
async function shouldScheduleSearch(user) {
    try {
        const settings = user.autoApplySettings;
        
        if (!settings.isEnabled) {
            return false;
        }

        // Check last search time
        const lastSearch = new Date(settings.lastSearchAt || 0);
        const now = new Date();
        const hoursSinceLastSearch = (now - lastSearch) / (1000 * 60 * 60);

        // Schedule search if it's been more than 4 hours
        if (hoursSinceLastSearch >= 4) {
            return true;
        }

        // Check if user has reached daily application limit
        const todayApplications = await getTodayApplicationCount(user.id);
        if (todayApplications >= settings.dailyApplicationLimit) {
            console.log(`User ${user.id} has reached daily application limit`);
            return false;
        }

        // Check queue length to avoid overwhelming the system
        const queueLength = await queueService.getQueueLength(queueService.queues.SEARCH_JOBS);
        if (queueLength > 50) {
            console.log('Search queue is full, skipping additional searches');
            return false;
        }

        return false;
    } catch (error) {
        console.error(`Error determining if user ${user.id} needs search:`, error);
        return false;
    }
}

/**
 * Schedule a job search for a user
 */
async function scheduleJobSearch(user) {
    try {
        const searchMessage = {
            userId: user.id,
            filters: user.autoApplySettings.filters,
            requestId: require('uuid').v4(),
            requestedAt: new Date().toISOString(),
            priority: 'normal',
            autoApply: true,
            autoApplyThreshold: user.autoApplySettings.autoApplyThreshold,
            dailyLimit: user.autoApplySettings.dailyApplicationLimit
        };

        await queueService.addMessage(
            queueService.queues.SEARCH_JOBS,
            searchMessage,
            {
                visibilityTimeout: Math.floor(Math.random() * 300) + 60 // Random delay between 1-6 minutes
            }
        );

        console.log(`Scheduled job search for user ${user.id}`);
    } catch (error) {
        console.error(`Error scheduling job search for user ${user.id}:`, error);
        throw error;
    }
}

/**
 * Get user's search filters (fallback function)
 */
async function getUserSearchFilters(userId) {
    try {
        // TODO: Fetch from database
        return {
            keywords: ['React', 'Frontend', 'JavaScript'],
            locations: ['San Francisco', 'Remote'],
            jobTypes: ['full-time'],
            workArrangements: ['remote', 'hybrid'],
            portals: ['LinkedIn', 'Indeed'],
            minimumRelevancyScore: 75
        };
    } catch (error) {
        console.error(`Error getting search filters for user ${userId}:`, error);
        return {
            keywords: [],
            locations: ['Remote'],
            jobTypes: ['full-time'],
            workArrangements: ['remote'],
            portals: ['LinkedIn'],
            minimumRelevancyScore: 70
        };
    }
}

/**
 * Get count of applications submitted today for a user
 */
async function getTodayApplicationCount(userId) {
    try {
        // TODO: Query database for today's applications
        // For now, return a random number for demonstration
        return Math.floor(Math.random() * 3);
    } catch (error) {
        console.error(`Error getting today's application count for user ${userId}:`, error);
        return 0;
    }
}
