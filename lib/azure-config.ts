import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

// Azure Key Vault configuration
const AZURE_KEY_VAULT_URI = process.env.AZURE_KEY_VAULT_URI || 'https://pbVoiceVaultProd.vault.azure.net/';

interface AzureSecrets {
  speechKey: string;
  speechEndpoint: string;
  azureOpenAIKey: string;
  azureOpenAIEndpoint: string;
  azureOpenAIDeployment: string;
}

let cachedSecrets: AzureSecrets | null = null;

/**
 * Initialize Azure Key Vault client
 */
function createKeyVaultClient(): SecretClient {
  if (!AZURE_KEY_VAULT_URI) {
    throw new Error('AZURE_KEY_VAULT_URI environment variable is required');
  }
  
  const credential = new DefaultAzureCredential();
  return new SecretClient(AZURE_KEY_VAULT_URI, credential);
}

/**
 * Clear cached secrets (useful when Azure keys are renewed)
 */
export function clearAzureSecretsCache(): void {
  console.log('🔄 Clearing Azure secrets cache...');
  cachedSecrets = null;
}

/**
 * Fetch secrets from Azure Key Vault
 */
export async function fetchAzureSecrets(forceRefresh: boolean = false): Promise<AzureSecrets> {
  // Clear cache if force refresh is requested
  if (forceRefresh) {
    clearAzureSecretsCache();
  }
  
  // Return cached secrets if available
  if (cachedSecrets) {
    return cachedSecrets;
  }

  try {
    console.log('🔑 Fetching secrets from Azure Key Vault...');
    const client = createKeyVaultClient();

    // Fetch all required secrets
    const [speechKey, speechEndpoint, azureOpenAIKey, azureOpenAIEndpoint, azureOpenAIDeployment] = await Promise.all([
      client.getSecret('speech-key'),
      client.getSecret('speech-endpoint'),
      client.getSecret('azure-openai-key'),
      client.getSecret('azure-openai-endpoint'),
      client.getSecret('azure-openai-deployment')
    ]);

    if (!speechKey.value || !speechEndpoint.value || !azureOpenAIKey.value || !azureOpenAIEndpoint.value || !azureOpenAIDeployment.value) {
      throw new Error('One or more required secrets are missing from Azure Key Vault');
    }

    cachedSecrets = {
      speechKey: speechKey.value,
      speechEndpoint: speechEndpoint.value,
      azureOpenAIKey: azureOpenAIKey.value,
      azureOpenAIEndpoint: azureOpenAIEndpoint.value,
      azureOpenAIDeployment: azureOpenAIDeployment.value
    };

    console.log('✅ Azure secrets loaded successfully');
    return cachedSecrets;

  } catch (error) {
    console.error('❌ Failed to fetch Azure secrets:', error);
    
    // Fallback to environment variables if Key Vault fails
    console.log('🔄 Falling back to environment variables...');
    const fallbackSecrets = {
      speechKey: process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY || '',
      speechEndpoint: process.env.SPEECH_ENDPOINT || 'https://eastus2.api.cognitive.microsoft.com/',
      azureOpenAIKey: process.env.AZURE_OPENAI_API_KEY || '',
      azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      azureOpenAIDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || ''
    };

    if (!fallbackSecrets.speechKey || !fallbackSecrets.azureOpenAIKey) {
      console.warn('⚠️ Some secrets are missing from both Key Vault and environment variables');
    }

    cachedSecrets = fallbackSecrets;
    return cachedSecrets;
  }
}


/**
 * Get current Azure configuration (for debugging)
 */
export function getAzureConfig() {
  return {
    keyVaultUri: AZURE_KEY_VAULT_URI,
    hasSecretsCache: !!cachedSecrets,
    environment: {
      speechKey: !!process.env.NEXT_PUBLIC_SPEECH_KEY,
      speechEndpoint: !!process.env.NEXT_PUBLIC_SPEECH_ENDPOINT,
      azureOpenAIKey: !!process.env.AZURE_OPENAI_KEY,
      azureOpenAIEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
      azureOpenAIDeployment: !!process.env.AZURE_OPENAI_DEPLOYMENT
    }
  };
}
