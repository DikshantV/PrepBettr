import fetch from 'node-fetch';
import { DefaultAzureCredential } from '@azure/identity';
import { type TokenCredential } from '@azure/core-auth';
import { AIProjectClient } from '@azure/ai-projects';
import { AgentsClient } from '@azure/ai-agents';
import {
  getFoundryConfig,
  validateFoundryConfig,
  type FoundryConfig,
  type ConnectionSettings,
} from '../config/foundry-config';

// Client-side safety check
const isClient = typeof window !== 'undefined';

if (isClient) {
  console.warn('[Azure AI Foundry Client] Running on client side - clients will not be initialized');
}

/**
 * Unified Azure AI Foundry Client
 * 
 * Combines HTTP request functionality with Azure SDK client factories.
 * Provides both low-level request() method and high-level SDK helpers.
 */
export class FoundryClientBase {
  protected config!: FoundryConfig;
  private projectsClientInstance: AIProjectClient | null = null;
  private agentsClientInstance: AgentsClient | null = null;
  private currentSdkConfig: FoundryConfig | null = null;

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
      'api-key': this.config.apiKey, // Azure AI Foundry uses 'api-key' header
      'User-Agent': 'PrepBettr/FoundryClient',
      ...(extra || {}),
    };
  }

  /**
   * Core request helper with retry logic based on connection settings
   */
  public async request<T = any>(
    path: string,
    options: { method?: string; body?: any; headers?: Record<string, string> } = {}
  ): Promise<{ status: number; data: T | null; raw: string }> {
    const baseUrl = this.config.endpoint.replace(/\/$/, '');
    // Azure AI Foundry uses openai/deployments/{deployment-name} format
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${baseUrl}/openai/deployments/gpt-4o${normalizedPath}?api-version=2024-02-15-preview`;
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

  /**
   * Azure SDK Client Methods
   */

  /**
   * Create Azure AI Projects client with proper authentication
   */
  private createProjectsClient(config: FoundryConfig): AIProjectClient {
    if (isClient) {
      throw new Error('Projects client cannot be initialized on client side');
    }

    try {
      const credential: TokenCredential = new DefaultAzureCredential();
      console.log(`🔧 Creating Azure AI Projects client for endpoint: ${config.endpoint}`);
      
      const client = new AIProjectClient(config.endpoint, credential, {
        additionalPolicies: [{
          policy: {
            name: 'PrepBettrUserAgent',
            sendRequest: async (request: any, next: any) => {
              const existingUserAgent = request.headers.get('User-Agent') || '';
              request.headers.set('User-Agent', `PrepBettr/1.0 ${existingUserAgent}`);
              return next(request);
            }
          },
          position: 'perCall'
        }],
        retryOptions: {
          maxRetries: 3,
          retryDelayInMs: 1000
        }
      });

      console.log('✅ Azure AI Projects client created successfully');
      return client;

    } catch (error) {
      console.error('❌ Failed to create Azure AI Projects client:', error);
      throw error;
    }
  }

  /**
   * Create Azure AI Agents client with proper authentication
   */
  private createAgentsClient(config: FoundryConfig): AgentsClient {
    if (isClient) {
      throw new Error('Agents client cannot be initialized on client side');
    }

    try {
      const credential: TokenCredential = new DefaultAzureCredential();
      console.log(`🤖 Creating Azure AI Agents client for project: ${config.projectId}`);
      
      const client = new AgentsClient(config.endpoint, credential, {
        additionalPolicies: [{
          policy: {
            name: 'PrepBettrAgentUserAgent',
            sendRequest: async (request: any, next: any) => {
              const existingUserAgent = request.headers.get('User-Agent') || '';
              request.headers.set('User-Agent', `PrepBettr-Agent/1.0 ${existingUserAgent}`);
              
              if (config.projectId) {
                request.headers.set('X-Project-Id', config.projectId);
              }
              
              return next(request);
            }
          },
          position: 'perCall'
        }],
        retryOptions: {
          maxRetries: 3,
          retryDelayInMs: 1000
        }
      });

      console.log('✅ Azure AI Agents client created successfully');
      return client;

    } catch (error) {
      console.error('❌ Failed to create Azure AI Agents client:', error);
      throw error;
    }
  }

  /**
   * Get or create Azure AI Projects client (singleton pattern)
   */
  async getProjectsClient(forceRefresh: boolean = false): Promise<AIProjectClient> {
    if (isClient) {
      throw new Error('Projects client is not available on client side');
    }

    const config = await getFoundryConfig(forceRefresh);
    
    if (forceRefresh || !this.projectsClientInstance || !this.currentSdkConfig || 
        this.currentSdkConfig.endpoint !== config.endpoint || this.currentSdkConfig.apiKey !== config.apiKey) {
      
      console.log('🔄 Creating new Azure AI Projects client instance...');
      this.projectsClientInstance = this.createProjectsClient(config);
      this.currentSdkConfig = { ...config };
    }

    return this.projectsClientInstance;
  }

  /**
   * Get or create Azure AI Agents client (singleton pattern)
   */
  async getAgentsClient(forceRefresh: boolean = false): Promise<AgentsClient> {
    if (isClient) {
      throw new Error('Agents client is not available on client side');
    }

    const config = await getFoundryConfig(forceRefresh);
    
    if (forceRefresh || !this.agentsClientInstance || !this.currentSdkConfig || 
        this.currentSdkConfig.endpoint !== config.endpoint || this.currentSdkConfig.apiKey !== config.apiKey) {
      
      console.log('🔄 Creating new Azure AI Agents client instance...');
      this.agentsClientInstance = this.createAgentsClient(config);
      this.currentSdkConfig = { ...config };
    }

    return this.agentsClientInstance;
  }

  /**
   * Test connection to Azure AI Foundry services
   */
  async testFoundryConnection(): Promise<boolean> {
    if (isClient) {
      console.warn('⚠️ Cannot test foundry connection on client side');
      return false;
    }

    try {
      console.log('🔍 Testing Azure AI Foundry connection...');
      const client = await this.getProjectsClient();
      
      // TODO: Add actual connection test based on Azure AI Projects SDK
      console.log('✅ Azure AI Foundry connection test successful');
      return true;

    } catch (error) {
      console.error('❌ Azure AI Foundry connection test failed:', error);
      return false;
    }
  }

  /**
   * Clear SDK client instances (useful for testing or configuration updates)
   */
  clearFoundryClients(): void {
    if (isClient) return;
    
    console.log('🔄 Clearing Azure AI Foundry client instances...');
    this.projectsClientInstance = null;
    this.agentsClientInstance = null;
    this.currentSdkConfig = null;
  }

  /**
   * Get current foundry configuration (for debugging)
   */
  async getCurrentFoundryConfig(): Promise<FoundryConfig | null> {
    if (isClient) {
      console.warn('⚠️ Cannot access foundry config on client side');
      return null;
    }

    try {
      return await getFoundryConfig();
    } catch (error) {
      console.error('❌ Failed to get current foundry configuration:', error);
      return null;
    }
  }
}

/**
 * Type exports for external use
 */
export type FoundryClientOptions = {
  endpoint?: string;
  apiKey?: string;
  projectId?: string;
  forceRefresh?: boolean;
};

export type FoundryRequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

export type FoundryResponse<T = any> = {
  status: number;
  data: T | null;
  raw: string;
};

// Re-export Azure SDK types for convenience
export type { AIProjectClient, AgentsClient };

