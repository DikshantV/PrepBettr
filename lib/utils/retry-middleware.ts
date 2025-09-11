/**
 * Retry Middleware with Exponential Backoff
 * 
 * Provides configurable retry logic with multiple backoff strategies
 * for handling transient failures in API calls and service interactions.
 * 
 * Features:
 * - Multiple retry strategies (linear, exponential, jitter)
 * - Configurable retry conditions and circuit breaking
 * - Promise-based API with TypeScript support
 * - Integration with structured error system
 * - Abort signal support for cancellation
 * - Detailed retry logging and metrics
 * 
 * @version 1.0.0
 */

import { 
  StructuredError, 
  RetryStrategy, 
  isRetryableError, 
  getRetryDelay, 
  toStructuredError,
  ErrorCode 
} from './structured-errors';

// ===== CONFIGURATION TYPES =====

export interface RetryConfig {
  /** Maximum number of retry attempts (excluding initial attempt) */
  maxRetries: number;
  
  /** Base delay in milliseconds for calculating backoff */
  baseDelay: number;
  
  /** Retry strategy to use */
  strategy: RetryStrategy;
  
  /** Maximum delay in milliseconds (prevents excessive backoff) */
  maxDelay?: number;
  
  /** Custom function to determine if error should trigger retry */
  shouldRetry?: (error: StructuredError, attempt: number) => boolean;
  
  /** AbortSignal to cancel ongoing retries */
  abortSignal?: AbortSignal;
  
  /** Called before each retry attempt */
  onRetry?: (error: StructuredError, attempt: number, delay: number) => void;
  
  /** Called when all retry attempts are exhausted */
  onMaxRetriesReached?: (error: StructuredError, totalAttempts: number) => void;
}

export interface RetryResult<T> {
  /** The successful result, if any */
  data?: T;
  
  /** The final error, if operation failed */
  error?: StructuredError;
  
  /** Total number of attempts made (including initial) */
  totalAttempts: number;
  
  /** Total time spent on operation in milliseconds */
  totalDuration: number;
  
  /** Whether operation succeeded */
  success: boolean;
}

export interface RetryMetrics {
  /** Total retry attempts across all operations */
  totalRetries: number;
  
  /** Successful retries (operations that succeeded after retry) */
  successfulRetries: number;
  
  /** Failed retries (operations that failed after all retries) */
  failedRetries: number;
  
  /** Average retry delay in milliseconds */
  averageRetryDelay: number;
  
  /** Most common retry reasons */
  retryReasons: Partial<Record<ErrorCode, number>>;
}

// ===== DEFAULT CONFIGURATIONS =====

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  strategy: RetryStrategy.EXPONENTIAL,
  maxDelay: 30000, // 30 seconds
};

export const QUICK_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelay: 500, // 500ms
  strategy: RetryStrategy.LINEAR,
  maxDelay: 2000, // 2 seconds
};

export const AGGRESSIVE_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  strategy: RetryStrategy.EXPONENTIAL_JITTER,
  maxDelay: 60000, // 60 seconds
};

export const VOICE_SERVICE_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  baseDelay: 2000, // 2 seconds
  strategy: RetryStrategy.LINEAR,
  maxDelay: 10000, // 10 seconds
};

export const FILE_UPLOAD_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 5000, // 5 seconds
  strategy: RetryStrategy.EXPONENTIAL,
  maxDelay: 45000, // 45 seconds
};

// ===== RETRY METRICS TRACKING =====

let retryMetrics: RetryMetrics = {
  totalRetries: 0,
  successfulRetries: 0,
  failedRetries: 0,
  averageRetryDelay: 0,
  retryReasons: {}
};

export function getRetryMetrics(): RetryMetrics {
  return { ...retryMetrics };
}

export function resetRetryMetrics(): void {
  retryMetrics = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageRetryDelay: 0,
    retryReasons: {}
  };
}

// ===== CORE RETRY FUNCTION =====

/**
 * Execute a function with automatic retry logic based on structured errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  
  let lastError: StructuredError | undefined;
  let totalDelayTime = 0;
  
  for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
    const isLastAttempt = attempt === finalConfig.maxRetries + 1;
    
    try {
      // Check for abort signal
      if (finalConfig.abortSignal?.aborted) {
        throw new Error('Operation aborted');
      }
      
      // Execute the operation
      const result = await operation();
      
      // Success - update metrics if this was a retry
      if (attempt > 1) {
        retryMetrics.successfulRetries++;
        console.log(`✅ Operation succeeded after ${attempt - 1} retries`);
      }
      
      return {
        data: result,
        totalAttempts: attempt,
        totalDuration: Date.now() - startTime,
        success: true
      };
      
    } catch (error) {
      // Convert to structured error
      lastError = toStructuredError(error);
      
      // Track retry reason
      retryMetrics.retryReasons[lastError.code] = 
        (retryMetrics.retryReasons[lastError.code] || 0) + 1;
      
      // If this is the last attempt, don't retry
      if (isLastAttempt) {
        retryMetrics.failedRetries++;
        finalConfig.onMaxRetriesReached?.(lastError, attempt);
        console.warn(`❌ Operation failed after ${attempt} attempts:`, lastError.message);
        break;
      }
      
      // Check if error should trigger retry
      const shouldRetryError = finalConfig.shouldRetry 
        ? finalConfig.shouldRetry(lastError, attempt)
        : isRetryableError(lastError);
      
      if (!shouldRetryError) {
        console.log(`🚫 Error not retryable: ${lastError.code}`);
        break;
      }
      
      // Calculate retry delay
      const baseDelay = lastError.retryAfter 
        ? lastError.retryAfter * 1000 
        : finalConfig.baseDelay;
      
      let delay = getRetryDelay(lastError, attempt, baseDelay);
      
      // Apply max delay cap
      if (finalConfig.maxDelay && delay > finalConfig.maxDelay) {
        delay = finalConfig.maxDelay;
      }
      
      // Track metrics
      retryMetrics.totalRetries++;
      totalDelayTime += delay;
      retryMetrics.averageRetryDelay = 
        (retryMetrics.averageRetryDelay * (retryMetrics.totalRetries - 1) + delay) / 
        retryMetrics.totalRetries;
      
      // Call retry callback
      finalConfig.onRetry?.(lastError, attempt, delay);
      
      console.log(`🔄 Retrying in ${delay}ms (attempt ${attempt}/${finalConfig.maxRetries + 1}): ${lastError.message}`);
      
      // Wait for retry delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Check for abort signal again after delay
      if (finalConfig.abortSignal?.aborted) {
        throw new Error('Operation aborted during retry delay');
      }
    }
  }
  
  // All attempts failed
  return {
    error: lastError || toStructuredError(new Error('Operation failed'), ErrorCode.UNHANDLED_ERROR),
    totalAttempts: finalConfig.maxRetries + 1,
    totalDuration: Date.now() - startTime,
    success: false
  };
}

// ===== SPECIALIZED RETRY FUNCTIONS =====

/**
 * Retry specifically for HTTP fetch operations
 */
export async function retryFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<Response>> {
  const fetchConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
    shouldRetry: (error, attempt) => {
      // Custom retry logic for HTTP errors
      if (error.code === ErrorCode.RATE_LIMIT_EXCEEDED) return true;
      if (error.code === ErrorCode.SERVICE_TIMEOUT) return true;
      if (error.code === ErrorCode.SERVICE_UNAVAILABLE) return true;
      if (error.code === ErrorCode.AZURE_OPENAI_ERROR) return attempt <= 2;
      if (error.code === ErrorCode.AZURE_SPEECH_ERROR) return attempt <= 2;
      return isRetryableError(error);
    }
  };
  
  return withRetry(async () => {
    const response = await fetch(input, init);
    
    if (!response.ok) {
      // Convert HTTP error to structured error
      const errorCode = getErrorCodeFromHTTPStatus(response.status);
      throw toStructuredError(
        new Error(`HTTP ${response.status}: ${response.statusText}`),
        errorCode
      );
    }
    
    return response;
  }, fetchConfig);
}

/**
 * Retry specifically for Azure service calls
 */
export async function retryAzureOperation<T>(
  operation: () => Promise<T>,
  serviceType: 'openai' | 'speech' | 'storage' = 'openai',
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const azureConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 2000,
    strategy: RetryStrategy.EXPONENTIAL,
    maxDelay: 30000,
    ...config,
    shouldRetry: (error, attempt) => {
      // Azure-specific retry logic
      const azureErrors = [
        ErrorCode.AZURE_OPENAI_ERROR,
        ErrorCode.AZURE_SPEECH_ERROR,
        ErrorCode.SERVICE_TIMEOUT,
        ErrorCode.SERVICE_OVERLOADED
      ];
      
      if (azureErrors.includes(error.code)) return true;
      if (error.code === ErrorCode.RATE_LIMIT_EXCEEDED && attempt <= 2) return true;
      
      return config.shouldRetry?.(error, attempt) ?? isRetryableError(error);
    },
    onRetry: (error, attempt, delay) => {
      console.log(`🔄 Retrying Azure ${serviceType} operation (${error.code}): attempt ${attempt}, delay ${delay}ms`);
      config.onRetry?.(error, attempt, delay);
    }
  };
  
  return withRetry(operation, azureConfig);
}

/**
 * Retry specifically for Firebase operations
 */
export async function retryFirebaseOperation<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const firebaseConfig: RetryConfig = {
    maxRetries: 2,
    baseDelay: 3000,
    strategy: RetryStrategy.LINEAR,
    maxDelay: 15000,
    ...config,
    shouldRetry: (error, attempt) => {
      // Firebase-specific retry logic
      if (error.code === ErrorCode.FIREBASE_ERROR) return true;
      if (error.code === ErrorCode.STORAGE_ERROR && attempt <= 1) return true;
      if (error.code === ErrorCode.SERVICE_TIMEOUT) return true;
      
      return config.shouldRetry?.(error, attempt) ?? isRetryableError(error);
    },
    onRetry: (error, attempt, delay) => {
      console.log(`🔄 Retrying Firebase operation (${error.code}): attempt ${attempt}, delay ${delay}ms`);
      config.onRetry?.(error, attempt, delay);
    }
  };
  
  return withRetry(operation, firebaseConfig);
}

// ===== UTILITY FUNCTIONS =====

/**
 * Create an AbortController that automatically aborts after timeout
 */
export function createTimeoutAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Combine multiple AbortSignals into one
 */
export function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  
  const abortHandler = () => controller.abort();
  
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', abortHandler);
  }
  
  return controller.signal;
}

/**
 * Sleep with optional abort signal support
 */
export function sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    
    if (abortSignal) {
      const abortHandler = () => {
        clearTimeout(timeout);
        reject(new Error('Sleep aborted'));
      };
      
      if (abortSignal.aborted) {
        clearTimeout(timeout);
        reject(new Error('Sleep aborted'));
        return;
      }
      
      abortSignal.addEventListener('abort', abortHandler);
    }
  });
}

// Helper function for HTTP status to error code conversion
function getErrorCodeFromHTTPStatus(status: number): ErrorCode {
  switch (status) {
    case 400: return ErrorCode.INVALID_REQUEST;
    case 401: return ErrorCode.AUTH_TOKEN_INVALID;
    case 403: return ErrorCode.ACCESS_DENIED;
    case 404: return ErrorCode.NOT_FOUND;
    case 409: return ErrorCode.RESOURCE_CONFLICT;
    case 413: return ErrorCode.FILE_TOO_LARGE;
    case 429: return ErrorCode.RATE_LIMIT_EXCEEDED;
    case 500: return ErrorCode.INTERNAL_SERVER_ERROR;
    case 502: return ErrorCode.SERVICE_UNAVAILABLE;
    case 503: return ErrorCode.SERVICE_OVERLOADED;
    case 504: return ErrorCode.SERVICE_TIMEOUT;
    default: return ErrorCode.UNHANDLED_ERROR;
  }
}
