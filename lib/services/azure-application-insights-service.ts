import * as appInsights from 'applicationinsights';
import type { TelemetryClient } from 'applicationinsights';

export interface CustomEvent {
  name: string;
  properties?: { [key: string]: string };
  metrics?: { [key: string]: number };
}

export interface PageView {
  name: string;
  url?: string;
  duration?: number;
  properties?: { [key: string]: string };
  measurements?: { [key: string]: number };
}

export interface UserAction {
  action: string;
  feature: string;
  userId?: string;
  properties?: { [key: string]: string };
}

export interface PerformanceMetric {
  name: string;
  value: number;
  count?: number;
  min?: number;
  max?: number;
}

class AzureApplicationInsightsService {
  private telemetryClient: TelemetryClient | null = null;
  private initialized = false;
  private instrumentationKey: string;
  private connectionString: string;

  constructor() {
    this.instrumentationKey = process.env.AZURE_APPLICATION_INSIGHTS_INSTRUMENTATION_KEY || '';
    this.connectionString = process.env.AZURE_APPLICATION_INSIGHTS_CONNECTION_STRING || '';
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!this.connectionString && !this.instrumentationKey) {
        console.warn('⚠️ Azure Application Insights not configured - missing connection string and instrumentation key');
        return;
      }

      // Configure Application Insights
      if (this.connectionString) {
        appInsights.setup(this.connectionString);
      } else {
        appInsights.setup(this.instrumentationKey);
      }

      // Configure telemetry settings
      appInsights.Configuration.setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C);
      
      // Set common properties
      appInsights.defaultClient.commonProperties = {
        application: 'PrepBettr',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      };

      // Start collecting telemetry
      appInsights.start();

      this.telemetryClient = appInsights.defaultClient;
      this.initialized = true;

      console.log('✅ Azure Application Insights initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Azure Application Insights:', error);
      throw error;
    }
  }

  /**
   * Track a custom event
   */
  async trackEvent(event: CustomEvent): Promise<void> {
    await this.initialize();

    if (!this.telemetryClient) {
      console.warn('Azure Application Insights not available');
      return;
    }

    try {
      this.telemetryClient.trackEvent({
        name: event.name,
        properties: event.properties,
        measurements: event.metrics
      });

      console.log(`📊 Tracked event: ${event.name}`);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Track a page view
   */
  async trackPageView(pageView: PageView): Promise<void> {
    await this.initialize();

    if (!this.telemetryClient) {
      console.warn('Azure Application Insights not available');
      return;
    }

    try {
      this.telemetryClient.trackPageView({
        name: pageView.name,
        url: pageView.url,
        duration: pageView.duration,
        properties: pageView.properties,
        measurements: pageView.measurements,
        id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      console.log(`👀 Tracked page view: ${pageView.name}`);
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  }

  /**
   * Track user action
   */
  async trackUserAction(action: UserAction): Promise<void> {
    await this.trackEvent({
      name: 'UserAction',
      properties: {
        action: action.action,
        feature: action.feature,
        userId: action.userId || 'anonymous',
        timestamp: new Date().toISOString(),
        ...action.properties
      }
    });
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(featureName: string, userId?: string, metadata?: { [key: string]: string }): Promise<void> {
    await this.trackEvent({
      name: 'FeatureUsage',
      properties: {
        feature: featureName,
        userId: userId || 'anonymous',
        timestamp: new Date().toISOString(),
        ...metadata
      },
      metrics: {
        usageCount: 1
      }
    });
  }

  /**
   * Track interview completion
   */
  async trackInterviewCompletion(userId: string, interviewId: string, questionCount: number, duration: number): Promise<void> {
    await this.trackEvent({
      name: 'InterviewCompleted',
      properties: {
        userId,
        interviewId,
        timestamp: new Date().toISOString()
      },
      metrics: {
        questionCount,
        durationMinutes: Math.round(duration / 60)
      }
    });
  }

  /**
   * Track resume upload
   */
  async trackResumeUpload(userId: string, fileSize: number, mimeType: string, processingTime: number): Promise<void> {
    await this.trackEvent({
      name: 'ResumeUploaded',
      properties: {
        userId,
        mimeType,
        timestamp: new Date().toISOString()
      },
      metrics: {
        fileSizeKB: Math.round(fileSize / 1024),
        processingTimeSeconds: Math.round(processingTime / 1000)
      }
    });
  }

  /**
   * Track user registration
   */
  async trackUserRegistration(userId: string, method: string): Promise<void> {
    await this.trackEvent({
      name: 'UserRegistered',
      properties: {
        userId,
        registrationMethod: method,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Track user login
   */
  async trackUserLogin(userId: string, method: string): Promise<void> {
    await this.trackEvent({
      name: 'UserLogin',
      properties: {
        userId,
        loginMethod: method,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Track subscription events
   */
  async trackSubscription(userId: string, action: 'upgrade' | 'downgrade' | 'cancel', plan: string): Promise<void> {
    await this.trackEvent({
      name: 'SubscriptionEvent',
      properties: {
        userId,
        action,
        plan,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Track errors and exceptions
   */
  async trackError(error: Error, userId?: string, context?: { [key: string]: string }): Promise<void> {
    await this.initialize();

    if (!this.telemetryClient) {
      console.warn('Azure Application Insights not available');
      return;
    }

    try {
      this.telemetryClient.trackException({
        exception: error,
        properties: {
          userId: userId || 'anonymous',
          timestamp: new Date().toISOString(),
          ...context
        }
      });

      console.log(`🚨 Tracked error: ${error.message}`);
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
  }

  /**
   * Track custom metric
   */
  async trackMetric(metric: PerformanceMetric): Promise<void> {
    await this.initialize();

    if (!this.telemetryClient) {
      console.warn('Azure Application Insights not available');
      return;
    }

    try {
      this.telemetryClient.trackMetric({
        name: metric.name,
        value: metric.value,
        count: metric.count,
        min: metric.min,
        max: metric.max
      });

      console.log(`📈 Tracked metric: ${metric.name} = ${metric.value}`);
    } catch (error) {
      console.error('Failed to track metric:', error);
    }
  }

  /**
   * Track API request duration
   */
  async trackAPIRequest(name: string, url: string, duration: number, success: boolean, responseCode?: number): Promise<void> {
    await this.initialize();

    if (!this.telemetryClient) {
      console.warn('Azure Application Insights not available');
      return;
    }

    try {
      this.telemetryClient.trackRequest({
        name,
        url,
        duration,
        resultCode: responseCode?.toString() || (success ? '200' : '500'),
        success
      });

      console.log(`🌐 Tracked API request: ${name} (${duration}ms)`);
    } catch (error) {
      console.error('Failed to track API request:', error);
    }
  }

  /**
   * Track dependency calls (external services)
   */
  async trackDependency(name: string, type: string, data: string, duration: number, success: boolean): Promise<void> {
    await this.initialize();

    if (!this.telemetryClient) {
      console.warn('Azure Application Insights not available');
      return;
    }

    try {
      this.telemetryClient.trackDependency({
        name,
        dependencyTypeName: type,
        data,
        duration,
        success,
        resultCode: success ? 200 : 500
      });

      console.log(`🔗 Tracked dependency: ${name} (${duration}ms)`);
    } catch (error) {
      console.error('Failed to track dependency:', error);
    }
  }

  /**
   * Set user context
   */
  async setUserContext(userId: string, email?: string, properties?: { [key: string]: string }): Promise<void> {
    await this.initialize();

    if (!this.telemetryClient) {
      console.warn('Azure Application Insights not available');
      return;
    }

    try {
      // Add user context via common properties since API methods vary
      if (this.telemetryClient.commonProperties) {
        Object.assign(this.telemetryClient.commonProperties, {
          userId,
          userEmail: email,
          ...properties
        });
      }

      console.log(`👤 Set user context: ${userId}`);
    } catch (error) {
      console.error('Failed to set user context:', error);
    }
  }

  /**
   * Clear user context (on logout)
   */
  async clearUserContext(): Promise<void> {
    await this.initialize();

    if (!this.telemetryClient) {
      console.warn('Azure Application Insights not available');
      return;
    }

    try {
      // Remove user-specific properties
      if (this.telemetryClient.commonProperties) {
        delete this.telemetryClient.commonProperties.userId;
        delete this.telemetryClient.commonProperties.userEmail;
      }
      
      console.log('👤 Cleared user context');
    } catch (error) {
      console.error('Failed to clear user context:', error);
    }
  }

  /**
   * Flush telemetry data immediately
   */
  async flush(): Promise<void> {
    await this.initialize();

    if (!this.telemetryClient) {
      return;
    }

    try {
      this.telemetryClient.flush();
      console.log('🔄 Flushed telemetry data');
    } catch (error) {
      console.error('Failed to flush telemetry:', error);
    }
  }

  /**
   * Track business metrics
   */
  async trackBusinessMetric(metricName: string, value: number, userId?: string, properties?: { [key: string]: string }): Promise<void> {
    await this.trackEvent({
      name: 'BusinessMetric',
      properties: {
        metric: metricName,
        userId: userId || 'anonymous',
        timestamp: new Date().toISOString(),
        ...properties
      },
      metrics: {
        value
      }
    });
  }

  /**
   * Track A/B test participation
   */
  async trackABTestParticipation(testName: string, variant: string, userId?: string): Promise<void> {
    await this.trackEvent({
      name: 'ABTestParticipation',
      properties: {
        testName,
        variant,
        userId: userId || 'anonymous',
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Track conversion events
   */
  async trackConversion(conversionType: string, value?: number, userId?: string, properties?: { [key: string]: string }): Promise<void> {
    await this.trackEvent({
      name: 'Conversion',
      properties: {
        conversionType,
        userId: userId || 'anonymous',
        timestamp: new Date().toISOString(),
        ...properties
      },
      metrics: value ? { value } : undefined
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; timestamp: Date }> {
    try {
      await this.initialize();

      if (!this.telemetryClient) {
        return { status: 'unhealthy', timestamp: new Date() };
      }

      // Try to track a test event
      await this.trackEvent({
        name: 'HealthCheck',
        properties: {
          timestamp: new Date().toISOString()
        }
      });

      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      console.error('Azure Application Insights health check failed:', error);
      return { status: 'unhealthy', timestamp: new Date() };
    }
  }
}

// Export singleton instance
export const azureApplicationInsights = new AzureApplicationInsightsService();
export default azureApplicationInsights;
