// lib/utils/telemetry.ts
// Dynamic imports to prevent client-side bundling issues

// Server-side telemetry (when available)
let serverTelemetry: any = null;

// Client-side telemetry
let appInsights: any = null;
let reactPlugin: any = null;

// Types for telemetry events
export interface TelemetryPageView {
  name: string;
  uri?: string;
  isLoggedIn?: boolean;
  userId?: string;
  properties?: { [key: string]: string };
  measurements?: { [key: string]: number };
}

export interface TelemetryEvent {
  name: string;
  properties?: { [key: string]: string };
  measurements?: { [key: string]: number };
}

export interface TelemetryUserAction {
  action: string;
  feature: string;
  location?: string;
  userId?: string;
  properties?: { [key: string]: string };
}

export interface TelemetryCustomMetric {
  name: string;
  value: number;
  properties?: { [key: string]: string };
}

export interface TelemetryError {
  error: Error;
  userId?: string;
  context?: { [key: string]: string };
}

class TelemetryService {
  private isInitialized = false;
  private isClient = typeof window !== 'undefined';

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (this.isClient) {
        await this.initializeClient();
      } else {
        await this.initializeServer();
      }
      this.isInitialized = true;
      console.log('✅ Telemetry service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize telemetry:', error);
    }
  }

  private async initializeClient(): Promise<void> {
    const connectionString = process.env.NEXT_PUBLIC_AZURE_APPLICATION_INSIGHTS_CONNECTION_STRING;
    const instrumentationKey = process.env.NEXT_PUBLIC_AZURE_APPLICATION_INSIGHTS_INSTRUMENTATION_KEY;

    if (!connectionString && !instrumentationKey) {
      console.warn('⚠️ Azure Application Insights not configured for client');
      return;
    }

    try {
      // Dynamic imports to avoid client-side bundling issues
      const { ApplicationInsights } = await import('@microsoft/applicationinsights-web');
      const { ClickAnalyticsPlugin } = await import('@microsoft/applicationinsights-clickanalytics-js');
      const { ReactPlugin } = await import('@microsoft/applicationinsights-react-js');
      const { createBrowserHistory } = await import('history');
      
      // Create browser history for React Plugin
      const browserHistory = createBrowserHistory();
      
      // Initialize React Plugin
      reactPlugin = new ReactPlugin();
      
      // Initialize Click Analytics Plugin
      const clickPluginInstance = new ClickAnalyticsPlugin();
      const clickPluginConfig = {
        autoCapture: true,
        callback: {
          pageName: () => document.title,
          // Add custom click tracking
          contentName: (element: HTMLElement) => {
            return element.getAttribute('data-telemetry-name') || 
                   element.innerText ||
                   element.tagName.toLowerCase();
          }
        }
      };

      // Configure Application Insights
      appInsights = new ApplicationInsights({
        config: {
          connectionString: connectionString || undefined,
          instrumentationKey: instrumentationKey || undefined,
          enableAutoRouteTracking: true,
          enableRequestHeaderTracking: true,
          enableResponseHeaderTracking: true,
          enableAjaxErrorStatusText: true,
          enableCorsCorrelation: true,
          enableUnhandledPromiseRejectionTracking: true,
          extensions: [reactPlugin, clickPluginInstance],
          extensionConfig: {
            [reactPlugin.identifier]: {
              history: browserHistory
            },
            [clickPluginInstance.identifier]: clickPluginConfig
          }
        }
      });
      
      // Add telemetry initializer after initialization
      appInsights.addTelemetryInitializer((item: any) => {
        item.tags = item.tags || {};
        item.tags['ai.cloud.role'] = 'PrepBettr-Web';
        item.tags['ai.cloud.roleInstance'] = window.location.hostname;
        
        // Add environment info
        if (item.data) {
          item.data.environment = process.env.NODE_ENV || 'development';
          item.data.version = process.env.npm_package_version || '1.0.0';
        }
      });

      // Load Application Insights
      appInsights.loadAppInsights();

      // Track initial page view
      appInsights.trackPageView({
        name: document.title,
        uri: window.location.pathname + window.location.search
      });

      console.log('✅ Client telemetry initialized');
    } catch (error) {
      console.error('❌ Failed to initialize client telemetry:', error);
    }
  }

  private async initializeServer(): Promise<void> {
    // Only import server-side modules on server
    if (this.isClient) return;

    try {
      // Dynamic import to avoid client-side bundling
      const { azureApplicationInsights } = await import('../services/azure-application-insights-service');
      serverTelemetry = azureApplicationInsights;
      await serverTelemetry.initialize();
    } catch (error) {
      console.error('❌ Failed to initialize server telemetry:', error);
    }
  }

  /**
   * Track page view
   */
  async trackPageView(pageView: TelemetryPageView): Promise<void> {
    await this.initialize();

    if (this.isClient && appInsights) {
      appInsights.trackPageView({
        name: pageView.name,
        uri: pageView.uri,
        properties: {
          isLoggedIn: pageView.isLoggedIn?.toString(),
          userId: pageView.userId || 'anonymous',
          ...pageView.properties
        },
        measurements: pageView.measurements
      });
    } else if (!this.isClient && serverTelemetry) {
      await serverTelemetry.trackPageView({
        name: pageView.name,
        url: pageView.uri,
        properties: {
          isLoggedIn: pageView.isLoggedIn?.toString(),
          userId: pageView.userId || 'anonymous',
          ...pageView.properties
        },
        measurements: pageView.measurements
      });
    }

    console.log(`📊 Tracked page view: ${pageView.name}`);
  }

  /**
   * Track custom event
   */
  async trackEvent(event: TelemetryEvent): Promise<void> {
    await this.initialize();

    if (this.isClient && appInsights) {
      appInsights.trackEvent({
        name: event.name,
        properties: event.properties,
        measurements: event.measurements
      });
    } else if (!this.isClient && serverTelemetry) {
      await serverTelemetry.trackEvent({
        name: event.name,
        properties: event.properties,
        metrics: event.measurements
      });
    }

    console.log(`📊 Tracked event: ${event.name}`);
  }

  /**
   * Track user action (clicks, submissions, etc.)
   */
  async trackUserAction(action: TelemetryUserAction): Promise<void> {
    await this.trackEvent({
      name: 'UserAction',
      properties: {
        action: action.action,
        feature: action.feature,
        location: action.location || window.location.pathname,
        userId: action.userId || 'anonymous',
        timestamp: new Date().toISOString(),
        ...action.properties
      },
      measurements: {
        actionCount: 1
      }
    });
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(featureName: string, userId?: string, properties?: { [key: string]: string }): Promise<void> {
    await this.trackEvent({
      name: 'FeatureUsage',
      properties: {
        feature: featureName,
        userId: userId || 'anonymous',
        page: this.isClient ? window.location.pathname : 'server',
        timestamp: new Date().toISOString(),
        ...properties
      },
      measurements: {
        usageCount: 1
      }
    });
  }

  /**
   * Track custom metric
   */
  async trackMetric(metric: TelemetryCustomMetric): Promise<void> {
    await this.initialize();

    if (this.isClient && appInsights) {
      appInsights.trackMetric({
        name: metric.name,
        average: metric.value,
        properties: metric.properties
      });
    } else if (!this.isClient && serverTelemetry) {
      await serverTelemetry.trackMetric({
        name: metric.name,
        value: metric.value
      });
    }

    console.log(`📈 Tracked metric: ${metric.name} = ${metric.value}`);
  }

  /**
   * Track business metrics (interview completion rate, resume uploads, etc.)
   */
  async trackBusinessMetric(metricName: string, value: number, userId?: string, properties?: { [key: string]: string }): Promise<void> {
    // Track as both an event and a metric
    await Promise.all([
      this.trackEvent({
        name: 'BusinessMetric',
        properties: {
          metric: metricName,
          userId: userId || 'anonymous',
          timestamp: new Date().toISOString(),
          ...properties
        },
        measurements: {
          value
        }
      }),
      this.trackMetric({
        name: metricName,
        value,
        properties: {
          userId: userId || 'anonymous',
          ...properties
        }
      })
    ]);
  }

  /**
   * Track interview completion
   */
  async trackInterviewCompletion(userId: string, interviewId: string, questionCount: number, duration: number, score?: number): Promise<void> {
    const properties: { [key: string]: string } = {
      interviewId,
      questionCount: questionCount.toString(),
      durationMinutes: Math.round(duration / 60000).toString()
    };
    
    if (score !== undefined) {
      properties.score = score.toString();
    }
    
    await this.trackBusinessMetric('InterviewCompletionRate', 1, userId, properties);

    // Also track specific metrics
    await Promise.all([
      this.trackMetric({ name: 'InterviewDuration', value: Math.round(duration / 60000) }),
      this.trackMetric({ name: 'InterviewQuestions', value: questionCount }),
      score !== undefined && this.trackMetric({ name: 'InterviewScore', value: score })
    ].filter(Boolean));
  }

  /**
   * Track resume upload
   */
  async trackResumeUpload(userId: string, fileSize: number, mimeType: string, processingTime: number): Promise<void> {
    await Promise.all([
      this.trackBusinessMetric('ResumeUploadCount', 1, userId, {
        mimeType,
        fileSizeKB: Math.round(fileSize / 1024).toString(),
        processingTimeSeconds: Math.round(processingTime / 1000).toString()
      }),
      this.trackMetric({ name: 'ResumeFileSize', value: Math.round(fileSize / 1024) }),
      this.trackMetric({ name: 'ResumeProcessingTime', value: Math.round(processingTime / 1000) })
    ]);
  }

  /**
   * Track form submissions
   */
  async trackFormSubmission(formName: string, userId?: string, success?: boolean, properties?: { [key: string]: string }): Promise<void> {
    const actionProperties: { [key: string]: string } = {
      ...properties
    };
    
    if (success !== undefined) {
      actionProperties.success = success.toString();
    }
    
    await this.trackUserAction({
      action: 'form_submit',
      feature: formName,
      userId,
      properties: actionProperties
    });
  }

  /**
   * Track button clicks
   */
  async trackButtonClick(buttonName: string, location: string, userId?: string, properties?: { [key: string]: string }): Promise<void> {
    await this.trackUserAction({
      action: 'button_click',
      feature: buttonName,
      location,
      userId,
      properties
    });
  }

  /**
   * Track subscription events
   */
  async trackSubscription(userId: string, action: 'upgrade' | 'downgrade' | 'cancel', plan: string, revenue?: number): Promise<void> {
    await this.trackEvent({
      name: 'SubscriptionEvent',
      properties: {
        userId,
        action,
        plan,
        timestamp: new Date().toISOString()
      },
      measurements: revenue ? { revenue } : undefined
    });

    // Track as business metric
    if (action === 'upgrade') {
      await this.trackBusinessMetric('SubscriptionUpgrade', revenue || 1, userId, { plan });
    }
  }

  /**
   * Track errors
   */
  async trackError(errorInfo: TelemetryError): Promise<void> {
    await this.initialize();

    if (this.isClient && appInsights) {
      appInsights.trackException({
        error: errorInfo.error,
        properties: {
          userId: errorInfo.userId || 'anonymous',
          page: window.location.pathname,
          timestamp: new Date().toISOString(),
          ...errorInfo.context
        }
      });
    } else if (!this.isClient && serverTelemetry) {
      await serverTelemetry.trackError(errorInfo.error, errorInfo.userId, {
        ...errorInfo.context
      });
    }

    console.log(`🚨 Tracked error: ${errorInfo.error.message}`);
  }

  /**
   * Set user context
   */
  async setUser(userId: string, email?: string, properties?: { [key: string]: string }): Promise<void> {
    await this.initialize();

    if (this.isClient && appInsights) {
      appInsights.setAuthenticatedUserContext(userId, email);
      
      // Add user properties
      if (properties) {
        appInsights.addTelemetryInitializer((envelope: any) => {
          envelope.tags = envelope.tags || {};
          envelope.data = envelope.data || {};
          Object.assign(envelope.data, {
            userId,
            userEmail: email,
            ...properties
          });
        });
      }
    } else if (!this.isClient && serverTelemetry) {
      await serverTelemetry.setUserContext(userId, email, properties);
    }

    console.log(`👤 Set user context: ${userId}`);
  }

  /**
   * Clear user context (on logout)
   */
  async clearUser(): Promise<void> {
    await this.initialize();

    if (this.isClient && appInsights) {
      appInsights.clearAuthenticatedUserContext();
    } else if (!this.isClient && serverTelemetry) {
      await serverTelemetry.clearUserContext();
    }

    console.log('👤 Cleared user context');
  }

  /**
   * Track A/B test participation
   */
  async trackABTest(testName: string, variant: string, userId?: string): Promise<void> {
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
      measurements: value ? { value } : undefined
    });

    // Also track as business metric
    await this.trackBusinessMetric('ConversionRate', value || 1, userId, { conversionType, ...properties });
  }

  /**
   * Flush telemetry data
   */
  async flush(): Promise<void> {
    if (this.isClient && appInsights) {
      appInsights.flush();
    } else if (!this.isClient && serverTelemetry) {
      await serverTelemetry.flush();
    }
  }

  /**
   * Get React plugin for React integration
   */
  getReactPlugin(): any {
    return reactPlugin;
  }

  /**
   * Get Application Insights instance for advanced usage
   */
  getAppInsights(): any {
    return appInsights;
  }
}

// Export singleton instance
export const telemetry = new TelemetryService();
export default telemetry;
