import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

// Azure Key Vault configuration
const AZURE_KEY_VAULT_URI = process.env.AZURE_KEY_VAULT_URI || 'https://prepbettr-keyvault-083.vault.azure.net/';

interface AzureSecrets {
  speechKey: string;
  speechEndpoint: string;
  azureOpenAIKey: string;
  azureOpenAIEndpoint: string;
  azureOpenAIDeployment: string;
  azureOpenAIGpt35Deployment?: string; // gpt-35-turbo deployment
  azureOpenAIGpt4oDeployment?: string; // gpt-4o deployment
  azureStorageAccountName?: string; // Azure Storage Account Name
  azureStorageAccountKey?: string; // Azure Storage Account Key
  azureFormRecognizerEndpoint?: string; // Azure Form Recognizer Endpoint
  azureFormRecognizerKey?: string; // Azure Form Recognizer Key
}

let cachedSecrets: AzureSecrets | null = null;

/**
 * Initialize Azure Key Vault client
 */
function createKeyVaultClient(): SecretClient {
  if (!AZURE_KEY_VAULT_URI) {
    throw new Error('AZURE_KEY_VAULT_URI environment variable is required');
  }
  
  try {
    const credential = new DefaultAzureCredential();
    return new SecretClient(AZURE_KEY_VAULT_URI, credential);
  } catch (error) {
    console.error('❌ Failed to create DefaultAzureCredential:', error);
    console.error('💡 Hint: Ensure you are logged in with "az login" for local development');
    throw error;
  }
}

/**
 * Fetch secrets from Azure Key Vault
 */
export async function fetchAzureSecrets(): Promise<AzureSecrets> {
  // Return cached secrets if available
  if (cachedSecrets) {
    return cachedSecrets;
  }

  try {
    console.log('🔑 Fetching secrets from Azure Key Vault...');
    const client = createKeyVaultClient();

    // Fetch all required secrets
    const [speechKey, speechEndpoint, azureOpenAIKey, azureOpenAIEndpoint, azureOpenAIDeployment, azureOpenAIGpt35, azureOpenAIGpt4o, storageAccountName, storageAccountKey, formRecognizerEndpoint, formRecognizerKey] = await Promise.all([
      client.getSecret('speech-key'),
      client.getSecret('speech-endpoint'),
      client.getSecret('azure-openai-key'),
      client.getSecret('azure-openai-endpoint'),
      client.getSecret('azure-openai-deployment'),
      client.getSecret('azure-openai-gpt35-deployment').catch(() => null), // Optional
      client.getSecret('azure-openai-gpt4o-deployment').catch(() => null),  // Optional
      client.getSecret('azure-storage-account-name').catch(() => null), // Optional
      client.getSecret('azure-storage-account-key').catch(() => null), // Optional
      client.getSecret('azure-form-recognizer-endpoint').catch(() => null), // Optional
      client.getSecret('azure-form-recognizer-key').catch(() => null) // Optional
    ]);

    if (!speechKey.value || !speechEndpoint.value || !azureOpenAIKey.value || !azureOpenAIEndpoint.value || !azureOpenAIDeployment.value) {
      throw new Error('One or more required secrets are missing from Azure Key Vault');
    }

    cachedSecrets = {
      speechKey: speechKey.value,
      speechEndpoint: speechEndpoint.value,
      azureOpenAIKey: azureOpenAIKey.value,
      azureOpenAIEndpoint: azureOpenAIEndpoint.value,
      azureOpenAIDeployment: azureOpenAIDeployment.value,
      azureOpenAIGpt35Deployment: azureOpenAIGpt35?.value || 'gpt-4o',
      azureOpenAIGpt4oDeployment: azureOpenAIGpt4o?.value || 'gpt-4o',
      azureStorageAccountName: storageAccountName?.value,
      azureStorageAccountKey: storageAccountKey?.value,
      azureFormRecognizerEndpoint: formRecognizerEndpoint?.value,
      azureFormRecognizerKey: formRecognizerKey?.value
    };

    console.log('✅ Azure secrets loaded successfully');
    return cachedSecrets;

  } catch (error) {
    console.error('❌ Failed to fetch Azure secrets:', error);
    
    // Fallback to environment variables if Key Vault fails
    console.log('🔄 Falling back to environment variables...');
    const fallbackSecrets = {
      speechKey: process.env.SPEECH_KEY || process.env.NEXT_PUBLIC_SPEECH_KEY || '',
      speechEndpoint: process.env.SPEECH_ENDPOINT || process.env.NEXT_PUBLIC_SPEECH_ENDPOINT || '',
      azureOpenAIKey: process.env.AZURE_OPENAI_KEY || '',
      azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      azureOpenAIDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || '',
      azureOpenAIGpt35Deployment: process.env.AZURE_OPENAI_GPT35_DEPLOYMENT || 'gpt-4o',
      azureOpenAIGpt4oDeployment: process.env.AZURE_OPENAI_GPT4O_DEPLOYMENT || 'gpt-4o',
      azureStorageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
      azureStorageAccountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
      azureFormRecognizerEndpoint: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
      azureFormRecognizerKey: process.env.AZURE_FORM_RECOGNIZER_KEY
    };

    if (!fallbackSecrets.speechKey || !fallbackSecrets.azureOpenAIKey) {
      console.warn('⚠️ Some secrets are missing from both Key Vault and environment variables');
    }

    cachedSecrets = fallbackSecrets;
    return cachedSecrets;
  }
}

/**
 * Initialize environment variables from Azure Key Vault
 * This should be called at application startup
 */
export async function initializeAzureEnvironment(): Promise<void> {
  try {
    const secrets = await fetchAzureSecrets();
    
    // Set environment variables for the application
    process.env.NEXT_PUBLIC_SPEECH_KEY = secrets.speechKey;
    process.env.NEXT_PUBLIC_SPEECH_ENDPOINT = secrets.speechEndpoint;
    process.env.AZURE_OPENAI_KEY = secrets.azureOpenAIKey;
    process.env.AZURE_OPENAI_ENDPOINT = secrets.azureOpenAIEndpoint;
    process.env.AZURE_OPENAI_DEPLOYMENT = secrets.azureOpenAIDeployment;
    process.env.AZURE_OPENAI_GPT35_DEPLOYMENT = secrets.azureOpenAIGpt35Deployment;
    process.env.AZURE_OPENAI_GPT4O_DEPLOYMENT = secrets.azureOpenAIGpt4oDeployment;

    // Set Azure OpenAI keys for public environment
    process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY = secrets.azureOpenAIKey;
    process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT = secrets.azureOpenAIEndpoint;
    process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT = secrets.azureOpenAIDeployment;
    process.env.NEXT_PUBLIC_AZURE_OPENAI_GPT35_DEPLOYMENT = secrets.azureOpenAIGpt35Deployment;
    process.env.NEXT_PUBLIC_AZURE_OPENAI_GPT4O_DEPLOYMENT = secrets.azureOpenAIGpt4oDeployment;

    console.log('🌟 Azure environment initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Azure environment:', error);
    throw error;
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
      azureOpenAIDeployment: !!process.env.AZURE_OPENAI_DEPLOYMENT,
      azureOpenAIGpt35Deployment: !!process.env.AZURE_OPENAI_GPT35_DEPLOYMENT,
      azureOpenAIGpt4oDeployment: !!process.env.AZURE_OPENAI_GPT4O_DEPLOYMENT
    },
    deployments: {
      default: process.env.AZURE_OPENAI_DEPLOYMENT,
      gpt35Turbo: process.env.AZURE_OPENAI_GPT35_DEPLOYMENT || 'gpt-4o',
      gpt4o: process.env.AZURE_OPENAI_GPT4O_DEPLOYMENT || 'gpt-4o'
    }
  };
}
