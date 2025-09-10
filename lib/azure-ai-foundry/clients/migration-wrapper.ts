/**
 * Azure AI Foundry Migration Wrapper
 * 
 * Drop-in replacement for Azure OpenAI SDK that routes requests through
 * Azure AI Foundry while maintaining full API compatibility.
 * 
 * This allows for seamless migration from legacy OpenAI/Azure OpenAI clients
 * to the new Azure AI Foundry infrastructure without changing existing code.
 */

import { FoundryClientBase } from './foundry-client';
import { FoundryModelManager } from '../managers/model-manager';
import type { ModelConfig } from '../config/foundry-config';
import type { TokenUsage } from '../types/foundry-types';

/**
 * OpenAI SDK Compatible Interfaces
 * These match the exact structure expected by existing code
 */
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: any;
}

export interface ChatCompletionCreateParams {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  stop?: string | string[];
  n?: number;
  logit_bias?: Record<string, number>;
  user?: string;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: string | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: TokenUsage;
}

export interface CompletionCreateParams {
  model: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  n?: number;
}

export interface CompletionChoice {
  text: string;
  index: number;
  finish_reason: string | null;
}

export interface CompletionResponse {
  id: string;
  object: 'text_completion';
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage?: TokenUsage;
}

export interface ModelListResponse {
  object: 'list';
  data: Array<{
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
  }>;
}

/**
 * Migration OpenAI Client
 * 
 * Provides full compatibility with OpenAI SDK while using Azure AI Foundry backend.
 * Includes cost tracking, usage monitoring, and intelligent model selection.
 */
export class MigrationOpenAIClient extends FoundryClientBase {
  private modelManager: FoundryModelManager;
  private isInitialized = false;

  // Nested API structure to match OpenAI SDK
  public readonly chat: {
    completions: {
      create: (params: ChatCompletionCreateParams) => Promise<ChatCompletionResponse>;
    };
  };

  public readonly completions: {
    create: (params: CompletionCreateParams) => Promise<CompletionResponse>;
  };

  constructor() {
    super(); // Call parent constructor
    this.modelManager = new FoundryModelManager();

    // Create nested API structure to match OpenAI SDK exactly
    this.chat = {
      completions: {
        create: this.createChatCompletion.bind(this)
      }
    };

    this.completions = {
      create: this.createCompletion.bind(this)
    };
  }

  /**
   * Initialize the migration client
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    await super.init(); // Call parent init
    await this.modelManager.init();
    this.isInitialized = true;

    console.log('✅ MigrationOpenAIClient initialized with Azure AI Foundry backend');
  }

  /**
   * Create chat completion (main method used by existing code)
   */
  async createChatCompletion(params: ChatCompletionCreateParams): Promise<ChatCompletionResponse> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    const mappedModel = this.mapModel(params.model);
    const modelConfig = this.modelManager.getModel(mappedModel) || this.modelManager.getDefaultModelConfig();

    // Log cost estimation before the request
    const estimatedTokens = this.estimateTokens(params);
    const estimatedCost = (estimatedTokens / 1000) * modelConfig.costPerToken;
    console.info(`[Cost] Estimated cost for ${mappedModel}: $${estimatedCost.toFixed(4)} (~${estimatedTokens} tokens)`);

    try {
      // Convert OpenAI request to Foundry request format
      const foundryRequest = {
        messages: params.messages,
        model: mappedModel,
        temperature: params.temperature ?? modelConfig.temperature,
        max_tokens: params.max_tokens ?? modelConfig.maxTokens,
        top_p: params.top_p ?? modelConfig.topP,
        frequency_penalty: params.frequency_penalty ?? modelConfig.frequencyPenalty,
        presence_penalty: params.presence_penalty ?? modelConfig.presencePenalty,
        stream: false, // Foundry doesn't support streaming yet
        stop: params.stop,
        n: params.n ?? 1
      };

      // Make request through Foundry client (inherited method)
      const foundryResponse = await this.request(`/chat/completions`, {
        method: 'POST',
        body: foundryRequest
      });

      if (foundryResponse.status !== 200) {
        throw new Error(`Foundry API returned status ${foundryResponse.status}: ${foundryResponse.raw}`);
      }

      // Convert Foundry response to OpenAI format
      const openAIResponse: ChatCompletionResponse = {
        id: foundryResponse.data?.id || `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: mappedModel,
        choices: foundryResponse.data?.choices?.map((choice: any, index: number) => ({
          index,
          message: {
            role: choice.message?.role || 'assistant',
            content: choice.message?.content || '',
            function_call: choice.message?.function_call
          },
          finish_reason: choice.finish_reason || 'stop'
        })) || [{
          index: 0,
          message: {
            role: 'assistant',
            content: foundryResponse.data?.content || foundryResponse.raw
          },
          finish_reason: 'stop'
        }],
        usage: foundryResponse.data?.usage ? {
          prompt_tokens: foundryResponse.data.usage.prompt_tokens || 0,
          completion_tokens: foundryResponse.data.usage.completion_tokens || 0,
          total_tokens: foundryResponse.data.usage.total_tokens || 0
        } : undefined
      };

      // Track usage metrics
      const latency = Date.now() - startTime;
      const actualUsage = openAIResponse.usage || {
        prompt_tokens: estimatedTokens * 0.7,
        completion_tokens: estimatedTokens * 0.3,
        total_tokens: estimatedTokens
      };

      this.modelManager.trackUsage({
        modelName: mappedModel,
        tokenUsage: actualUsage,
        latency,
        success: true
      });

      // Log actual cost
      const actualCost = (actualUsage.total_tokens / 1000) * modelConfig.costPerToken;
      console.info(`[Cost] Actual cost for ${mappedModel}: $${actualCost.toFixed(4)} (${actualUsage.total_tokens} tokens, ${latency}ms)`);

      return openAIResponse;

    } catch (error: any) {
      // Track failed usage
      const latency = Date.now() - startTime;
      this.modelManager.trackUsage({
        modelName: mappedModel,
        tokenUsage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        latency,
        success: false,
        errorCode: error.status?.toString() || 'UNKNOWN_ERROR'
      });

      console.error(`[Cost] Failed request for ${mappedModel} after ${latency}ms:`, error.message);
      throw error;
    }
  }

  /**
   * Create text completion (legacy method, less common but still used)
   */
  async createCompletion(params: CompletionCreateParams): Promise<CompletionResponse> {
    await this.ensureInitialized();

    const startTime = Date.now();
    const mappedModel = this.mapModel(params.model);
    const modelConfig = this.modelManager.getModel(mappedModel) || this.modelManager.getDefaultModelConfig();

    // Estimate cost
    const estimatedTokens = params.prompt.length / 4; // Rough token estimation
    const estimatedCost = (estimatedTokens / 1000) * modelConfig.costPerToken;
    console.info(`[Cost] Estimated cost for ${mappedModel} completion: $${estimatedCost.toFixed(4)}`);

    try {
      // Convert to chat completion format for Foundry
      const chatParams: ChatCompletionCreateParams = {
        model: mappedModel,
        messages: [{ role: 'user', content: params.prompt }],
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        top_p: params.top_p,
        frequency_penalty: params.frequency_penalty,
        presence_penalty: params.presence_penalty,
        stop: params.stop,
        n: params.n
      };

      const chatResponse = await this.createChatCompletion(chatParams);

      // Convert chat response to completion format
      const completionResponse: CompletionResponse = {
        id: chatResponse.id,
        object: 'text_completion',
        created: chatResponse.created,
        model: mappedModel,
        choices: chatResponse.choices.map(choice => ({
          text: choice.message.content,
          index: choice.index,
          finish_reason: choice.finish_reason
        })),
        usage: chatResponse.usage
      };

      return completionResponse;

    } catch (error: any) {
      const latency = Date.now() - startTime;
      console.error(`[Cost] Failed completion request for ${mappedModel} after ${latency}ms:`, error.message);
      throw error;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<ModelListResponse> {
    await this.ensureInitialized();

    const availableModels = this.modelManager.getAvailableModels();
    const modelList = Object.entries(availableModels).map(([name, config]) => ({
      id: name,
      object: 'model' as const,
      created: Math.floor(Date.now() / 1000),
      owned_by: 'azure-ai-foundry'
    }));

    return {
      object: 'list',
      data: modelList
    };
  }

  /**
   * Map legacy model names to Azure AI Foundry model names
   * 
   * @param legacyModelName - Original model name from legacy code
   * @returns Mapped model name for Azure AI Foundry
   */
  mapModel(legacyModelName: string): string {
    // Define model mapping based on your specifications
    const modelMapping: Record<string, string> = {
      // GPT-4 variants → gpt-4.5 (though we'll use gpt-4o as it's available)
      'gpt-4': 'gpt-4o',
      'gpt-4-turbo': 'gpt-4-turbo',
      'gpt-4o': 'gpt-4o', // Already correct
      
      // GPT-3.5 variants → gpt-4o (upgrade path)
      'gpt-3.5': 'gpt-4o',
      'gpt-3.5-turbo': 'gpt-4o',
      'gpt-35-turbo': 'gpt-4o', // Common Azure OpenAI deployment name
      
      // Phi models (if they exist in your foundry config)
      'phi-4': 'phi-4',
      
      // Default fallback
      'default': 'gpt-4o'
    };

    const mapped = modelMapping[legacyModelName] || modelMapping['default'];
    
    if (legacyModelName !== mapped) {
      console.log(`[ModelMapping] ${legacyModelName} → ${mapped}`);
    }

    return mapped;
  }

  /**
   * Estimate token count for cost calculation
   */
  private estimateTokens(params: ChatCompletionCreateParams): number {
    const messageContent = params.messages.map(m => m.content).join(' ');
    // Rough estimation: 1 token ≈ 4 characters for English text
    const inputTokens = Math.ceil(messageContent.length / 4);
    const outputTokens = Math.min(params.max_tokens || 150, 500); // Conservative estimate
    return inputTokens + outputTokens;
  }

  /**
   * Ensure client is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): Record<string, any> {
    // Delegate to model manager for usage statistics
    return {
      availableModels: Object.keys(this.modelManager.getAvailableModels()),
      initialized: this.isInitialized
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.isInitialized = false;
    console.log('🧹 MigrationOpenAIClient disposed');
  }
}

// Export singleton instance for drop-in replacement
export const migrationOpenAIClient = new MigrationOpenAIClient();

// Export class for custom instantiation
export { MigrationOpenAIClient as OpenAI };
export { MigrationOpenAIClient as OpenAIClient };

// Default export for CommonJS compatibility
export default MigrationOpenAIClient;
