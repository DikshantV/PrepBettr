const { default: appInsights } = require('applicationinsights');

/**
 * Shared telemetry utilities for Auto-Apply metrics
 * Provides standardized metric names and dimensions for monitoring
 */
class AutoApplyMetrics {
    constructor() {
        this.initialized = false;
        this.telemetryClient = null;
        this.initializeTelemetry();
    }

    initializeTelemetry() {
        try {
            if (appInsights.defaultClient) {
                this.telemetryClient = appInsights.defaultClient;
                this.initialized = true;
                console.log('✅ Auto-Apply metrics telemetry client initialized');
            } else {
                console.warn('⚠️ Application Insights not available for Auto-Apply metrics');
            }
        } catch (error) {
            console.error('❌ Failed to initialize Auto-Apply telemetry:', error);
        }
    }

    /**
     * Track application attempt result
     * @param {Object} params - Application metrics parameters
     */
    trackApplicationAttempt(params) {
        const {
            applicationId,
            userId,
            jobId,
            portal,
            success,
            duration,
            attempts,
            errorMessage,
            method = 'headless_browser'
        } = params;

        // Track success/failure metric
        this.trackMetric('AutoApply.Application.Success', success ? 1 : 0, {
            applicationId,
            userId,
            jobId,
            portal,
            method,
            attempts: attempts?.toString(),
            errorMessage: errorMessage || 'none'
        });

        // Track duration
        if (duration) {
            this.trackMetric('AutoApply.Application.DurationMs', duration, {
                applicationId,
                portal,
                success: success.toString(),
                method
            });
        }

        // Track custom event with detailed context
        this.trackEvent(success ? 'AutoApply.Application.Success' : 'AutoApply.Application.Failed', {
            applicationId,
            userId,
            jobId,
            portal,
            method,
            attempts: attempts?.toString(),
            duration: duration?.toString(),
            errorMessage: errorMessage || 'none'
        }, {
            duration,
            attempts: attempts || 1,
            success: success ? 1 : 0
        });
    }

    /**
     * Track browser resource usage
     * @param {Object} params - Browser metrics parameters
     */
    trackBrowserMetrics(params) {
        const {
            applicationId,
            activeBrowsers,
            maxBrowsers,
            memoryUsage,
            cpuUsage,
            queueLength,
            browserLaunchTime
        } = params;

        if (activeBrowsers !== undefined) {
            this.trackMetric('AutoApply.Browser.ActiveCount', activeBrowsers, {
                applicationId,
                maxBrowsers: maxBrowsers?.toString()
            });
        }

        if (memoryUsage) {
            this.trackMetric('AutoApply.Browser.MemoryMb', memoryUsage, {
                applicationId
            });
        }

        if (cpuUsage) {
            this.trackMetric('AutoApply.Browser.CPU', cpuUsage, {
                applicationId
            });
        }

        if (queueLength !== undefined) {
            this.trackMetric('AutoApply.Queue.Length', queueLength, {
                applicationId
            });
        }

        if (browserLaunchTime) {
            this.trackMetric('AutoApply.Browser.LaunchTimeMs', browserLaunchTime, {
                applicationId
            });
        }
    }

    /**
     * Track screening question accuracy
     * @param {Object} params - Screening metrics parameters
     */
    trackScreeningMetrics(params) {
        const {
            applicationId,
            questionsAnswered,
            correctAnswers,
            aiConfidence,
            portal
        } = params;

        if (questionsAnswered && correctAnswers !== undefined) {
            const accuracy = (correctAnswers / questionsAnswered) * 100;
            this.trackMetric('AutoApply.Screening.Accuracy', accuracy, {
                applicationId,
                portal,
                questionsAnswered: questionsAnswered.toString(),
                correctAnswers: correctAnswers.toString()
            });
        }

        if (aiConfidence) {
            this.trackMetric('AutoApply.Screening.AIConfidence', aiConfidence, {
                applicationId,
                portal
            });
        }

        this.trackEvent('AutoApply.Screening.Completed', {
            applicationId,
            portal,
            questionsAnswered: questionsAnswered?.toString(),
            correctAnswers: correctAnswers?.toString(),
            aiConfidence: aiConfidence?.toString()
        }, {
            questionsAnswered: questionsAnswered || 0,
            correctAnswers: correctAnswers || 0,
            aiConfidence: aiConfidence || 0
        });
    }

    /**
     * Track TheirStack API usage and costs
     * @param {Object} params - TheirStack metrics parameters
     */
    trackTheirStackMetrics(params) {
        const {
            userId,
            creditsUsed,
            searchResults,
            responseTime,
            success,
            statusCode,
            costInUSD
        } = params;

        if (creditsUsed) {
            this.trackMetric('AutoApply.TheirStack.CreditsUsed', creditsUsed, {
                userId,
                success: success?.toString(),
                statusCode: statusCode?.toString()
            });
        }

        if (costInUSD) {
            this.trackMetric('AutoApply.TheirStack.CostUSD', costInUSD, {
                userId,
                creditsUsed: creditsUsed?.toString()
            });
        }

        if (responseTime) {
            this.trackMetric('AutoApply.TheirStack.ResponseTimeMs', responseTime, {
                userId,
                success: success?.toString()
            });
        }

        if (searchResults !== undefined) {
            this.trackMetric('AutoApply.TheirStack.ResultsCount', searchResults, {
                userId,
                creditsUsed: creditsUsed?.toString()
            });
        }
    }

    /**
     * Track daily application volume and limits
     * @param {Object} params - Volume metrics parameters
     */
    trackVolumeMetrics(params) {
        const {
            userId,
            dailyApplications,
            dailyLimit,
            monthlyApplications,
            monthlyLimit,
            userTier
        } = params;

        if (dailyApplications !== undefined) {
            this.trackMetric('AutoApply.Volume.DailyApplications', dailyApplications, {
                userId,
                userTier,
                dailyLimit: dailyLimit?.toString()
            });
        }

        if (monthlyApplications !== undefined) {
            this.trackMetric('AutoApply.Volume.MonthlyApplications', monthlyApplications, {
                userId,
                userTier,
                monthlyLimit: monthlyLimit?.toString()
            });
        }

        // Track usage percentage
        if (dailyApplications && dailyLimit) {
            const dailyUsagePercentage = (dailyApplications / dailyLimit) * 100;
            this.trackMetric('AutoApply.Volume.DailyUsagePercent', dailyUsagePercentage, {
                userId,
                userTier
            });
        }
    }

    /**
     * Track portal-specific success rates
     * @param {Object} params - Portal metrics parameters
     */
    trackPortalMetrics(params) {
        const {
            portal,
            applicationAttempts,
            successfulApplications,
            averageTime,
            commonErrors
        } = params;

        if (applicationAttempts && successfulApplications !== undefined) {
            const successRate = (successfulApplications / applicationAttempts) * 100;
            this.trackMetric('AutoApply.Portal.SuccessRate', successRate, {
                portal,
                attempts: applicationAttempts.toString(),
                successes: successfulApplications.toString()
            });
        }

        if (averageTime) {
            this.trackMetric('AutoApply.Portal.AverageTimeMs', averageTime, {
                portal
            });
        }

        this.trackEvent('AutoApply.Portal.Summary', {
            portal,
            applicationAttempts: applicationAttempts?.toString(),
            successfulApplications: successfulApplications?.toString(),
            averageTime: averageTime?.toString(),
            commonErrors: commonErrors || 'none'
        }, {
            applicationAttempts: applicationAttempts || 0,
            successfulApplications: successfulApplications || 0,
            averageTime: averageTime || 0
        });
    }

    /**
     * Generic metric tracking with proper error handling
     */
    trackMetric(name, value, properties = {}, measurements = {}) {
        if (!this.initialized || !this.telemetryClient) {
            console.warn(`⚠️ Cannot track metric ${name}: telemetry not initialized`);
            return;
        }

        try {
            this.telemetryClient.trackMetric({
                name,
                value,
                properties: {
                    ...properties,
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV || 'development'
                },
                measurements
            });

            console.log(`📊 Tracked metric: ${name} = ${value}`, properties);
        } catch (error) {
            console.error(`❌ Error tracking metric ${name}:`, error);
        }
    }

    /**
     * Generic event tracking with proper error handling
     */
    trackEvent(name, properties = {}, measurements = {}) {
        if (!this.initialized || !this.telemetryClient) {
            console.warn(`⚠️ Cannot track event ${name}: telemetry not initialized`);
            return;
        }

        try {
            this.telemetryClient.trackEvent({
                name,
                properties: {
                    ...properties,
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV || 'development'
                },
                measurements
            });

            console.log(`📝 Tracked event: ${name}`, properties);
        } catch (error) {
            console.error(`❌ Error tracking event ${name}:`, error);
        }
    }

    /**
     * Track exception with context
     */
    trackException(error, properties = {}) {
        if (!this.initialized || !this.telemetryClient) {
            console.warn(`⚠️ Cannot track exception: telemetry not initialized`);
            return;
        }

        try {
            this.telemetryClient.trackException({
                exception: error,
                properties: {
                    ...properties,
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV || 'development',
                    source: 'auto-apply'
                }
            });

            console.log(`❌ Tracked exception: ${error.message}`, properties);
        } catch (trackingError) {
            console.error(`❌ Error tracking exception:`, trackingError);
        }
    }

    /**
     * Get health status of the metrics system
     */
    getHealthStatus() {
        return {
            initialized: this.initialized,
            telemetryClient: !!this.telemetryClient,
            timestamp: new Date().toISOString()
        };
    }
}

// Export singleton instance
module.exports = new AutoApplyMetrics();
