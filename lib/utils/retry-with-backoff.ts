import { ApplicationInsights } from '@microsoft/applicationinsights-web';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number; // Base delay in milliseconds
  maxDelay?: number; // Maximum delay in milliseconds
  jitter?: boolean; // Add randomness to prevent thundering herd
  retryCondition?: (error: any) => boolean; // Custom condition for retrying
  onRetry?: (error: any, attempt: number) => void; // Callback on retry
}

export interface RetryMetrics {
  attempt: number;
  totalAttempts: number;
  delay: number;
  error?: any;
  userId?: string;
  action: string;
  startTime: number;
  endTime?: number;
}

export class RetryWithBackoff {
  private static appInsights?: ApplicationInsights;

  static initialize(instrumentationKey?: string) {
    if (instrumentationKey && typeof window !== 'undefined') {
      this.appInsights = new ApplicationInsights({
        config: {
          instrumentationKey,
          enableAutoRouteTracking: false,
        }
      });
      this.appInsights.loadAppInsights();
    }
  }

  /**
   * Execute a function with exponential backoff retry logic
   */
  static async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions & { userId?: string; action?: string } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      jitter = true,
      retryCondition = this.defaultRetryCondition,
      onRetry,
      userId,
      action = 'unknown'
    } = options;

    const startTime = Date.now();
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        
        // Log success metrics
        if (attempt > 0) {
          this.logRetrySuccess({
            attempt: attempt + 1,
            totalAttempts: attempt + 1,
            delay: 0,
            userId,
            action,
            startTime,
            endTime: Date.now()
          });
        }

        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (attempt === maxRetries || !retryCondition(error)) {
          // Log final failure
          this.logRetryFailure({
            attempt: attempt + 1,
            totalAttempts: maxRetries + 1,
            delay: 0,
            error,
            userId,
            action,
            startTime,
            endTime: Date.now()
          });
          throw error;
        }

        // Calculate delay for next attempt
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const delay = jitter 
          ? exponentialDelay + Math.random() * exponentialDelay * 0.1 // Add 10% jitter
          : exponentialDelay;

        // Log retry attempt
        this.logRetryAttempt({
          attempt: attempt + 1,
          totalAttempts: maxRetries + 1,
          delay,
          error,
          userId,
          action,
          startTime
        });

        // Execute retry callback if provided
        if (onRetry) {
          onRetry(error, attempt + 1);
        }

        // Wait before next attempt
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Default retry condition - retry on network errors, rate limits, and server errors
   */
  private static defaultRetryCondition(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ECONNREFUSED') {
      return true;
    }

    // HTTP status codes that should be retried
    if (error.response?.status) {
      const status = error.response.status;
      return status === 429 || // Rate limit
             status === 502 || // Bad Gateway
             status === 503 || // Service Unavailable
             status === 504;   // Gateway Timeout
    }

    // Azure OpenAI specific errors
    if (error.message?.includes('rate limit') || 
        error.message?.includes('throttled') ||
        error.message?.includes('quota exceeded')) {
      return true;
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log retry attempt
   */
  private static logRetryAttempt(metrics: RetryMetrics): void {
    const logData = {
      level: 'warn',
      message: `Retry attempt ${metrics.attempt}/${metrics.totalAttempts} for ${metrics.action}`,
      properties: {
        userId: metrics.userId,
        action: metrics.action,
        attempt: metrics.attempt,
        totalAttempts: metrics.totalAttempts,
        delay: metrics.delay,
        error: {
          message: metrics.error?.message,
          code: metrics.error?.code,
          status: metrics.error?.response?.status,
          name: metrics.error?.name
        },
        timestamp: new Date().toISOString()
      }
    };

    console.warn('RETRY_ATTEMPT', JSON.stringify(logData));

    // Send to Application Insights
    if (this.appInsights) {
      this.appInsights.trackTrace({
        message: logData.message,
        severityLevel: 2, // Warning
        properties: logData.properties
      });
    }
  }

  /**
   * Log retry success
   */
  private static logRetrySuccess(metrics: RetryMetrics): void {
    const duration = (metrics.endTime || Date.now()) - metrics.startTime;
    
    const logData = {
      level: 'info',
      message: `Retry succeeded for ${metrics.action} after ${metrics.attempt} attempts`,
      properties: {
        userId: metrics.userId,
        action: metrics.action,
        attempt: metrics.attempt,
        totalAttempts: metrics.totalAttempts,
        duration,
        timestamp: new Date().toISOString()
      }
    };

    console.log('RETRY_SUCCESS', JSON.stringify(logData));

    // Send to Application Insights
    if (this.appInsights) {
      this.appInsights.trackTrace({
        message: logData.message,
        severityLevel: 1, // Information
        properties: logData.properties
      });

      // Track custom metric for retry success
      this.appInsights.trackMetric({
        name: 'RetrySuccess',
        average: metrics.attempt,
        sampleCount: 1,
        properties: {
          action: metrics.action,
          userId: metrics.userId || 'unknown'
        }
      });
    }
  }

  /**
   * Log retry failure
   */
  private static logRetryFailure(metrics: RetryMetrics): void {
    const duration = (metrics.endTime || Date.now()) - metrics.startTime;
    
    const logData = {
      level: 'error',
      message: `Retry failed for ${metrics.action} after ${metrics.attempt} attempts`,
      properties: {
        userId: metrics.userId,
        action: metrics.action,
        attempt: metrics.attempt,
        totalAttempts: metrics.totalAttempts,
        duration,
        error: {
          message: metrics.error?.message,
          code: metrics.error?.code,
          status: metrics.error?.response?.status,
          name: metrics.error?.name,
          stack: metrics.error?.stack
        },
        timestamp: new Date().toISOString()
      }
    };

    console.error('RETRY_FAILURE', JSON.stringify(logData));

    // Send to Application Insights
    if (this.appInsights) {
      this.appInsights.trackException({
        exception: metrics.error,
        properties: logData.properties,
        severityLevel: 3 // Error
      });

      // Track custom metric for retry failure
      this.appInsights.trackMetric({
        name: 'RetryFailure',
        average: metrics.attempt,
        sampleCount: 1,
        properties: {
          action: metrics.action,
          userId: metrics.userId || 'unknown'
        }
      });
    }
  }
}

/**
 * Convenience function for common retry scenarios
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  action: string,
  userId?: string,
  options?: Partial<RetryOptions>
): Promise<T> {
  return RetryWithBackoff.execute(fn, {
    action,
    userId,
    ...options
  });
}
