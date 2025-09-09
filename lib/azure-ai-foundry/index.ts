/**
 * Azure AI Foundry Integration Index
 * 
 * Main entry point for Azure AI Foundry functionality in PrepBettr.
 * Exports all configuration, client, types, and utility functions.
 */

// Configuration exports
export {
  getFoundryConfig,
  clearFoundryConfigCache,
  validateFoundryConfig,
  getModelConfig,
  getDefaultModel,
  getDefaultModelConfigurations,
  getDefaultConnectionSettings,
  getEnvironmentDefaults,
  getFoundryConfigForEnvironment,
  type FoundryConfig,
  type ModelConfig,
  type RetryPolicy,
  type ConnectionSettings
} from './config/foundry-config';

// Client exports
export {
  FoundryClientBase
} from './clients/foundry-client';

// Model manager exports
export {
  FoundryModelManager,
  type ModelUsageEntry,
  type ModelPerformanceMetrics,
  type ModelSelectionCriteria
} from './managers/model-manager';

// Type definitions exports
export type {
  FoundryResourceId,
  FoundryProject,
  ModelDeployment,
  CompletionRequest,
  CompletionResponse,
  CompletionChoice,
  ChatCompletionRequest,
  ChatMessage,
  ChatFunction,
  ChatCompletionResponse,
  ChatCompletionChoice,
  TokenUsage,
  FoundryAgent,
  AgentCapability,
  AgentTool,
  AgentConfiguration,
  AgentSession,
  AgentMessage,
  ToolCall,
  EvaluationMetrics,
  EvaluationRun,
  EvaluationResult,
  FoundryError,
  RateLimitInfo,
  UsageStatistics,
  HealthStatus,
  StreamEvent,
  StreamingCompletionChunk,
  PaginatedResponse,
  OperationStatus,
  ApiVersionInfo,
  FoundryClientOptions,
  RequestOptions
} from './types/foundry-types';

/**
 * Convenience function to create a ready-to-use model manager
 */
export async function createFoundryModelManager(): Promise<FoundryModelManager> {
  const manager = new FoundryModelManager();
  await manager.init();
  return manager;
}

/**
 * Convenience function to create a ready-to-use foundry client
 */
export async function createFoundryClient(): Promise<FoundryClientBase> {
  const client = new FoundryClientBase();
  await client.init();
  return client;
}

/**
 * Quick configuration check for Azure AI Foundry setup
 */
export async function checkFoundrySetup(): Promise<{
  configured: boolean;
  hasEndpoint: boolean;
  hasApiKey: boolean;
  modelCount: number;
  errors: string[];
}> {
  try {
    const config = await getFoundryConfig();
    const validation = validateFoundryConfig(config);
    
    return {
      configured: validation.isValid,
      hasEndpoint: !!config.endpoint,
      hasApiKey: !!config.apiKey,
      modelCount: Object.keys(config.models).length,
      errors: validation.errors
    };
  } catch (error: any) {
    return {
      configured: false,
      hasEndpoint: false,
      hasApiKey: false,
      modelCount: 0,
      errors: [error.message || 'Configuration loading failed']
    };
  }
}

/**
 * Get recommended Azure AI Foundry environment variables
 */
export function getRequiredEnvironmentVariables(): string[] {
  return [
    'AZURE_FOUNDRY_ENDPOINT',
    'AZURE_FOUNDRY_API_KEY',
    'AZURE_FOUNDRY_PROJECT_ID',
    'AZURE_FOUNDRY_RESOURCE_GROUP',
    'AZURE_FOUNDRY_REGION'
  ];
}

/**
 * Check if Azure AI Foundry is properly configured
 */
export function isFoundryConfigured(): boolean {
  const requiredVars = getRequiredEnvironmentVariables();
  return requiredVars.some(varName => !!process.env[varName]);
}

// Default export with main utilities
export default {
  createFoundryModelManager,
  createFoundryClient,
  checkFoundrySetup,
  getRequiredEnvironmentVariables,
  isFoundryConfigured
};
