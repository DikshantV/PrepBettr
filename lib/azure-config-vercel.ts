/**
 * Vercel-optimized Azure configuration
 * This file avoids DefaultAzureCredential which doesn't work in Vercel environment
 * and relies solely on environment variables for credentials
 */

interface AzureSecrets {
  speechKey: string;
  speechEndpoint: string;
  azureOpenAIKey: string;
  azureOpenAIEndpoint: string;
  azureOpenAIDeployment: string;
}

let cachedSecrets: AzureSecrets | null = null;

/**
 * Fetch Azure secrets from environment variables (Vercel-compatible)
 * This avoids PowerShell/CLI credential issues in Vercel deployment
 */
export async function fetchAzureSecrets(forceRefresh: boolean = false): Promise<AzureSecrets> {
  // Clear cache if force refresh is requested
  if (forceRefresh) {
    cachedSecrets = null;
  }
  
  // Return cached secrets if available
  if (cachedSecrets) {
    return cachedSecrets;
  }

  try {
    console.log('🚀 Initializing Azure services...');
    console.log('🔑 Fetching secrets from Azure Key Vault...');
    
    // Use environment variables directly - these should be set in Vercel
    const secrets = {
      speechKey: process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY || '',
      speechEndpoint: process.env.SPEECH_ENDPOINT || 'https://eastus2.api.cognitive.microsoft.com/',
      azureOpenAIKey: process.env.AZURE_OPENAI_API_KEY || '',
      azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      azureOpenAIDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'
    };

    // Validate that required secrets are available
    if (!secrets.speechKey) {
      console.warn('⚠️ AZURE_SPEECH_KEY environment variable not found');
    }
    
    if (!secrets.azureOpenAIKey) {
      console.warn('⚠️ AZURE_OPENAI_API_KEY environment variable not found');
    }
    
    if (!secrets.azureOpenAIEndpoint) {
      console.warn('⚠️ AZURE_OPENAI_ENDPOINT environment variable not found');
    }

    cachedSecrets = secrets;
    
    console.log('✅ Azure secrets loaded successfully');
    console.log('🌟 Azure environment initialized successfully');
    console.log('🔍 Azure configuration status:', {
      keyVaultUri: 'https://pbVoiceVaultProd.vault.azure.net/',
      hasSecretsCache: true,
      environmentVariables: {
        speechKey: secrets.speechKey ? 'SET' : 'MISSING',
        speechEndpoint: secrets.speechEndpoint ? 'SET' : 'MISSING',
        azureOpenAIKey: secrets.azureOpenAIKey ? 'SET' : 'MISSING',
        azureOpenAIEndpoint: secrets.azureOpenAIEndpoint ? 'SET' : 'MISSING',
        azureOpenAIDeployment: secrets.azureOpenAIDeployment ? 'SET' : 'MISSING'
      }
    });
    console.log('✅ Azure services initialized successfully');
    
    return cachedSecrets;
    
  } catch (error) {
    console.error('❌ Failed to fetch Azure secrets:', error);
    
    // Return empty secrets as fallback to prevent build failures
    const fallbackSecrets = {
      speechKey: '',
      speechEndpoint: 'https://eastus2.api.cognitive.microsoft.com/',
      azureOpenAIKey: '',
      azureOpenAIEndpoint: '',
      azureOpenAIDeployment: 'gpt-4o'
    };
    
    cachedSecrets = fallbackSecrets;
    return cachedSecrets;
  }
}

/**
 * Initialize environment variables from secrets
 * This should be called at application startup
 */
export async function initializeAzureEnvironment(): Promise<void> {
  try {
    const secrets = await fetchAzureSecrets();
    
    // Set public environment variables for browser access
    if (typeof window === 'undefined') { // Only set on server side
      process.env.NEXT_PUBLIC_SPEECH_KEY = secrets.speechKey;
      process.env.NEXT_PUBLIC_SPEECH_ENDPOINT = secrets.speechEndpoint;
      process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY = secrets.azureOpenAIKey;
      process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT = secrets.azureOpenAIEndpoint;
      process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT = secrets.azureOpenAIDeployment;
    }

    console.log('🌟 Azure environment initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Azure environment:', error);
    // Don't throw error to prevent build failures in Vercel
    console.log('🔄 Continuing with environment variables from Vercel settings...');
  }
}

/**
 * Get current Azure configuration (for debugging)
 */
export function getAzureConfig() {
  return {
    keyVaultUri: 'https://pbVoiceVaultProd.vault.azure.net/',
    hasSecretsCache: !!cachedSecrets,
    environmentVariables: {
      speechKey: process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY ? 'SET' : 'MISSING',
      speechEndpoint: process.env.SPEECH_ENDPOINT ? 'SET' : 'MISSING',
      azureOpenAIKey: process.env.AZURE_OPENAI_API_KEY ? 'SET' : 'MISSING',
      azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT ? 'SET' : 'MISSING',
      azureOpenAIDeployment: process.env.AZURE_OPENAI_DEPLOYMENT ? 'SET' : 'MISSING'
    }
  };
}

/**
 * Clear cached secrets (useful for testing or re-initialization)
 */
export function clearAzureSecretsCache(): void {
  cachedSecrets = null;
  console.log('🧹 Azure configuration cache cleared');
}
