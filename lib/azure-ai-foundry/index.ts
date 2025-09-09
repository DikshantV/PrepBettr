/**
 * Azure AI Foundry Integration for PrepBettr
 * 
 * This module provides integration with Azure AI Foundry services including:
 * - AI Projects client for managing foundry projects
 * - AI Agents for conversation handling
 * - Model management and deployment
 * - Type definitions and configuration
 * 
 * @module azure-ai-foundry
 */

// Configuration
export * from './config/foundry-config';

// Client exports
export * from './clients/foundryClient';

// Type definitions (excluding FoundryConfig to avoid duplicate export)
export type {
  AIProjectClient,
  AgentsClient,
  FoundryChatRequest,
  FoundryChatMessage,
  FoundryChatResponse,
  FoundryChatChoice,
  FoundryUsage,
  FoundryAgent,
  FoundryTool,
  FoundryFunction,
  FoundryProject,
  FoundryModelDeployment,
  FoundryError,
  FoundryConnectionStatus,
  FoundryHealthCheck,
  FoundryRequestOptions,
  PrepBettrInterviewContext,
  PrepBettrFoundryResponse,
} from './types';

// TODO: Add exports for agents when implemented
// export * from './agents';

// TODO: Add exports for models when implemented  
// export * from './models';

// Re-export commonly used types from Azure packages
export type {
  AzureKeyCredential,
  TokenCredential,
} from '@azure/core-auth';
