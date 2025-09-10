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
  FoundryClientBase,
  type FoundryClientOptions,
  type FoundryRequestOptions,
  type FoundryResponse,
  type AIProjectClient,
  type AgentsClient
} from './clients/foundry-client';

// Migration wrapper exports
export {
  MigrationOpenAIClient,
  migrationOpenAIClient,
  type ChatCompletionMessage,
  type ChatCompletionCreateParams
} from './clients/migration-wrapper';

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
  RateLimitInfo,
  UsageStatistics,
  HealthStatus,
  StreamEvent,
  StreamingCompletionChunk,
  PaginatedResponse,
  OperationStatus,
  ApiVersionInfo,
  RequestOptions
} from './types/foundry-types';

// Agent system exports
export {
  BaseAgent,
  generateQuestionId,
  calculateInterviewProgress,
  getEstimatedRemainingTime
} from './agents/base-agent';

export type {
  Question,
  InterviewContext,
  SessionState,
  AgentMetadata
} from './types/agent-types';

export {
  TechnicalInterviewer
} from './agents/technical-interviewer';

export {
  BehavioralInterviewer
} from './agents/behavioral-interviewer';

export {
  IndustryExpert
} from './agents/industry-expert';

export {
  AgentFactory,
  type AgentType,
  type AgentFactoryConfig
} from './agents/agent-factory';

// Voice system exports
export {
  VoiceSession
} from './voice/voice-session';

export {
  VoiceLiveClient,
  getVoiceLiveClient,
  type VoiceSessionOptions,
  type AudioFrame,
  type VoiceWebSocketMessage
} from './voice/voice-live-client';

export {
  voiceTelemetry,
  VoiceTelemetry
} from './voice/voice-telemetry';

export * from './voice/types';

// Workflow system exports
export {
  InterviewWorkflow
} from './workflows/interview-workflow';

export * from './workflows/workflow-types';

// Environment configuration exports
export * from './config/environment';

// Error handling exports
export {
  FoundryError,
  FoundryClientError,
  FoundryConfigError,
  VoiceError,
  VoiceSessionError,
  VoiceAudioError,
  AgentError,
  createFoundryClientError,
  createFoundryConfigError,
  createVoiceSessionError,
  createVoiceAudioError,
  createAgentError,
  isFoundryError,
  isFoundryClientError,
  isVoiceError,
  isVoiceSessionError,
  isVoiceAudioError,
  isAgentError,
  isRetryableError
} from './errors/foundry-errors';

/**
 * Convenience function to create a ready-to-use model manager
 */
export async function createFoundryModelManager() {
  const { FoundryModelManager } = await import('./managers/model-manager');
  const manager = new FoundryModelManager();
  await manager.init();
  return manager;
}

/**
 * Convenience function to create a ready-to-use foundry client
 */
export async function createFoundryClient() {
  const { FoundryClientBase } = await import('./clients/foundry-client');
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
    const { getFoundryConfig, validateFoundryConfig } = await import('./config/foundry-config');
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
 * Get optional Azure AI Foundry Document Intelligence environment variables
 */
export function getDocumentIntelligenceEnvironmentVariables(): string[] {
  return [
    'AZURE_FOUNDRY_DOCINT_ENDPOINT',
    'AZURE_FOUNDRY_DOCINT_API_KEY',
    'AZURE_FOUNDRY_DOCINT_PROJECT_ID'
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
