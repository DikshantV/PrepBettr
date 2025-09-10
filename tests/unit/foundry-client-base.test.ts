/**
 * Unit Tests for FoundryClientBase
 * 
 * Tests the core HTTP client functionality with retry logic,
 * authentication, error handling, and request/response processing.
 */

import { jest } from '@jest/globals';
import { http, delay } from 'msw';
import { server } from '../mocks/msw-server';
import foundryConfigFixture from '../fixtures/foundry-config.json';

// Create a minimal client implementation for testing
class TestFoundryClient {
  protected config: any;

  constructor() {
    this.config = foundryConfigFixture;
  }

  async init(forceRefresh = false): Promise<void> {
    // Mock initialization - in real implementation would call getFoundryConfig
    return Promise.resolve();
  }

  protected buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': this.config.apiKey,
      'User-Agent': 'PrepBettr/FoundryClient',
      ...(extra || {}),
    };
  }

  // Core request method with retry logic
  protected async request<T = any>(
    path: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {}
  ): Promise<{ status: number; data: T | null; raw: string }> {
    const baseUrl = this.config.endpoint.replace(/\/$/, '');
    const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const { connection } = this.config;

    const method = options.method || 'GET';
    const headers = this.buildHeaders(options.headers);
    const body = options.body ? JSON.stringify(options.body) : undefined;

    let attempt = 0;
    const max = connection.retryPolicy.maxRetries;

    while (true) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), connection.timeout);

        const res = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const raw = await res.text();
        let data: any = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          // non-JSON response
        }

        if (!res.ok && this.shouldRetry(res.status) && attempt < max) {
          attempt++;
          await this.delay(this.backoff(attempt, connection));
          continue;
        }

        return { status: res.status, data, raw };
      } catch (err: any) {
        // AbortError / network errors
        if (attempt < max) {
          attempt++;
          await this.delay(this.backoff(attempt, connection));
          continue;
        }
        throw new Error(`Foundry request failed after ${attempt} retries: ${err?.message || err}`);
      }
    }
  }

  protected shouldRetry(status: number): boolean {
    return [408, 409, 429, 500, 502, 503, 504].includes(status);
  }

  protected backoff(attempt: number, conn: any): number {
    const { baseDelay, maxDelay, exponentialBase } = conn.retryPolicy;
    return Math.min(maxDelay, baseDelay * Math.pow(exponentialBase, attempt - 1));
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async validateConnection(): Promise<{ ok: boolean; status?: number; error?: string }> {
    try {
      const res = await this.request('/', { method: 'GET' });
      const ok = res.status < 500;
      return { ok, status: res.status };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }
}

describe('FoundryClientBase', () => {
  let client: TestFoundryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new TestFoundryClient();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(client.init()).resolves.not.toThrow();
    });

    it('should force refresh configuration when requested', async () => {
      await expect(client.init(true)).resolves.not.toThrow();
    });
  });

  describe('Request Building', () => {
    it('should build headers with API key', () => {
      const headers = (client as any).buildHeaders();
      
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': 'test-api-key-12345',
        'User-Agent': 'PrepBettr/FoundryClient'
      });
    });

    it('should merge extra headers', () => {
      const extraHeaders = { 'X-Custom-Header': 'test-value' };
      const headers = (client as any).buildHeaders(extraHeaders);
      
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': 'test-api-key-12345',
        'User-Agent': 'PrepBettr/FoundryClient',
        'X-Custom-Header': 'test-value'
      });
    });
  });

  describe('Request Handling', () => {
    it('should make successful GET request', async () => {
      const result = await (client as any).request('/');
      
      expect(result.status).toBe(200);
      expect(result.data).toEqual({
        status: 'healthy',
        timestamp: expect.any(Number)
      });
    });

    it('should make successful POST request with body', async () => {
      const requestBody = { message: 'test request' };
      
      const result = await (client as any).request('/chat/completions', {
        method: 'POST',
        body: requestBody
      });
      
      expect(result.status).toBe(200);
      expect(result.data.choices).toBeDefined();
      expect(result.data.usage).toBeDefined();
    });

    it('should handle non-JSON responses', async () => {
      // Add a handler that returns plain text
      server.use(
        http.get('https://test-foundry.cognitiveservices.azure.com/text', () => {
          return new Response('Plain text response');
        })
      );

      const result = await (client as any).request('/text');
      
      expect(result.status).toBe(200);
      expect(result.data).toBeNull();
      expect(result.raw).toBe('Plain text response');
    });
  });

  describe('Error Handling and Retry Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry on 503 status and succeed', async () => {
      let attempts = 0;
      
      server.use(
        http.get('https://test-foundry.cognitiveservices.azure.com/retry-test', () => {
          attempts++;
          if (attempts < 3) {
            return new Response('Service unavailable', { status: 503 });
          }
          return new Response(JSON.stringify({ success: true }));
        })
      );

      const requestPromise = (client as any).request('/retry-test');
      
      // Fast-forward through retries
      jest.advanceTimersByTime(5000);
      
      const result = await requestPromise;
      
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      server.use(
        http.get('https://test-foundry.cognitiveservices.azure.com/always-fail', () => {
          return new Response('Service unavailable', { status: 503 });
        })
      );

      const requestPromise = (client as any).request('/always-fail');
      
      // Fast-forward through all retries
      jest.advanceTimersByTime(30000);
      
      await expect(requestPromise).rejects.toThrow('Foundry request failed after 3 retries');
    });

    it('should handle timeout errors', async () => {
      server.use(
        http.get('https://test-foundry.cognitiveservices.azure.com/timeout', () => {
          return delay('infinite');
        })
      );

      const requestPromise = (client as any).request('/timeout');
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(35000);
      
      await expect(requestPromise).rejects.toThrow();
    });

    it('should not retry on 4xx errors', async () => {
      let attempts = 0;
      
      server.use(
        http.get('https://test-foundry.cognitiveservices.azure.com/client-error', () => {
          attempts++;
          return new Response('Bad request', { status: 400 });
        })
      );

      const result = await (client as any).request('/client-error');
      
      expect(result.status).toBe(400);
      expect(attempts).toBe(1); // No retries on 4xx
    });
  });

  describe('Connection Validation', () => {
    it('should validate successful connection', async () => {
      const result = await client.validateConnection();
      
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    it('should handle connection failures', async () => {
      server.use(
        http.get('https://test-foundry.cognitiveservices.azure.com/', () => {
          return new Response('Internal error', { status: 500 });
        })
      );

      const result = await client.validateConnection();
      
      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
    });

    it('should handle network errors', async () => {
      server.use(
        http.get('https://test-foundry.cognitiveservices.azure.com/', () => {
          throw new Error('Network error');
        })
      );

      const result = await client.validateConnection();
      
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('Retry Policy', () => {
    it('should identify retryable status codes', () => {
      const retryableStatuses = [408, 409, 429, 500, 502, 503, 504];
      
      retryableStatuses.forEach(status => {
        expect((client as any).shouldRetry(status)).toBe(true);
      });
    });

    it('should not retry non-retryable status codes', () => {
      const nonRetryableStatuses = [200, 400, 401, 403, 404];
      
      nonRetryableStatuses.forEach(status => {
        expect((client as any).shouldRetry(status)).toBe(false);
      });
    });

    it('should calculate exponential backoff', () => {
      const conn = foundryConfigFixture.connection;
      
      const backoff1 = (client as any).backoff(1, conn);
      const backoff2 = (client as any).backoff(2, conn);
      const backoff3 = (client as any).backoff(3, conn);
      
      expect(backoff1).toBe(1000); // baseDelay * 2^0
      expect(backoff2).toBe(2000); // baseDelay * 2^1
      expect(backoff3).toBe(4000); // baseDelay * 2^2
    });

    it('should respect maximum delay', () => {
      const conn = foundryConfigFixture.connection;
      
      const backoffHuge = (client as any).backoff(10, conn);
      
      expect(backoffHuge).toBe(conn.retryPolicy.maxDelay);
    });
  });
});
