// lib/utils/telemetry-stub.ts
// Temporary telemetry stub to allow testing without server-only dependencies

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

class TelemetryStubService {
  private isInitialized = false;
  private isClient = typeof window !== 'undefined';

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('📊 Telemetry stub initialized (no actual telemetry)');
    this.isInitialized = true;
  }

  async trackPageView(pageView: TelemetryPageView): Promise<void> {
    console.log(`📊 [STUB] Page view: ${pageView.name}`, pageView);
  }

  async trackEvent(event: TelemetryEvent): Promise<void> {
    console.log(`📊 [STUB] Event: ${event.name}`, event);
  }

  async trackUserAction(action: TelemetryUserAction): Promise<void> {
    console.log(`📊 [STUB] User action: ${action.action} on ${action.feature}`, action);
  }

  async trackFeatureUsage(featureName: string, userId?: string, properties?: { [key: string]: string }): Promise<void> {
    console.log(`📊 [STUB] Feature usage: ${featureName}`, { userId, properties });
  }

  async trackMetric(metric: TelemetryCustomMetric): Promise<void> {
    console.log(`📈 [STUB] Metric: ${metric.name} = ${metric.value}`, metric);
  }

  async trackBusinessMetric(metricName: string, value: number, userId?: string, properties?: { [key: string]: string }): Promise<void> {
    console.log(`💼 [STUB] Business metric: ${metricName} = ${value}`, { userId, properties });
  }

  async trackInterviewCompletion(userId: string, interviewId: string, questionCount: number, duration: number, score?: number): Promise<void> {
    console.log(`🎯 [STUB] Interview completed:`, { userId, interviewId, questionCount, duration, score });
  }

  async trackResumeUpload(userId: string, fileSize: number, mimeType: string, processingTime: number): Promise<void> {
    console.log(`📄 [STUB] Resume uploaded:`, { userId, fileSize, mimeType, processingTime });
  }

  async trackFormSubmission(formName: string, userId?: string, success?: boolean, properties?: { [key: string]: string }): Promise<void> {
    console.log(`📝 [STUB] Form submitted: ${formName}`, { userId, success, properties });
  }

  async trackButtonClick(buttonName: string, location: string, userId?: string, properties?: { [key: string]: string }): Promise<void> {
    console.log(`🔘 [STUB] Button clicked: ${buttonName} at ${location}`, { userId, properties });
  }

  async trackSubscription(userId: string, action: 'upgrade' | 'downgrade' | 'cancel', plan: string, revenue?: number): Promise<void> {
    console.log(`💳 [STUB] Subscription ${action}: ${plan}`, { userId, revenue });
  }

  async trackError(errorInfo: TelemetryError): Promise<void> {
    console.log(`🚨 [STUB] Error tracked: ${errorInfo.error.message}`, errorInfo);
  }

  async setUser(userId: string, email?: string, properties?: { [key: string]: string }): Promise<void> {
    console.log(`👤 [STUB] User context set: ${userId}`, { email, properties });
  }

  async clearUser(): Promise<void> {
    console.log('👤 [STUB] User context cleared');
  }

  async trackABTest(testName: string, variant: string, userId?: string): Promise<void> {
    console.log(`🧪 [STUB] A/B test: ${testName} = ${variant}`, { userId });
  }

  async trackConversion(conversionType: string, value?: number, userId?: string, properties?: { [key: string]: string }): Promise<void> {
    console.log(`🎯 [STUB] Conversion: ${conversionType}`, { value, userId, properties });
  }

  async flush(): Promise<void> {
    console.log('🚿 [STUB] Telemetry flushed');
  }

  getReactPlugin(): any {
    return null;
  }

  getAppInsights(): any {
    return null;
  }
}

// Export singleton instance
export const telemetry = new TelemetryStubService();
export default telemetry;
