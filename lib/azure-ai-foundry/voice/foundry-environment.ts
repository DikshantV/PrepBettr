/**
 * Azure AI Foundry Environment Configuration
 * 
 * Provides a getEnv() utility function that fetches Azure AI Foundry configuration
 * from Azure Key Vault with environment variable fallback.
 * Follows the existing pattern from the project's foundry-config.ts.
 */

import { getFoundryConfig, type FoundryConfig } from '../config/foundry-config';

/**
 * Interface for environment variables needed by the voice client
 */
export interface VoiceEnvironmentConfig {
  endpoint: string;
  apiKey: string;
  projectId: string;
  region: string;
  resourceId: string;
  resourceGroup: string;
  deploymentName?: string;
}

/**
 * Cache for environment configuration to avoid repeated Azure Key Vault calls
 */
let cachedVoiceConfig: VoiceEnvironmentConfig | null = null;

/**
 * Get environment configuration for voice services
 * Uses Azure Key Vault with environment variable fallback
 * 
 * @param forceRefresh - Force refresh the cached configuration
 * @returns Promise<VoiceEnvironmentConfig>
 */
export async function getEnv(forceRefresh: boolean = false): Promise<VoiceEnvironmentConfig> {
  if (cachedVoiceConfig && !forceRefresh) {
    return cachedVoiceConfig;
  }

  try {
    // Use existing foundry config which already handles Key Vault + env fallback
    const foundryConfig: FoundryConfig = await getFoundryConfig(forceRefresh);
    
    cachedVoiceConfig = {
      endpoint: foundryConfig.endpoint,
      apiKey: foundryConfig.apiKey,
      projectId: foundryConfig.projectId,
      region: foundryConfig.region,
      resourceId: foundryConfig.resourceId,
      resourceGroup: foundryConfig.resourceGroup,
      deploymentName: process.env.AZURE_FOUNDRY_DEPLOYMENT_NAME || 'gpt-4o'
    };

    // Validate required fields for voice client
    const requiredFields: (keyof VoiceEnvironmentConfig)[] = [
      'endpoint', 'apiKey', 'projectId', 'region'
    ];
    
    const missingFields = requiredFields.filter(
      field => !cachedVoiceConfig![field]
    );

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required Azure AI Foundry voice configuration: ${missingFields.join(', ')}`
      );
    }

    console.log('✅ Azure AI Foundry voice configuration loaded successfully');
    return cachedVoiceConfig;

  } catch (error) {
    console.error('❌ Failed to load Azure AI Foundry voice configuration:', error);
    
    // Fallback: try direct environment variables as last resort
    const fallbackConfig: VoiceEnvironmentConfig = {
      endpoint: process.env.AZURE_FOUNDRY_ENDPOINT || '',
      apiKey: process.env.AZURE_FOUNDRY_API_KEY || '',
      projectId: process.env.AZURE_FOUNDRY_PROJECT_ID || 'prepbettr-interview-agents',
      region: process.env.AZURE_FOUNDRY_REGION || 'eastus',
      resourceId: process.env.AZURE_FOUNDRY_RESOURCE_ID || '',
      resourceGroup: process.env.AZURE_FOUNDRY_RESOURCE_GROUP || 'PrepBettr_group',
      deploymentName: process.env.AZURE_FOUNDRY_DEPLOYMENT_NAME || 'gpt-4o'
    };

    // Final validation
    if (!fallbackConfig.endpoint || !fallbackConfig.apiKey) {
      throw new Error(
        'Critical Azure AI Foundry voice configuration missing. ' +
        'Ensure AZURE_FOUNDRY_ENDPOINT and AZURE_FOUNDRY_API_KEY are set.'
      );
    }

    cachedVoiceConfig = fallbackConfig;
    console.warn('⚠️ Using fallback environment configuration for Azure AI Foundry voice');
    return cachedVoiceConfig;
  }
}

/**
 * Clear cached configuration (useful for testing)
 */
export function clearVoiceConfigCache(): void {
  cachedVoiceConfig = null;
}

/**
 * Validate voice environment configuration
 */
export function validateVoiceConfig(config: VoiceEnvironmentConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.endpoint) {
    errors.push('Missing endpoint');
  } else if (!config.endpoint.startsWith('https://')) {
    errors.push('Endpoint must use HTTPS');
  }

  if (!config.apiKey) {
    errors.push('Missing API key');
  }

  if (!config.projectId) {
    errors.push('Missing project ID');
  }

  if (!config.region) {
    errors.push('Missing region');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
