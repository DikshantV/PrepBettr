/**
 * Unit Tests for FoundryClientBase
 * 
 * Comprehensive test suite covering connection management, retry logic,
 * authentication, error handling, and request/response processing.
 * 
 * @version 2.0.0
 */

import { jest } from '@jest/globals';
import { FoundryClientBase } from '@/lib/azure-ai-foundry/clients/foundry-client';
import { 
  MOCK_FOUNDRY_CONFIG, 
  ERROR_SCENARIOS, 
  PERFORMANCE_THRESHOLDS,
  TEST_ENV_SETUP 
} from '../../utils/foundry-fixtures';
import { validateFoundryConfig } from '@/lib/azure-ai-foundry/config/foundry-config';

// Mock node-fetch
const mockFetch = jest.fn();
jest.mock('node-fetch', () => mockFetch);

// Mock foundry config
jest.mock('@/lib/azure-ai-foundry/config/foundry-config', () => ({
  getFoundryConfig: jest.fn(),
  validateFoundryConfig: jest.fn(),
  clearFoundryConfigCache: jest.fn()
}));

const mockGetFoundryConfig = jest.mocked(require('@/lib/azure-ai-foundry/config/foundry-config').getFoundryConfig);
const mockValidateFoundryConfig = jest.mocked(validateFoundryConfig);

describe('FoundryClientBase', () => {
  let client: FoundryClientBase;
  let mockAbortController: jest.Mocked<AbortController>;
  let originalSetTimeout: typeof setTimeout;
  let originalClearTimeout: typeof clearTimeout;

  beforeAll(() => {
    TEST_ENV_SETUP.setupMockEnvironment();
    
    // Mock AbortController
    mockAbortController = {
      abort: jest.fn(),
      signal: { 
        aborted: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      } as any
    };
    global.AbortController = jest.fn(() => mockAbortController);

    // Store original timer functions
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup default mocks
    mockGetFoundryConfig.mockResolvedValue(MOCK_FOUNDRY_CONFIG);
    mockValidateFoundryConfig.mockReturnValue({ isValid: true, errors: [] });
    
    client = new FoundryClientBase();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    TEST_ENV_SETUP.cleanupMockEnvironment();
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  describe('Initialization', () => {
    it('should initialize with valid configuration', async () => {
      await client.init();
      
      expect(mockGetFoundryConfig).toHaveBeenCalledWith(false);
      expect(mockValidateFoundryConfig).toHaveBeenCalledWith(MOCK_FOUNDRY_CONFIG);
    });

    it('should force refresh configuration when requested', async () => {
      await client.init(true);
      
      expect(mockGetFoundryConfig).toHaveBeenCalledWith(true);
    });

    it('should throw error with invalid configuration', async () => {
      mockValidateFoundryConfig.mockReturnValue({
        isValid: false,
        errors: ['Missing API key', 'Invalid endpoint']
      });

      await expect(client.init()).rejects.toThrow(
        'Invalid Foundry configuration: Missing API key, Invalid endpoint'
      );
    });

    it('should handle configuration loading failures', async () => {
      const configError = new Error('Failed to load configuration');
      mockGetFoundryConfig.mockRejectedValue(configError);

      await expect(client.init()).rejects.toThrow('Failed to load configuration');
    });
  });

  describe('Request Building', () => {
    beforeEach(async () => {
      await client.init();
    });

    it('should build headers with API key', () => {
      const headers = (client as any).buildHeaders();
      
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': MOCK_FOUNDRY_CONFIG.apiKey,
        'User-Agent': 'PrepBettr/FoundryClient'
      });
    });

    it('should merge extra headers', () => {
      const extraHeaders = { 'X-Custom-Header': 'test-value' };
      const headers = (client as any).buildHeaders(extraHeaders);
      
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': MOCK_FOUNDRY_CONFIG.apiKey,
        'User-Agent': 'PrepBettr/FoundryClient',
        'X-Custom-Header': 'test-value'
      });
    });
  });

  describe('Request Handling', () => {
    beforeEach(async () => {
      await client.init();
    });

    it('should make successful GET request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"success": true}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (client as any).request('/test-endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-foundry.cognitiveservices.azure.com/test-endpoint',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': MOCK_FOUNDRY_CONFIG.apiKey
          })
        })
      );

      expect(result).toEqual({
        status: 200,
        data: { success: true },
        raw: '{"success": true}'
      });
    });

    it('should make successful POST request with body', async () => {
      const requestBody = { message: 'test request' };
      const mockResponse = {
        ok: true,
        status: 201,
        text: jest.fn().mockResolvedValue('{"created": true}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (client as any).request('/create-endpoint', {
        method: 'POST',
        body: requestBody
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-foundry.cognitiveservices.azure.com/create-endpoint',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );

      expect(result.data).toEqual({ created: true });
    });

    it('should handle non-JSON responses gracefully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('plain text response')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (client as any).request('/text-endpoint');

      expect(result).toEqual({
        status: 200,
        data: null,
        raw: 'plain text response'
      });
    });
  });

  describe('Retry Logic', () => {
    beforeEach(async () => {
      await client.init();
    });

    it('should retry on transient errors', async () => {
      // First call fails with 503, second succeeds
      const mockErrorResponse = { ok: false, status: 503, text: jest.fn().mockResolvedValue('Service Unavailable') };
      const mockSuccessResponse = { ok: true, status: 200, text: jest.fn().mockResolvedValue('{"success": true}') };
      
      mockFetch
        .mockResolvedValueOnce(mockErrorResponse)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await (client as any).request('/retry-test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ success: true });
    });

    it('should respect maximum retry attempts', async () => {
      const mockErrorResponse = { 
        ok: false, 
        status: 503, 
        text: jest.fn().mockResolvedValue('Service Unavailable') 
      };
      mockFetch.mockResolvedValue(mockErrorResponse);

      // Fast-forward timers for retry delays
      const requestPromise = (client as any).request('/always-fail');
      
      // Advance through all retry delays
      for (let i = 0; i < MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries; i++) {
        await jest.advanceTimersByTimeAsync(MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxDelay);
      }

      const result = await requestPromise;

      expect(mockFetch).toHaveBeenCalledTimes(MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries + 1);
      expect(result.status).toBe(503);
    });

    it('should not retry on non-retryable errors', async () => {
      const mockErrorResponse = { 
        ok: false, 
        status: 400, 
        text: jest.fn().mockResolvedValue('Bad Request') 
      };
      mockFetch.mockResolvedValue(mockErrorResponse);

      const result = await (client as any).request('/bad-request');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(400);
    });

    it('should implement exponential backoff with jitter', async () => {
      const mockErrorResponse = { 
        ok: false, 
        status: 503, 
        text: jest.fn().mockResolvedValue('Service Unavailable') 
      };
      mockFetch.mockResolvedValue(mockErrorResponse);

      // Mock Math.random for consistent jitter testing
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.5);

      const backoffSpy = jest.spyOn(client as any, 'backoff');
      const delaySpy = jest.spyOn(client as any, 'delay');

      const requestPromise = (client as any).request('/backoff-test');

      // Advance through retry attempts
      for (let attempt = 1; attempt <= MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries; attempt++) {
        await jest.advanceTimersByTimeAsync(10000); // Advance past max delay
      }

      await requestPromise;

      // Verify backoff was called for each retry attempt
      expect(backoffSpy).toHaveBeenCalledTimes(MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries);
      expect(delaySpy).toHaveBeenCalledTimes(MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries);

      // Restore Math.random
      Math.random = originalRandom;
      backoffSpy.mockRestore();
      delaySpy.mockRestore();
    });
  });

  describe('Timeout Handling', () => {
    beforeEach(async () => {
      await client.init();
    });

    it('should timeout requests that take too long', async () => {
      // Mock fetch to never resolve (simulating slow request)
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const requestPromise = (client as any).request('/slow-endpoint');
      
      // Advance time past timeout
      await jest.advanceTimersByTimeAsync(MOCK_FOUNDRY_CONFIG.connection.timeout + 1000);

      await expect(requestPromise).rejects.toThrow(/Foundry request failed after/);
      expect(mockAbortController.abort).toHaveBeenCalled();
    });

    it('should clear timeout on successful response', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"success": true}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      await (client as any).request('/fast-endpoint');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe('Network Error Handling', () => {
    beforeEach(async () => {
      await client.init();
    });

    ERROR_SCENARIOS.NETWORK_ERRORS.forEach((errorScenario) => {
      it(`should handle ${errorScenario.code} network error`, async () => {
        const networkError = new Error(errorScenario.message);
        (networkError as any).code = errorScenario.code;
        mockFetch.mockRejectedValue(networkError);

        await expect((client as any).request('/network-error')).rejects.toThrow(
          /Foundry request failed after/
        );

        expect(mockFetch).toHaveBeenCalledTimes(
          MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries + 1
        );
      });
    });

    it('should retry network errors until max attempts', async () => {
      const networkError = new Error('ECONNRESET');
      mockFetch.mockRejectedValue(networkError);

      const requestPromise = (client as any).request('/network-retry-test');
      
      // Advance through all retry delays
      for (let i = 0; i < MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries; i++) {
        await jest.advanceTimersByTimeAsync(MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxDelay);
      }

      await expect(requestPromise).rejects.toThrow(/Foundry request failed after/);
      expect(mockFetch).toHaveBeenCalledTimes(MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries + 1);
    });
  });

  describe('Connection Validation', () => {
    beforeEach(async () => {
      await client.init();
    });

    it('should validate successful connection', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"status": "healthy"}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.validateConnection();

      expect(result).toEqual({
        ok: true,
        status: 200
      });
    });

    it('should handle 404 as valid connection (service available)', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('Not Found')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.validateConnection();

      expect(result).toEqual({
        ok: true,
        status: 404
      });
    });

    it('should detect server errors as invalid connection', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error')
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.validateConnection();

      expect(result).toEqual({
        ok: false,
        status: 500
      });
    });

    it('should handle network failures during validation', async () => {
      const networkError = new Error('Connection refused');
      mockFetch.mockRejectedValue(networkError);

      const result = await client.validateConnection();

      expect(result).toEqual({
        ok: false,
        error: 'Connection refused'
      });
    });

    it('should auto-initialize if not already initialized', async () => {
      const uninitializedClient = new FoundryClientBase();
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"status": "ok"}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      await uninitializedClient.validateConnection();

      expect(mockGetFoundryConfig).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await client.init();
    });

    it('should log slow requests', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock a slow response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              text: jest.fn().mockResolvedValue('{"data": "slow response"}')
            });
          }, PERFORMANCE_THRESHOLDS.MODEL_MANAGER.CONFIG_LOAD_TIME + 1000);
        })
      );

      const requestPromise = (client as any).request('/slow-request');
      await jest.advanceTimersByTimeAsync(PERFORMANCE_THRESHOLDS.MODEL_MANAGER.CONFIG_LOAD_TIME + 2000);
      await requestPromise;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FoundryClient] Slow request')
      );

      consoleSpy.mockRestore();
    });

    it('should not log fast requests', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"data": "fast response"}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      await (client as any).request('/fast-request');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('URL Construction', () => {
    beforeEach(async () => {
      await client.init();
    });

    it('should construct URLs correctly with leading slash', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      await (client as any).request('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-foundry.cognitiveservices.azure.com/api/test',
        expect.any(Object)
      );
    });

    it('should construct URLs correctly without leading slash', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      await (client as any).request('api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-foundry.cognitiveservices.azure.com/api/test',
        expect.any(Object)
      );
    });

    it('should handle endpoint with trailing slash', async () => {
      // Mock config with trailing slash
      const configWithTrailingSlash = {
        ...MOCK_FOUNDRY_CONFIG,
        endpoint: 'https://test-foundry.cognitiveservices.azure.com/'
      };
      mockGetFoundryConfig.mockResolvedValue(configWithTrailingSlash);

      const trailingSlashClient = new FoundryClientBase();
      await trailingSlashClient.init();

      const mockResponse = {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      await (trailingSlashClient as any).request('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-foundry.cognitiveservices.azure.com/api/test',
        expect.any(Object)
      );
    });
  });

  describe('Text Completion (Placeholder)', () => {
    beforeEach(async () => {
      await client.init();
    });

    it('should throw not implemented error for text completion', async () => {
      await expect(client.completeText('test prompt')).rejects.toThrow(
        'completeText not implemented yet for Foundry Inference API'
      );
    });

    it('should throw not implemented error for text completion with custom model', async () => {
      await expect(client.completeText('test prompt', 'custom-model')).rejects.toThrow(
        'completeText not implemented yet for Foundry Inference API'
      );
    });
  });

  describe('Error Message Handling', () => {
    beforeEach(async () => {
      await client.init();
    });

    it('should preserve error details in retry failures', async () => {
      const detailedError = new Error('Detailed network failure');
      (detailedError as any).code = 'ECONNREFUSED';
      (detailedError as any).errno = -61;
      mockFetch.mockRejectedValue(detailedError);

      const requestPromise = (client as any).request('/error-detail-test');
      
      // Skip retry delays
      for (let i = 0; i < MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries; i++) {
        await jest.advanceTimersByTimeAsync(MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxDelay);
      }

      await expect(requestPromise).rejects.toThrow(
        expect.stringContaining('Detailed network failure')
      );
    });

    it('should handle string errors gracefully', async () => {
      mockFetch.mockRejectedValue('String error message');

      const requestPromise = (client as any).request('/string-error-test');
      
      // Skip retry delays
      for (let i = 0; i < MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxRetries; i++) {
        await jest.advanceTimersByTimeAsync(MOCK_FOUNDRY_CONFIG.connection.retryPolicy.maxDelay);
      }

      await expect(requestPromise).rejects.toThrow(
        expect.stringContaining('String error message')
      );
    });
  });
});
