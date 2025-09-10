/**
 * Unit Tests for Structured Error Handling and Retry Middleware
 * 
 * Tests the structured error system, retry middleware functionality,
 * and client-side retry hooks to ensure robust error handling.
 * 
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorCode,
  ErrorCategory,
  RetryStrategy,
  createStructuredError,
  createErrorResponse,
  createSuccessResponse,
  getHTTPStatusFromErrorCode,
  getErrorCodeFromHTTPStatus,
  isRetryableError,
  getRetryDelay,
  toStructuredError
} from '@/lib/utils/structured-errors';

import {
  withRetry,
  retryFetch,
  retryAzureOperation,
  retryFirebaseOperation,
  getRetryMetrics,
  resetRetryMetrics,
  DEFAULT_RETRY_CONFIG,
  QUICK_RETRY_CONFIG,
  VOICE_SERVICE_RETRY_CONFIG
} from '@/lib/utils/retry-middleware';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods to avoid noise in tests
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};
vi.stubGlobal('console', mockConsole);

describe('Structured Error System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Creation', () => {
    it('should create structured error with all properties', () => {
      const error = createStructuredError(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        { retryAfter: 60 },
        'Custom message'
      );

      expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(error.message).toBe('Custom message');
      expect(error.details).toEqual({ retryAfter: 60 });
      expect(error.retryable).toBe(true);
      expect(error.retryStrategy).toBe(RetryStrategy.EXPONENTIAL);
      expect(error.timestamp).toBeDefined();
    });

    it('should create API error response', () => {
      const response = createErrorResponse(ErrorCode.AUTH_TOKEN_INVALID);
      
      expect(response.success).toBe(false);
      expect(response.data).toBeNull();
      expect(response.error.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
      expect(response.error.category).toBe(ErrorCategory.AUTHENTICATION);
    });

    it('should create API success response', () => {
      const data = { message: 'Success' };
      const response = createSuccessResponse(data);
      
      expect(response.success).toBe(true);
      expect(response.error).toBeNull();
      expect(response.data).toEqual(data);
    });
  });

  describe('HTTP Status Mapping', () => {
    it('should map error codes to HTTP status', () => {
      expect(getHTTPStatusFromErrorCode(ErrorCode.AUTH_TOKEN_INVALID)).toBe(401);
      expect(getHTTPStatusFromErrorCode(ErrorCode.ACCESS_DENIED)).toBe(403);
      expect(getHTTPStatusFromErrorCode(ErrorCode.NOT_FOUND)).toBe(404);
      expect(getHTTPStatusFromErrorCode(ErrorCode.RATE_LIMIT_EXCEEDED)).toBe(429);
      expect(getHTTPStatusFromErrorCode(ErrorCode.INTERNAL_SERVER_ERROR)).toBe(500);
    });

    it('should map HTTP status to error codes', () => {
      expect(getErrorCodeFromHTTPStatus(400)).toBe(ErrorCode.INVALID_REQUEST);
      expect(getErrorCodeFromHTTPStatus(401)).toBe(ErrorCode.AUTH_TOKEN_INVALID);
      expect(getErrorCodeFromHTTPStatus(404)).toBe(ErrorCode.NOT_FOUND);
      expect(getErrorCodeFromHTTPStatus(429)).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(getErrorCodeFromHTTPStatus(500)).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    });
  });

  describe('Retry Logic', () => {
    it('should identify retryable errors', () => {
      const retryableError = createStructuredError(ErrorCode.RATE_LIMIT_EXCEEDED);
      const nonRetryableError = createStructuredError(ErrorCode.AUTH_TOKEN_INVALID);
      
      expect(isRetryableError(retryableError)).toBe(true);
      expect(isRetryableError(nonRetryableError)).toBe(false);
    });

    it('should calculate retry delays correctly', () => {
      const error = createStructuredError(ErrorCode.SERVICE_TIMEOUT);
      
      expect(getRetryDelay(error, 1)).toBe(10000); // Base delay: 10s
      expect(getRetryDelay(error, 2)).toBe(10000); // Linear strategy
      expect(getRetryDelay(error, 3)).toBe(10000); // Linear strategy
    });

    it('should calculate exponential backoff correctly', () => {
      const error = createStructuredError(ErrorCode.AZURE_OPENAI_ERROR);
      
      expect(getRetryDelay(error, 1)).toBe(5000);  // 5s * 2^0
      expect(getRetryDelay(error, 2)).toBe(10000); // 5s * 2^1
      expect(getRetryDelay(error, 3)).toBe(20000); // 5s * 2^2
    });
  });

  describe('Error Conversion', () => {
    it('should convert Error to structured error', () => {
      const originalError = new Error('Test error');
      const structured = toStructuredError(originalError);
      
      expect(structured.code).toBe(ErrorCode.UNHANDLED_ERROR);
      expect(structured.message).toBe('Test error');
      expect(structured.details?.originalMessage).toBe('Test error');
    });

    it('should handle non-Error objects', () => {
      const structured = toStructuredError('String error');
      
      expect(structured.code).toBe(ErrorCode.UNHANDLED_ERROR);
      expect(structured.message).toBe('String error');
    });

    it('should pass through existing structured errors', () => {
      const original = createStructuredError(ErrorCode.RATE_LIMIT_EXCEEDED);
      const converted = toStructuredError(original);
      
      expect(converted).toBe(original);
    });
  });
});

describe('Retry Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRetryMetrics();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Retry Logic', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await withRetry(operation, { maxRetries: 2 });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.totalAttempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const retryableError = createStructuredError(ErrorCode.SERVICE_TIMEOUT);
      const operation = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');
      
      vi.useFakeTimers();
      
      const resultPromise = withRetry(operation, { 
        maxRetries: 2, 
        baseDelay: 100 
      });
      
      // Fast-forward time
      await vi.advanceTimersByTimeAsync(200);
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.totalAttempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = createStructuredError(ErrorCode.AUTH_TOKEN_INVALID);
      const operation = vi.fn().mockRejectedValue(nonRetryableError);
      
      const result = await withRetry(operation, { maxRetries: 2 });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(nonRetryableError);
      expect(result.totalAttempts).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and fail', async () => {
      const retryableError = createStructuredError(ErrorCode.SERVICE_TIMEOUT);
      const operation = vi.fn().mockRejectedValue(retryableError);
      
      vi.useFakeTimers();
      
      const resultPromise = withRetry(operation, { 
        maxRetries: 2, 
        baseDelay: 50 
      });
      
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error).toBe(retryableError);
      expect(result.totalAttempts).toBe(3); // 1 initial + 2 retries
      expect(operation).toHaveBeenCalledTimes(3);
      
      vi.useRealTimers();
    });
  });

  describe('Abort Signal Support', () => {
    it('should abort operation on signal', async () => {
      const controller = new AbortController();
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      vi.useFakeTimers();
      
      const resultPromise = withRetry(operation, {
        abortSignal: controller.signal,
        maxRetries: 2
      });
      
      // Abort after 100ms
      setTimeout(() => controller.abort(), 100);
      
      await vi.advanceTimersByTimeAsync(200);
      
      try {
        await resultPromise;
        expect.fail('Should have thrown abort error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('abort');
      }
      
      vi.useRealTimers();
    });
  });

  describe('Custom Retry Logic', () => {
    it('should use custom shouldRetry function', async () => {
      const customError = createStructuredError(ErrorCode.INTERNAL_SERVER_ERROR);
      const operation = vi.fn().mockRejectedValue(customError);
      const shouldRetry = vi.fn().mockReturnValue(false);
      
      const result = await withRetry(operation, {
        maxRetries: 3,
        shouldRetry
      });
      
      expect(result.success).toBe(false);
      expect(result.totalAttempts).toBe(1);
      expect(shouldRetry).toHaveBeenCalledWith(customError, 1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should call retry callbacks', async () => {
      const retryableError = createStructuredError(ErrorCode.SERVICE_TIMEOUT);
      const operation = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');
      
      const onRetry = vi.fn();
      const onMaxRetriesReached = vi.fn();
      
      vi.useFakeTimers();
      
      const resultPromise = withRetry(operation, {
        maxRetries: 2,
        baseDelay: 50,
        onRetry,
        onMaxRetriesReached
      });
      
      await vi.advanceTimersByTimeAsync(100);
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(onRetry).toHaveBeenCalledWith(retryableError, 1, expect.any(Number));
      expect(onMaxRetriesReached).not.toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('Specialized Retry Functions', () => {
    it('should retry fetch operations', async () => {
      const mockResponse = new Response('{"success": true}', { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);
      
      const result = await retryFetch('/api/test', {}, { maxRetries: 1 });
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(mockResponse);
    });

    it('should handle fetch HTTP errors', async () => {
      mockFetch.mockResolvedValue(new Response('Server Error', { 
        status: 503,
        statusText: 'Service Unavailable'
      }));
      
      vi.useFakeTimers();
      
      const resultPromise = retryFetch('/api/test', {}, { 
        maxRetries: 1,
        baseDelay: 100
      });
      
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SERVICE_OVERLOADED);
      
      vi.useRealTimers();
    });

    it('should retry Azure operations with service-specific config', async () => {
      const azureError = new Error('Azure OpenAI rate limit');
      const operation = vi.fn()
        .mockRejectedValueOnce(azureError)
        .mockResolvedValue('azure-success');
      
      vi.useFakeTimers();
      
      const resultPromise = retryAzureOperation(operation, 'openai');
      
      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('azure-success');
      expect(operation).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it('should retry Firebase operations with linear backoff', async () => {
      const firebaseError = createStructuredError(ErrorCode.FIREBASE_ERROR);
      const operation = vi.fn()
        .mockRejectedValueOnce(firebaseError)
        .mockResolvedValue('firebase-success');
      
      vi.useFakeTimers();
      
      const resultPromise = retryFirebaseOperation(operation);
      
      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('firebase-success');
      
      vi.useRealTimers();
    });
  });

  describe('Retry Metrics', () => {
    it('should track retry metrics', async () => {
      const retryableError = createStructuredError(ErrorCode.SERVICE_TIMEOUT);
      const operation = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue('success');
      
      vi.useFakeTimers();
      
      resetRetryMetrics();
      
      const resultPromise = withRetry(operation, { 
        maxRetries: 2, 
        baseDelay: 100 
      });
      
      await vi.advanceTimersByTimeAsync(200);
      await resultPromise;
      
      const metrics = getRetryMetrics();
      
      expect(metrics.totalRetries).toBe(1);
      expect(metrics.successfulRetries).toBe(1);
      expect(metrics.failedRetries).toBe(0);
      expect(metrics.retryReasons[ErrorCode.SERVICE_TIMEOUT]).toBe(1);
      
      vi.useRealTimers();
    });

    it('should track failed retries', async () => {
      const retryableError = createStructuredError(ErrorCode.RATE_LIMIT_EXCEEDED);
      const operation = vi.fn().mockRejectedValue(retryableError);
      
      vi.useFakeTimers();
      
      resetRetryMetrics();
      
      const resultPromise = withRetry(operation, { 
        maxRetries: 1, 
        baseDelay: 50 
      });
      
      await vi.advanceTimersByTimeAsync(200);
      await resultPromise;
      
      const metrics = getRetryMetrics();
      
      expect(metrics.totalRetries).toBe(1);
      expect(metrics.successfulRetries).toBe(0);
      expect(metrics.failedRetries).toBe(1);
      expect(metrics.retryReasons[ErrorCode.RATE_LIMIT_EXCEEDED]).toBe(2); // Initial + 1 retry
      
      vi.useRealTimers();
    });
  });

  describe('Retry Configurations', () => {
    it('should use default retry config', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.strategy).toBe(RetryStrategy.EXPONENTIAL);
      expect(DEFAULT_RETRY_CONFIG.baseDelay).toBe(1000);
    });

    it('should use voice service config', () => {
      expect(VOICE_SERVICE_RETRY_CONFIG.maxRetries).toBe(2);
      expect(VOICE_SERVICE_RETRY_CONFIG.strategy).toBe(RetryStrategy.LINEAR);
      expect(VOICE_SERVICE_RETRY_CONFIG.baseDelay).toBe(2000);
    });

    it('should use quick retry config', () => {
      expect(QUICK_RETRY_CONFIG.maxRetries).toBe(2);
      expect(QUICK_RETRY_CONFIG.baseDelay).toBe(500);
      expect(QUICK_RETRY_CONFIG.maxDelay).toBe(2000);
    });
  });
});

describe('Error Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRetryMetrics();
  });

  it('should handle end-to-end error flow', async () => {
    // Simulate API call that fails with rate limit then succeeds
    const rateLimitError = createStructuredError(ErrorCode.RATE_LIMIT_EXCEEDED);
    const mockOperation = vi.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue({ data: 'success' });
    
    vi.useFakeTimers();
    
    const resultPromise = withRetry(mockOperation, {
      maxRetries: 3,
      baseDelay: 1000,
      onRetry: (error, attempt, delay) => {
        expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
        expect(error.retryable).toBe(true);
        expect(delay).toBeGreaterThan(0);
      }
    });
    
    // Advance timers to allow retry
    await vi.advanceTimersByTimeAsync(2000);
    
    const result = await resultPromise;
    
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ data: 'success' });
    expect(result.totalAttempts).toBe(2);
    
    // Check metrics
    const metrics = getRetryMetrics();
    expect(metrics.successfulRetries).toBe(1);
    expect(metrics.retryReasons[ErrorCode.RATE_LIMIT_EXCEEDED]).toBe(1);
    
    vi.useRealTimers();
  });

  it('should handle non-retryable error correctly', async () => {
    const authError = createStructuredError(ErrorCode.AUTH_TOKEN_INVALID);
    const mockOperation = vi.fn().mockRejectedValue(authError);
    
    const result = await withRetry(mockOperation, {
      maxRetries: 3,
      onMaxRetriesReached: vi.fn() // Should not be called
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBe(authError);
    expect(result.totalAttempts).toBe(1); // No retries for non-retryable error
    expect(mockOperation).toHaveBeenCalledTimes(1);
    
    const metrics = getRetryMetrics();
    expect(metrics.totalRetries).toBe(0); // No retries attempted
  });
});
