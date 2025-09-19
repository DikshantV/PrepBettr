import { ApplicationInsights } from '@microsoft/applicationinsights-web';

// Application Insights configuration
const connectionString = process.env.NEXT_PUBLIC_APPLICATION_INSIGHTS_CONNECTION_STRING;

// Initialize Application Insights instance
let appInsights: ApplicationInsights | null = null;

// Performance metrics interface
interface PerformanceMetric {
  name: string;
  value: number;
  properties?: Record<string, string>;
  measurements?: Record<string, number>;
}

// Initialize Application Insights
export const initializeAppInsights = () => {
  if (typeof window === 'undefined' || appInsights) {
    return appInsights;
  }

  if (!connectionString) {
    console.warn('Application Insights connection string not found');
    return null;
  }

  try {
    appInsights = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: true,
        enableCorsCorrelation: true,
        enableRequestHeaderTracking: true,
        enableResponseHeaderTracking: true,
        enableAjaxErrorStatusText: true,
        enableAjaxPerfTracking: true,
        maxAjaxCallsPerView: 20,
        disableExceptionTracking: false,
        disableTelemetry: process.env.NODE_ENV !== 'production',
        samplingPercentage: 100,
        extensions: [],
        extensionConfig: {}
      }
    });

    appInsights.loadAppInsights();
    appInsights.trackPageView({
      name: 'Application Initialized',
      properties: {
        environment: process.env.NODE_ENV || 'unknown',
        timestamp: new Date().toISOString()
      }
    });

    console.log('Application Insights initialized successfully');
    return appInsights;

  } catch (error) {
    console.error('Failed to initialize Application Insights:', error);
    return null;
  }
};

// Track subscription page performance
export const trackSubscriptionPageView = (pageName: string = 'Subscription Page') => {
  if (!appInsights) return;

  const startTime = performance.now();

  appInsights.trackPageView({
    name: pageName,
    properties: {
      page: 'subscription',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    },
    measurements: {
      loadStartTime: startTime
    }
  });
};

// Track PayPal SDK performance
export const trackPayPalSDKPerformance = (metric: {
  loadTime: number;
  success: boolean;
  error?: string;
}) => {
  if (!appInsights) return;

  const eventName = metric.success ? 'PayPal SDK Loaded' : 'PayPal SDK Error';
  
  appInsights.trackEvent({
    name: eventName,
    properties: {
      success: metric.success.toString(),
      error: metric.error || 'none',
      timestamp: new Date().toISOString()
    },
    measurements: {
      paypal_sdk_load_ms: metric.loadTime
    }
  });

  // Track as custom metric for alerting
  appInsights.trackMetric({
    name: 'paypal_sdk_load_ms',
    average: metric.loadTime,
    sampleCount: 1,
    properties: {
      success: metric.success.toString()
    }
  });

  // Alert if load time > 4 seconds
  if (metric.loadTime > 4000) {
    appInsights.trackEvent({
      name: 'PayPal SDK Slow Load Warning',
      properties: {
        loadTime: metric.loadTime.toString(),
        threshold: '4000',
        severity: 'warning'
      }
    });
  }
};

// Track subscription API latency
export const trackSubscriptionAPILatency = (endpoint: string, latency: number, success: boolean) => {
  if (!appInsights) return;

  appInsights.trackDependencyData({
    id: `${endpoint}-${Date.now()}`,
    responseCode: success ? 200 : 500,
    target: endpoint,
    name: `Subscription API: ${endpoint}`,
    data: endpoint,
    duration: latency,
    success,
    type: 'Http',
    properties: {
      api: 'subscription',
      timestamp: new Date().toISOString()
    }
  });

  // Custom metric for alerting
  appInsights.trackMetric({
    name: 'subscription_api_latency_ms',
    average: latency,
    sampleCount: 1,
    properties: {
      endpoint,
      success: success.toString()
    }
  });
};

// Track user subscription actions
export const trackSubscriptionAction = (action: string, planType: string, success: boolean, details?: any) => {
  if (!appInsights) return;

  appInsights.trackEvent({
    name: `Subscription ${action}`,
    properties: {
      planType,
      success: success.toString(),
      action,
      details: details ? JSON.stringify(details) : undefined,
      timestamp: new Date().toISOString()
    }
  });

  // Track conversion funnel
  if (action === 'completed' && success) {
    appInsights.trackEvent({
      name: 'Subscription Conversion',
      properties: {
        planType,
        timestamp: new Date().toISOString()
      },
      measurements: {
        revenue: getRevenue(planType)
      }
    });
  }
};

// Track component performance
export const trackComponentPerformance = (componentName: string, renderTime: number, rerenderCount?: number) => {
  if (!appInsights) return;

  appInsights.trackMetric({
    name: 'component_render_time_ms',
    average: renderTime,
    sampleCount: 1,
    properties: {
      component: componentName,
      hasExcessiveRerenders: rerenderCount ? (rerenderCount > 20).toString() : 'false'
    }
  });

  // Alert on excessive re-renders
  if (rerenderCount && rerenderCount > 20) {
    appInsights.trackEvent({
      name: 'Excessive Component Re-renders',
      properties: {
        component: componentName,
        rerenderCount: rerenderCount.toString(),
        threshold: '20',
        severity: 'performance'
      }
    });
  }
};

// Track errors with context
export const trackError = (error: Error, context: Record<string, any> = {}) => {
  if (!appInsights) return;

  appInsights.trackException({
    exception: error,
    properties: {
      ...context,
      timestamp: new Date().toISOString()
    }
  });
};

// Get revenue for conversion tracking
const getRevenue = (planType: string): number => {
  const revenueMap: Record<string, number> = {
    individual: 49,
    enterprise: 199
  };
  return revenueMap[planType] || 0;
};

// Performance observer for Core Web Vitals
export const initializeWebVitalsTracking = () => {
  if (typeof window === 'undefined' || !appInsights) return;

  // Track Largest Contentful Paint (LCP)
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          appInsights!.trackMetric({
            name: 'largest_contentful_paint',
            average: entry.startTime,
            sampleCount: 1,
            properties: {
              page: window.location.pathname
            }
          });
        }

        if (entry.entryType === 'first-input') {
          appInsights!.trackMetric({
            name: 'first_input_delay',
            average: (entry as any).processingStart - entry.startTime,
            sampleCount: 1,
            properties: {
              page: window.location.pathname
            }
          });
        }
      }
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    observer.observe({ type: 'first-input', buffered: true });

  } catch (error) {
    console.warn('Web Vitals tracking not supported:', error);
  }
};

// Export the service
export default {
  initializeAppInsights,
  trackSubscriptionPageView,
  trackPayPalSDKPerformance,
  trackSubscriptionAPILatency,
  trackSubscriptionAction,
  trackComponentPerformance,
  trackError,
  initializeWebVitalsTracking
};