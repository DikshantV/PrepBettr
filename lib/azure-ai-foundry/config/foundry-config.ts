/**
 * Azure AI Foundry Configuration
 * 
 * This module handles configuration for Azure AI Foundry services,
 * including model configurations, retry policies, and connection settings.
 * Follows the existing pattern established in lib/azure-config.ts.
 */

import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

// Client-side safety check
const isClient = typeof window !== 'undefined';

if (isClient) {
  console.warn('[Azure AI Foundry Config] Running on client side - using fallback implementations');
}

// Azure Key Vault configuration (reuse existing vault)
const AZURE_KEY_VAULT_URI = process.env.AZURE_KEY_VAULT_URI || 'https://prepbettr-keyvault-083.vault.azure.net/';

/**
 * Model configuration interface
 */
export interface ModelConfig {
  deploymentName: string;
  modelName: string;
  version: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  costPerToken: number; // Cost in USD per 1K tokens
  capabilities: string[];
  isDefault?: boolean;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  exponentialBase: number;
  jitter: boolean;
}

/**
 * Connection settings
 */
export interface ConnectionSettings {
  timeout: number; // milliseconds
  keepAlive: boolean;
  maxConnections: number;
  retryPolicy: RetryPolicy;
}

/**
 * Main foundry configuration interface
 */
export interface FoundryConfig {
  endpoint: string;
  apiKey: string;
  projectId: string;
  resourceId: string;
  resourceGroup: string;
  region: string;
  models: Record<string, ModelConfig>;
  connection: ConnectionSettings;
  environment: 'development' | 'staging' | 'production';
}

let cachedFoundryConfig: FoundryConfig | null = null;

/**
 * Initialize Azure Key Vault client (reusing existing pattern)
 */
function createKeyVaultClient(): SecretClient {
  if (!AZURE_KEY_VAULT_URI) {
    throw new Error('AZURE_KEY_VAULT_URI environment variable is required');
  }
  
  const credential = new DefaultAzureCredential();
  return new SecretClient(AZURE_KEY_VAULT_URI, credential);
}

/**
 * Clear cached foundry configuration
 */
export function clearFoundryConfigCache(): void {
  if (isClient) return;
  console.log('🔄 Clearing Azure AI Foundry config cache...');
  cachedFoundryConfig = null;
}

/**
 * Fetch Azure AI Foundry configuration from Azure Key Vault with environment variable fallback
 * 
 * @param forceRefresh - Force refresh the cached configuration
 * @returns Promise<FoundryConfig> - The foundry configuration
 */
export async function getFoundryConfig(forceRefresh: boolean = false): Promise<FoundryConfig> {
  if (isClient) {
    // Client-side fallback - return empty config with all required fields
    return {
      endpoint: '',
      apiKey: '',
      projectId: '',
      resourceId: '',
      resourceGroup: '',
      region: '',
      models: {},
      connection: getDefaultConnectionSettings(),
      environment: 'development'
    };
  }

  // Clear cache if force refresh is requested
  if (forceRefresh) {
    clearFoundryConfigCache();
  }
  
  // Return cached configuration if available
  if (cachedFoundryConfig) {
    return cachedFoundryConfig;
  }

  try {
    console.log('🔑 Fetching Azure AI Foundry configuration from Key Vault...');
    const client = createKeyVaultClient();

    // Helper function to suppress expected 404 errors for optional secrets
    const getOptionalSecret = (name: string) => 
      client.getSecret(name).catch(err => {
        if (err.statusCode !== 404) {
          console.warn(`⚠️ Unexpected error fetching optional secret '${name}':`, err.message);
        }
        return null;
      });

    // Fetch foundry-specific secrets
    const [
      foundryEndpoint,
      foundryApiKey,
      foundryProjectId,
      foundryResourceGroup,
      foundryRegion,
      foundryDeploymentName
    ] = await Promise.all([
      getOptionalSecret('azure-foundry-endpoint'),
      getOptionalSecret('azure-foundry-api-key'), 
      getOptionalSecret('azure-foundry-project-id'),
      getOptionalSecret('azure-foundry-resource-group'),
      getOptionalSecret('azure-foundry-region'),
      getOptionalSecret('azure-foundry-deployment-name')
    ]);

    cachedFoundryConfig = {
      endpoint: foundryEndpoint?.value || process.env.AZURE_FOUNDRY_ENDPOINT || '',
      apiKey: foundryApiKey?.value || process.env.AZURE_FOUNDRY_API_KEY || '',
      projectId: foundryProjectId?.value || process.env.AZURE_FOUNDRY_PROJECT_ID || 'prepbettr-interview-agents',
      resourceId: process.env.AZURE_FOUNDRY_RESOURCE_ID || '',
      resourceGroup: foundryResourceGroup?.value || process.env.AZURE_FOUNDRY_RESOURCE_GROUP || 'PrepBettr_group',
      region: foundryRegion?.value || process.env.AZURE_FOUNDRY_REGION || 'eastus',
      environment: (process.env.ENVIRONMENT || process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production',
      models: getDefaultModelConfigurations(),
      connection: getDefaultConnectionSettings()
    };

    // Validate required configuration
    const requiredFields = ['endpoint', 'apiKey', 'projectId', 'resourceGroup'];
    const missingFields = requiredFields.filter(field => !cachedFoundryConfig![field as keyof FoundryConfig]);

    if (missingFields.length > 0) {
      console.warn(`⚠️ Azure AI Foundry missing configuration: ${missingFields.join(', ')}`);
      console.log('💡 Add these secrets to Azure Key Vault or set environment variables:');
      missingFields.forEach(field => {
        const envVar = `AZURE_FOUNDRY_${field.toUpperCase()}`;
        console.log(`   - ${envVar}`);
      });
    } else {
      console.log('✅ Azure AI Foundry configuration loaded successfully');
    }

    return cachedFoundryConfig;

  } catch (error) {
    console.error('❌ Failed to fetch Azure AI Foundry configuration:', error);
    
    // Fallback to environment variables
    console.log('🔄 Falling back to environment variables for Azure AI Foundry...');
    const fallbackConfig: FoundryConfig = {
      endpoint: process.env.AZURE_FOUNDRY_ENDPOINT || '',
      apiKey: process.env.AZURE_FOUNDRY_API_KEY || '',
      projectId: process.env.AZURE_FOUNDRY_PROJECT_ID || 'prepbettr-interview-agents',
      resourceId: process.env.AZURE_FOUNDRY_RESOURCE_ID || '',
      resourceGroup: process.env.AZURE_FOUNDRY_RESOURCE_GROUP || 'PrepBettr_group',
      region: process.env.AZURE_FOUNDRY_REGION || 'eastus',
      environment: (process.env.ENVIRONMENT || process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production',
      models: getDefaultModelConfigurations(),
      connection: getDefaultConnectionSettings()
    };

    // Log missing critical configuration
    if (!fallbackConfig.endpoint || !fallbackConfig.apiKey) {
      console.error('❌ Critical Azure AI Foundry configuration missing from environment variables');
      console.log('💡 Set AZURE_FOUNDRY_ENDPOINT and AZURE_FOUNDRY_API_KEY environment variables');
    }

    cachedFoundryConfig = fallbackConfig;
    return cachedFoundryConfig;
  }
}

/**
 * Get environment-specific configuration defaults
 */
export function getEnvironmentDefaults(): Partial<FoundryConfig> {
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  
  const defaults: Record<string, Partial<FoundryConfig>> = {
    development: {
      region: 'eastus2',
      resourceGroup: 'PrepBettr_group'
    },
    staging: {
      region: 'eastus2', 
      resourceGroup: 'PrepBettr_group'
    },
    production: {
      region: 'eastus2',
      resourceGroup: 'PrepBettr_group'
    }
  };

  return defaults[environment] || defaults.development;
}

/**
 * Get default model configurations for Azure AI Foundry
 */
export function getDefaultModelConfigurations(): Record<string, ModelConfig> {
  return {
    'gpt-4o': {
      deploymentName: process.env.AZURE_FOUNDRY_GPT4O_DEPLOYMENT || 'gpt-4o',
      modelName: 'gpt-4o',
      version: '2024-05-13',
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      costPerToken: 0.005, // $5 per 1K tokens
      capabilities: ['text-generation', 'reasoning', 'coding', 'analysis'],
      isDefault: true
    },
    'gpt-4-turbo': {
      deploymentName: process.env.AZURE_FOUNDRY_GPT4_TURBO_DEPLOYMENT || 'gpt-4-turbo',
      modelName: 'gpt-4-turbo',
      version: '2024-04-09',
      maxTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      costPerToken: 0.01, // $10 per 1K tokens
      capabilities: ['text-generation', 'reasoning', 'coding', 'analysis', 'function-calling']
    },
    'phi-4': {
      deploymentName: process.env.AZURE_FOUNDRY_PHI4_DEPLOYMENT || 'phi-4',
      modelName: 'phi-4',
      version: '2024-12-12',
      maxTokens: 2048,
      temperature: 0.6,
      topP: 0.85,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
      costPerToken: 0.001, // $1 per 1K tokens (estimated for smaller model)
      capabilities: ['text-generation', 'reasoning', 'lightweight-tasks']
    }
  };
}

/**
 * Get default connection settings
 */
export function getDefaultConnectionSettings(): ConnectionSettings {
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  
  return {
    timeout: environment === 'production' ? 30000 : 60000, // 30s prod, 60s dev
    keepAlive: true,
    maxConnections: environment === 'production' ? 10 : 5,
    retryPolicy: {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      exponentialBase: 2,
      jitter: true
    }
  };
}

/**
 * Get model configuration by name
 */
export function getModelConfig(modelName: string): ModelConfig | null {
  const models = getDefaultModelConfigurations();
  return models[modelName] || null;
}

/**
 * Get default model configuration
 */
export function getDefaultModel(): ModelConfig {
  const models = getDefaultModelConfigurations();
  const defaultModel = Object.values(models).find(model => model.isDefault);
  return defaultModel || models['gpt-4o'];
}

/**
 * Validate foundry configuration
 */
export function validateFoundryConfig(config: FoundryConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.endpoint) {
    errors.push('Missing foundry endpoint');
  }
  
  if (!config.apiKey) {
    errors.push('Missing foundry API key');
  }
  
  if (!config.projectId) {
    errors.push('Missing foundry project ID');
  }
  
  if (!config.resourceGroup) {
    errors.push('Missing foundry resource group');
  }
  
  // Validate endpoint format
  if (config.endpoint && !config.endpoint.startsWith('https://')) {
    errors.push('Foundry endpoint must use HTTPS');
  }
  
  // Validate models configuration
  const models = Object.values(config.models);
  if (models.length === 0) {
    errors.push('No models configured');
  }
  
  const hasDefault = models.some(model => model.isDefault);
  if (!hasDefault) {
    errors.push('No default model configured');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get foundry configuration for specific environment
 */
export async function getFoundryConfigForEnvironment(
  environment: 'development' | 'staging' | 'production'
): Promise<FoundryConfig> {
  // Temporarily set environment for config fetching
  const originalEnv = process.env.ENVIRONMENT;
  process.env.ENVIRONMENT = environment;
  
  try {
    const config = await getFoundryConfig(true); // Force refresh
    return {
      ...config,
      environment
    };
  } finally {
    // Restore original environment
    if (originalEnv) {
      process.env.ENVIRONMENT = originalEnv;
    } else {
      delete process.env.ENVIRONMENT;
    }
  }
}
