/**
 * Azure Function: Health Check Endpoint
 * Provides a simple health status for the Function App
 */

module.exports = async function (context, req) {
    context.log('Health check endpoint called');
    
    const startTime = new Date();
    const timestamp = startTime.toISOString();
    
    try {
        // Basic health checks
        const healthStatus = {
            status: 'healthy',
            timestamp,
            service: 'PrepBettr Azure Functions',
            version: '1.0.0',
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            checks: {
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                    unit: 'MB'
                },
                services: {
                    azure_openai: !!process.env.AZURE_OPENAI_KEY,
                    azure_speech: !!process.env.SPEECH_KEY,
                    firebase_configured: !!(
                        process.env.FIREBASE_PROJECT_ID && 
                        process.env.FIREBASE_CLIENT_EMAIL
                    )
                }
            }
        };
        
        // Calculate response time
        const endTime = new Date();
        healthStatus.responseTime = endTime - startTime;
        healthStatus.responseTimeUnit = 'ms';
        
        context.log('Health check completed successfully');
        
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: healthStatus
        };
        
    } catch (error) {
        context.log.error('Health check failed:', error);
        
        context.res = {
            status: 503,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: {
                status: 'unhealthy',
                timestamp,
                service: 'PrepBettr Azure Functions',
                error: error.message,
                checks: {
                    basic_functionality: false
                }
            }
        };
    }
};
