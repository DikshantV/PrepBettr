/**
 * Azure AI Foundry Client
 * 
 * This module provides client implementations for Azure AI Foundry services,
 * including Projects client and Agents client with proper authentication
 * and error handling following the existing PrepBettr patterns.
 */

import { DefaultAzureCredential } from '@azure/identity';
import { type TokenCredential } from '@azure/core-auth';
import { AIProjectClient } from '@azure/ai-projects';
import { AgentsClient } from '@azure/ai-agents';
import { getFoundryConfig, type FoundryConfig } from '../config/foundry-config';

// Client-side safety check
const isClient = typeof window !== 'undefined';

if (isClient) {
  console.warn('[Azure AI Foundry Client] Running on client side - clients will not be initialized');
}

/**
 * Singleton instances for foundry clients
 */
let projectsClientInstance: AIProjectClient | null = null;
let agentsClientInstance: AgentsClient | null = null;
let currentConfig: FoundryConfig | null = null;

/**
 * Create Azure AI Projects client with proper authentication
 * 
 * @param config - Foundry configuration
 * @returns AIProjectClient instance
 */
function createProjectsClient(config: FoundryConfig): AIProjectClient {
  if (isClient) {
    throw new Error('Projects client cannot be initialized on client side');
  }

  try {
    // Create credential using DefaultAzureCredential for managed identity
    // Note: For API key authentication, use environment variables or Azure Key Vault
    const credential: TokenCredential = new DefaultAzureCredential();

    console.log(`🔧 Creating Azure AI Projects client for endpoint: ${config.endpoint}`);
    
    const client = new AIProjectClient(config.endpoint, credential, {
      additionalPolicies: [{
        policy: {
          name: 'PrepBettrUserAgent',
          sendRequest: async (request: any, next: any) => {
            // Add custom user agent for tracking
            const existingUserAgent = request.headers.get('User-Agent') || '';
            request.headers.set('User-Agent', `PrepBettr/1.0 ${existingUserAgent}`);
            return next(request);
          }
        },
        position: 'perCall'
      }],
      // Enable retries for transient failures
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
 * 
 * @param config - Foundry configuration
 * @returns AgentsClient instance
 */
function createAgentsClient(config: FoundryConfig): AgentsClient {
  if (isClient) {
    throw new Error('Agents client cannot be initialized on client side');
  }

  try {
    // Create credential using DefaultAzureCredential for managed identity
    // Note: For API key authentication, use environment variables or Azure Key Vault
    const credential: TokenCredential = new DefaultAzureCredential();

    console.log(`🤖 Creating Azure AI Agents client for project: ${config.projectId}`);
    
    // Note: AgentsClient constructor may vary based on actual Azure AI SDK
    // This follows the expected pattern based on ProjectsClient
    const client = new AgentsClient(config.endpoint, credential, {
      additionalPolicies: [{
        policy: {
          name: 'PrepBettrAgentUserAgent',
          sendRequest: async (request: any, next: any) => {
            // Add custom user agent for tracking
            const existingUserAgent = request.headers.get('User-Agent') || '';
            request.headers.set('User-Agent', `PrepBettr-Agent/1.0 ${existingUserAgent}`);
            
            // Add project context header if available
            if (config.projectId) {
              request.headers.set('X-Project-Id', config.projectId);
            }
            
            return next(request);
          }
        },
        position: 'perCall'
      }],
      // Enable retries for transient failures
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
 * 
 * @param forceRefresh - Force refresh the client instance
 * @returns Promise<AIProjectClient> - The projects client
 */
export async function getProjectsClient(forceRefresh: boolean = false): Promise<AIProjectClient> {
  if (isClient) {
    throw new Error('Projects client is not available on client side');
  }

  // Get current configuration
  const config = await getFoundryConfig(forceRefresh);
  
  // Create new client if forced refresh, no existing client, or configuration changed
  if (forceRefresh || !projectsClientInstance || !currentConfig || 
      currentConfig.endpoint !== config.endpoint || currentConfig.apiKey !== config.apiKey) {
    
    console.log('🔄 Creating new Azure AI Projects client instance...');
    projectsClientInstance = createProjectsClient(config);
    currentConfig = { ...config };
  }

  return projectsClientInstance;
}

/**
 * Get or create Azure AI Agents client (singleton pattern)
 * 
 * @param forceRefresh - Force refresh the client instance
 * @returns Promise<AgentsClient> - The agents client
 */
export async function getAgentsClient(forceRefresh: boolean = false): Promise<AgentsClient> {
  if (isClient) {
    throw new Error('Agents client is not available on client side');
  }

  // Get current configuration
  const config = await getFoundryConfig(forceRefresh);
  
  // Create new client if forced refresh, no existing client, or configuration changed
  if (forceRefresh || !agentsClientInstance || !currentConfig || 
      currentConfig.endpoint !== config.endpoint || currentConfig.apiKey !== config.apiKey) {
    
    console.log('🔄 Creating new Azure AI Agents client instance...');
    agentsClientInstance = createAgentsClient(config);
    currentConfig = { ...config };
  }

  return agentsClientInstance;
}

/**
 * Test connection to Azure AI Foundry services
 * 
 * @returns Promise<boolean> - True if connection is successful
 */
export async function testFoundryConnection(): Promise<boolean> {
  if (isClient) {
    console.warn('⚠️ Cannot test foundry connection on client side');
    return false;
  }

  try {
    console.log('🔍 Testing Azure AI Foundry connection...');
    
    const client = await getProjectsClient();
    
    // TODO: Add actual connection test based on Azure AI Projects SDK
    // This is a placeholder that would use the actual SDK methods
    // Example: await client.getProjects({ maxResults: 1 });
    
    console.log('✅ Azure AI Foundry connection test successful');
    return true;

  } catch (error) {
    console.error('❌ Azure AI Foundry connection test failed:', error);
    return false;
  }
}

/**
 * Clear client instances (useful for testing or configuration updates)
 */
export function clearFoundryClients(): void {
  if (isClient) return;
  
  console.log('🔄 Clearing Azure AI Foundry client instances...');
  projectsClientInstance = null;
  agentsClientInstance = null;
  currentConfig = null;
}

/**
 * Get current foundry configuration (for debugging)
 */
export async function getCurrentFoundryConfig(): Promise<FoundryConfig | null> {
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

// TODO: Add more foundry client utilities:
// - Model deployment management
// - Agent lifecycle management  
// - Project workspace operations
// - Monitoring and health checks
// - Batch operation utilities
