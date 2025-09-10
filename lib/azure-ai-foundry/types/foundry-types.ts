/**
 * Azure AI Foundry TypeScript Type Definitions
 * 
 * Comprehensive type definitions for Azure AI Foundry services including
 * models, agents, projects, and inference capabilities.
 */

// ====================
// Core Types
// ====================

/**
 * Base Foundry resource identifier
 */
export interface FoundryResourceId {
  subscriptionId: string;
  resourceGroupName: string;
  hubName: string;
  projectName?: string;
}

/**
 * Foundry project metadata
 */
export interface FoundryProject {
  id: string;
  name: string;
  description?: string;
  resourceGroup: string;
  location: string;
  tags?: Record<string, string>;
  createdAt: string;
  modifiedAt: string;
  status: 'Active' | 'Creating' | 'Deleting' | 'Failed' | 'Updating';
}

/**
 * Foundry model deployment information
 */
export interface ModelDeployment {
  id: string;
  name: string;
  modelName: string;
  modelVersion: string;
  deploymentStatus: 'Creating' | 'Succeeded' | 'Failed' | 'Deleting';
  endpoint?: string;
  apiKey?: string;
  properties: {
    scaleSettings?: {
      scaleType: 'Standard' | 'Manual';
      capacity?: number;
      maxCapacity?: number;
    };
    versionUpgradeOption?: 'OnceNewDefaultVersionAvailable' | 'OnceCurrentVersionExpired' | 'NoAutoUpgrade';
  };
}

// ====================
// Model Inference Types
// ====================

/**
 * Text completion request parameters
 */
export interface CompletionRequest {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  logit_bias?: Record<string, number>;
  user?: string;
}

/**
 * Text completion response
 */
export interface CompletionResponse {
  id: string;
  object: 'text_completion';
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage: TokenUsage;
}

/**
 * Individual completion choice
 */
export interface CompletionChoice {
  text: string;
  index: number;
  logprobs?: {
    tokens: string[];
    token_logprobs: (number | null)[];
    top_logprobs: (Record<string, number> | null)[];
    text_offset: number[];
  };
  finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

/**
 * Chat completion request (OpenAI format)
 */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  functions?: ChatFunction[];
  function_call?: 'none' | 'auto' | { name: string };
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

/**
 * Chat function definition
 */
export interface ChatFunction {
  name: string;
  description?: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: TokenUsage;
}

/**
 * Chat completion choice
 */
export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ====================
// Agent Framework Types
// ====================

/**
 * Foundry agent definition
 */
export interface FoundryAgent {
  id: string;
  name: string;
  description?: string;
  version: string;
  model: string;
  systemPrompt?: string;
  tools?: AgentTool[];
  capabilities: AgentCapability[];
  configuration: AgentConfiguration;
  metadata?: Record<string, any>;
  createdAt: string;
  modifiedAt: string;
  status: 'Active' | 'Draft' | 'Archived';
}

/**
 * Agent capabilities
 */
export type AgentCapability = 
  | 'text-generation'
  | 'code-generation' 
  | 'reasoning'
  | 'function-calling'
  | 'retrieval'
  | 'multimodal'
  | 'streaming';

/**
 * Agent tool definition
 */
export interface AgentTool {
  type: 'function' | 'retrieval' | 'code_interpreter';
  function?: {
    name: string;
    description?: string;
    parameters: Record<string, any>;
  };
}

/**
 * Agent configuration settings
 */
export interface AgentConfiguration {
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  timeout: number; // milliseconds
  retryConfig: {
    maxRetries: number;
    baseDelay: number;
  };
}

/**
 * Agent conversation session
 */
export interface AgentSession {
  id: string;
  agentId: string;
  userId?: string;
  messages: AgentMessage[];
  context?: Record<string, any>;
  createdAt: string;
  lastActivityAt: string;
  status: 'Active' | 'Completed' | 'Failed' | 'Timeout';
}

/**
 * Agent message in a conversation
 */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    tokens?: number;
    latency?: number;
    model?: string;
    toolCalls?: ToolCall[];
  };
}

/**
 * Tool call within agent message
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
    result?: string;
  };
}

// ====================
// Evaluation Types
// ====================

/**
 * Model evaluation metrics
 */
export interface EvaluationMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  bleuScore?: number;
  rougeScore?: {
    rouge1: number;
    rouge2: number;
    rougeL: number;
  };
  perplexity?: number;
  latency?: {
    mean: number;
    p95: number;
    p99: number;
  };
  throughput?: number; // tokens per second
}

/**
 * Evaluation run configuration
 */
export interface EvaluationRun {
  id: string;
  name: string;
  modelName: string;
  datasetId: string;
  metrics: EvaluationMetrics;
  parameters: {
    temperature: number;
    maxTokens: number;
    topP: number;
  };
  status: 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  createdAt: string;
  completedAt?: string;
  results?: EvaluationResult[];
}

/**
 * Individual evaluation result
 */
export interface EvaluationResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  score: number;
  metadata?: Record<string, any>;
}

// ====================
// Error Types
// ====================

/**
 * Foundry API error response
 */
export interface FoundryError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    innererror?: {
      code: string;
      innererror?: FoundryError['error']['innererror'];
    };
  };
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  remainingRequests: number;
  remainingTokens: number;
  resetTimeRequests?: string;
  resetTimeTokens?: string;
}

// ====================
// Monitoring Types
// ====================

/**
 * Model usage statistics
 */
export interface UsageStatistics {
  totalRequests: number;
  totalTokens: number;
  averageLatency: number;
  errorRate: number;
  timeRange: {
    start: string;
    end: string;
  };
  breakdown: {
    [model: string]: {
      requests: number;
      tokens: number;
      errors: number;
    };
  };
}

/**
 * Health check status
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    [service: string]: {
      status: 'pass' | 'fail' | 'warn';
      responseTime?: number;
      error?: string;
    };
  };
  timestamp: string;
}

// ====================
// Streaming Types
// ====================

/**
 * Server-sent event for streaming responses
 */
export interface StreamEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * Streaming completion chunk
 */
export interface StreamingCompletionChunk {
  id: string;
  object: 'text_completion.chunk' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string;
      role?: string;
      function_call?: {
        name?: string;
        arguments?: string;
      };
    };
    finish_reason?: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
  }>;
}

// ====================
// Utility Types
// ====================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  nextLink?: string;
  count?: number;
}

/**
 * Foundry operation status
 */
export interface OperationStatus {
  id: string;
  status: 'NotStarted' | 'Running' | 'Succeeded' | 'Failed' | 'Cancelled';
  createdDateTime: string;
  lastActionDateTime?: string;
  resourceLocation?: string;
  percentComplete?: number;
  error?: FoundryError['error'];
}

/**
 * API version information
 */
export interface ApiVersionInfo {
  version: string;
  preview?: boolean;
  deprecated?: boolean;
  supportedUntil?: string;
}

// ====================
// Configuration Types
// ====================

/**
 * Foundry SDK configuration options
 */
export interface FoundryClientOptions {
  endpoint: string;
  apiKey: string;
  projectId?: string;
  apiVersion?: string;
  timeout?: number;
  retries?: number;
  userAgent?: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * Request options for API calls
 */
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}
