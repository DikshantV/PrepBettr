/**
 * Application Insights Telemetry Client
 * 
 * Lightweight wrapper around Azure Application Insights for authentication
 * and performance monitoring in Azure Functions.
 * 
 * @version 1.0.0
 * @author PrepBettr Platform Team
 */

// ===== INTERFACES =====

export interface TelemetryEvent {
  name: string;
  properties?: Record<string, string | number | boolean>;
  measurements?: Record<string, number>;
}

export interface TelemetryDependency {
  name: string;
  dependencyTypeName: string;
  duration: number;
  success: boolean;
  properties?: Record<string, string | number | boolean>;
}

export interface TelemetryException {
  exception: Error;
  properties?: Record<string, string | number | boolean>;
}

// ===== APPLICATION INSIGHTS CLIENT =====

export class ApplicationInsights {
  private connectionString: string;
  private initialized: boolean = false;
  private client: any = null;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  /**
   * Initialize Application Insights client (lazy loading)
   */
  private async initializeClient(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamically import Application Insights to avoid issues in environments where it's not needed
      const { TelemetryClient, setup } = await import('applicationinsights');
      
      // Setup Application Insights
      setup(this.connectionString)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setUseDiskRetryCaching(true);

      this.client = new TelemetryClient(this.connectionString);
      this.initialized = true;

      console.log('✅ Application Insights telemetry initialized');

    } catch (error) {
      console.warn('⚠️ Application Insights initialization failed:', error.message);
      // Continue without telemetry rather than failing
      this.initialized = false;
    }
  }

  /**
   * Track custom event
   */
  async trackEvent(name: string, properties?: Record<string, string | number | boolean>): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initializeClient();
      }

      if (this.client) {
        this.client.trackEvent({
          name,
          properties: this.sanitizeProperties(properties)
        });
      }
    } catch (error) {
      console.warn('Failed to track event:', error);
    }
  }

  /**
   * Track dependency call
   */
  async trackDependency(
    name: string,
    dependencyTypeName: string,
    duration: number,
    success: boolean,
    properties?: Record<string, string | number | boolean>
  ): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initializeClient();
      }

      if (this.client) {
        this.client.trackDependency({
          name,
          dependencyTypeName,
          duration,
          success,
          properties: this.sanitizeProperties(properties)
        });
      }
    } catch (error) {
      console.warn('Failed to track dependency:', error);
    }
  }

  /**
   * Track exception
   */
  async trackException(exception: Error, properties?: Record<string, string | number | boolean>): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initializeClient();
      }

      if (this.client) {
        this.client.trackException({
          exception,
          properties: this.sanitizeProperties(properties)
        });
      }
    } catch (error) {
      console.warn('Failed to track exception:', error);
    }
  }

  /**
   * Track metric
   */
  async trackMetric(name: string, value: number, properties?: Record<string, string | number | boolean>): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initializeClient();
      }

      if (this.client) {
        this.client.trackMetric({
          name,
          value,
          properties: this.sanitizeProperties(properties)
        });
      }
    } catch (error) {
      console.warn('Failed to track metric:', error);
    }
  }

  /**
   * Flush telemetry data
   */
  async flush(): Promise<void> {
    try {
      if (this.client) {
        await new Promise<void>((resolve) => {
          this.client.flush({
            callback: () => resolve()
          });
        });
      }
    } catch (error) {
      console.warn('Failed to flush telemetry:', error);
    }
  }

  /**
   * Sanitize properties to ensure they're compatible with Application Insights
   */
  private sanitizeProperties(properties?: Record<string, string | number | boolean>): Record<string, string> {
    if (!properties) return {};

    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(properties)) {
      if (value !== null && value !== undefined) {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Get telemetry client status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasClient: !!this.client,
      connectionString: this.connectionString ? '***configured***' : 'not configured'
    };
  }
}

// ===== SINGLETON INSTANCE =====

let defaultTelemetryClient: ApplicationInsights | null = null;

/**
 * Get or create default telemetry client
 */
export function getTelemetryClient(): ApplicationInsights | null {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  
  if (!connectionString) {
    return null;
  }

  if (!defaultTelemetryClient) {
    defaultTelemetryClient = new ApplicationInsights(connectionString);
  }

  return defaultTelemetryClient;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Track authentication event with standard properties
 */
export async function trackAuthEvent(
  eventName: string,
  userId?: string,
  additionalProperties?: Record<string, string | number | boolean>
): Promise<void> {
  const client = getTelemetryClient();
  if (!client) return;

  const properties = {
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString(),
    ...additionalProperties
  };

  await client.trackEvent(`auth.${eventName}`, properties);
}

/**
 * Track performance metric with timing
 */
export async function trackPerformanceMetric(
  metricName: string,
  duration: number,
  additionalProperties?: Record<string, string | number | boolean>
): Promise<void> {
  const client = getTelemetryClient();
  if (!client) return;

  await client.trackMetric(`performance.${metricName}`, duration, {
    timestamp: new Date().toISOString(),
    ...additionalProperties
  });
}

/**
 * Track error with context
 */
export async function trackError(
  error: Error,
  context?: string,
  additionalProperties?: Record<string, string | number | boolean>
): Promise<void> {
  const client = getTelemetryClient();
  if (!client) return;

  const properties = {
    context: context || 'unknown',
    timestamp: new Date().toISOString(),
    ...additionalProperties
  };

  await client.trackException(error, properties);
}

/**
 * Create performance timer
 */
export function createTimer(operationName: string): () => Promise<void> {
  const startTime = Date.now();
  
  return async () => {
    const duration = Date.now() - startTime;
    await trackPerformanceMetric(operationName, duration);
  };
}

// ===== TELEMETRY MIDDLEWARE =====

/**
 * Azure Function telemetry middleware
 */
export function withTelemetry<T extends any[], R>(
  operationName: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    const client = getTelemetryClient();
    
    try {
      const result = await fn(...args);
      
      const duration = Date.now() - startTime;
      await client?.trackEvent(`operation.${operationName}`, {
        success: 'true',
        duration: duration.toString()
      });
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      await client?.trackEvent(`operation.${operationName}`, {
        success: 'false',
        duration: duration.toString(),
        error: error.message
      });
      
      await client?.trackException(error as Error, {
        operation: operationName
      });
      
      throw error;
    }
  };
}

// ===== EXPORTS =====

export default {
  ApplicationInsights,
  getTelemetryClient,
  trackAuthEvent,
  trackPerformanceMetric,
  trackError,
  createTimer,
  withTelemetry
};
