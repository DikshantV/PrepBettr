// Browser-compatible Azure configuration
// This file only uses environment variables and doesn't import server-only Azure Identity libraries

interface AzureSecrets {
  speechKey: string;
  speechEndpoint: string;
  azureOpenAIKey: string;
  azureOpenAIEndpoint: string;
  azureOpenAIDeployment: string;
}

let cachedSecrets: AzureSecrets | null = null;

/**
 * Fetch Azure secrets from environment variables (browser-safe version)
 * This function only uses NEXT_PUBLIC_ environment variables available in the browser
 */
export async function fetchAzureSecrets(): Promise<AzureSecrets> {
  // Return cached secrets if available
  if (cachedSecrets) {
    return cachedSecrets;
  }

  try {
    console.log('🔑 Loading Azure configuration from environment variables...');
    
    const secrets = {
      speechKey: process.env.NEXT_PUBLIC_SPEECH_KEY || '',
      speechEndpoint: process.env.NEXT_PUBLIC_SPEECH_ENDPOINT || '',
      azureOpenAIKey: process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY || '',
      azureOpenAIEndpoint: process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT || '',
      azureOpenAIDeployment: process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT || 'gpt-4'
    };

    // Validate that required secrets are available
    if (!secrets.speechKey || !secrets.speechEndpoint) {
      console.warn('⚠️ Azure Speech credentials not available in browser environment');
    }

    if (!secrets.azureOpenAIKey || !secrets.azureOpenAIEndpoint) {
      console.warn('⚠️ Azure OpenAI credentials not available in browser environment');
    }

    cachedSecrets = secrets;
    console.log('✅ Azure configuration loaded from environment variables');
    return cachedSecrets;
    
  } catch (error) {
    console.error('❌ Failed to load Azure configuration:', error);
    
    // Return empty secrets as fallback
    const fallbackSecrets = {
      speechKey: '',
      speechEndpoint: '',
      azureOpenAIKey: '',
      azureOpenAIEndpoint: '',
      azureOpenAIDeployment: 'gpt-4'
    };
    
    cachedSecrets = fallbackSecrets;
    return cachedSecrets;
  }
}

/**
 * Get current Azure configuration (for debugging)
 */
export function getAzureConfig() {
  return {
    environment: 'browser',
    hasSecretsCache: !!cachedSecrets,
    configuration: {
      speechKey: !!process.env.NEXT_PUBLIC_SPEECH_KEY,
      speechEndpoint: !!process.env.NEXT_PUBLIC_SPEECH_ENDPOINT,
      azureOpenAIKey: !!process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY,
      azureOpenAIEndpoint: !!process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT,
      azureOpenAIDeployment: !!process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT
    }
  };
}

/**
 * Check if we're running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Clear cached secrets (useful for testing or re-initialization)
 */
export function clearCache(): void {
  cachedSecrets = null;
  console.log('🧹 Azure configuration cache cleared');
}
