/**
 * Azure AI Foundry Type Definitions
 * 
 * This module exports TypeScript type definitions for Azure AI Foundry services,
 * including custom types for PrepBettr-specific use cases and re-exports from
 * the Azure AI SDK packages.
 */

// Re-export types from Azure AI Projects SDK
export type {
  AIProjectClient,
} from '@azure/ai-projects';

export type {
  AgentsClient,
} from '@azure/ai-agents';

// Re-export authentication types
export type {
  AzureKeyCredential,
  TokenCredential,
} from '@azure/core-auth';

// Re-export common Azure types
export type {
  DefaultAzureCredential,
} from '@azure/identity';

/**
 * Configuration interface for Azure AI Foundry
 */
export interface FoundryConfig {
  endpoint: string;
  apiKey: string;
  projectId: string;
  resourceGroup: string;
  region?: string;
  deploymentName?: string;
}

/**
 * Azure AI Foundry Chat Completion Request
 * (Custom type for PrepBettr-specific use cases)
 */
export interface FoundryChatRequest {
  messages: FoundryChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Chat message interface for Azure AI Foundry
 */
export interface FoundryChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Azure AI Foundry Chat Completion Response
 */
export interface FoundryChatResponse {
  id: string;
  choices: FoundryChatChoice[];
  usage?: FoundryUsage;
  metadata?: Record<string, any>;
  created: number;
}

/**
 * Chat completion choice
 */
export interface FoundryChatChoice {
  index: number;
  message: FoundryChatMessage;
  finishReason: 'stop' | 'length' | 'content_filter' | null;
}

/**
 * Token usage information
 */
export interface FoundryUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Azure AI Agent Definition
 */
export interface FoundryAgent {
  id: string;
  name: string;
  description?: string;
  model: string;
  instructions?: string;
  tools?: FoundryTool[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Azure AI Agent Tool Definition
 */
export interface FoundryTool {
  type: 'function' | 'code_interpreter' | 'retrieval';
  function?: FoundryFunction;
  metadata?: Record<string, any>;
}

/**
 * Function tool definition
 */
export interface FoundryFunction {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
}

/**
 * Foundry Project Information
 */
export interface FoundryProject {
  id: string;
  name: string;
  description?: string;
  resourceGroup: string;
  region: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Foundry Model Deployment
 */
export interface FoundryModelDeployment {
  id: string;
  name: string;
  model: string;
  version?: string;
  status: 'pending' | 'running' | 'failed' | 'succeeded';
  endpoint?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Error types for Azure AI Foundry operations
 */
export interface FoundryError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Connection status for Azure AI Foundry services
 */
export interface FoundryConnectionStatus {
  isConnected: boolean;
  lastChecked: string;
  latency?: number;
  error?: FoundryError;
}

/**
 * Health check result for foundry services
 */
export interface FoundryHealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  services: {
    projects: FoundryConnectionStatus;
    agents: FoundryConnectionStatus;
  };
  timestamp: string;
}

/**
 * Foundry service options for requests
 */
export interface FoundryRequestOptions {
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
  signal?: AbortSignal;
}

/**
 * PrepBettr-specific interview context for foundry agents
 */
export interface PrepBettrInterviewContext {
  candidateName: string;
  jobRole: string;
  companyName?: string;
  resumeContent?: string;
  questionsList?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  interviewType?: 'technical' | 'behavioral' | 'mixed';
}

/**
 * PrepBettr foundry agent response
 */
export interface PrepBettrFoundryResponse {
  response: string;
  nextQuestions?: string[];
  feedback?: string;
  confidence?: number;
  metadata?: {
    processingTime: number;
    tokensUsed: number;
    context: PrepBettrInterviewContext;
  };
}

// TODO: Add more types as needed:
// - Streaming response types
// - Batch processing types  
// - Model fine-tuning types
// - Evaluation and metrics types
// - Integration-specific types for PrepBettr workflows
