import fetch from 'node-fetch';
import {
  getFoundryConfig,
  validateFoundryConfig,
  type FoundryConfig,
  type ConnectionSettings,
} from '../config/foundry-config';

/**
 * FoundryClientBase
 * - Initializes configuration
 * - Provides unified request handling with retries and timeouts
 * - Adds auth headers
 * - Connection validation
 */
export class FoundryClientBase {
  protected config!: FoundryConfig;

  constructor() {}

  /**
   * Initialize configuration
   */
  async init(forceRefresh = false): Promise<void> {
    this.config = await getFoundryConfig(forceRefresh);
    const { isValid, errors } = validateFoundryConfig(this.config);
    if (!isValid) {
      throw new Error(`Invalid Foundry configuration: ${errors.join(', ')}`);
    }
  }

  /**
   * Build default headers with API key
   */
  protected buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': this.config.apiKey,
      'User-Agent': 'PrepBettr/FoundryClient',
      ...(extra || {}),
    };
  }

  /**
   * Core request helper with retry logic based on connection settings
   */
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
    const start = Date.now();

    while (true) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), connection.timeout);

        const res = await fetch(url, {
          method,
          headers,
          body,
          // @ts-ignore node-fetch v2 compatibility
          signal: controller.signal,
        } as any);

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
      } finally {
        // Optional: log slow requests
        const elapsed = Date.now() - start;
        if (elapsed > Math.max(2000, this.config.connection.timeout)) {
          // eslint-disable-next-line no-console
          console.warn(`[FoundryClient] Slow request ${method} ${url} took ${elapsed}ms`);
        }
      }
    }
  }

  /**
   * Basic retry policy on transient status codes
   */
  protected shouldRetry(status: number): boolean {
    return [408, 409, 429, 500, 502, 503, 504].includes(status);
  }

  /**
   * Exponential backoff with optional jitter
   */
  protected backoff(attempt: number, conn: ConnectionSettings): number {
    const { baseDelay, maxDelay, exponentialBase, jitter } = conn.retryPolicy;
    const delay = Math.min(maxDelay, baseDelay * Math.pow(exponentialBase, attempt - 1));
    return jitter ? Math.floor(Math.random() * delay) : delay;
    }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate connectivity to Foundry endpoint
   */
  async validateConnection(): Promise<{ ok: boolean; status?: number; error?: string }>
  {
    if (!this.config) await this.init();
    try {
      const res = await this.request('/', { method: 'GET' });
      // Root might be 404 but still proves connectivity
      const ok = res.status < 500;
      return { ok, status: res.status };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  /**
   * Placeholder for text completion call via model inference.
   * Implement with specific Foundry Inference API once finalized.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async completeText(_prompt: string, _modelKey = 'gpt-4o'): Promise<string> {
    throw new Error('completeText not implemented yet for Foundry Inference API');
  }
}

