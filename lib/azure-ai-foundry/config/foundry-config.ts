/**
 * Azure AI Foundry Configuration
 * 
 * This module handles configuration for Azure AI Foundry services,
 * following the existing pattern established in lib/azure-config.ts
 * for Azure Key Vault integration with environment variable fallbacks.
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

export interface FoundryConfig {
  endpoint: string;
  apiKey: string;
  projectId: string;
  resourceGroup: string;
  region?: string;
  deploymentName?: string;
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
    // Client-side fallback - return empty config
    return {
      endpoint: '',
      apiKey: '',
      projectId: '',
      resourceGroup: '',
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
      projectId: foundryProjectId?.value || process.env.AZURE_FOUNDRY_PROJECT_ID || 'PrepBettr',
      resourceGroup: foundryResourceGroup?.value || process.env.AZURE_FOUNDRY_RESOURCE_GROUP || 'PrepBettr_group',
      region: foundryRegion?.value || process.env.AZURE_FOUNDRY_REGION || 'eastus2',
      deploymentName: foundryDeploymentName?.value || process.env.AZURE_FOUNDRY_DEPLOYMENT_NAME
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
      projectId: process.env.AZURE_FOUNDRY_PROJECT_ID || 'PrepBettr',
      resourceGroup: process.env.AZURE_FOUNDRY_RESOURCE_GROUP || 'PrepBettr_group',
      region: process.env.AZURE_FOUNDRY_REGION || 'eastus2',
      deploymentName: process.env.AZURE_FOUNDRY_DEPLOYMENT_NAME
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

// TODO: Add more foundry-specific configuration helpers:
// - Model deployment configuration
// - Agent runtime settings  
// - Project workspace configuration
// - Performance and monitoring settings
