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
  // Firebase configuration
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
  // Additional Azure services
  azureFormRecognizerKey?: string;
  azureFormRecognizerEndpoint?: string;
  azureStorageAccountName?: string;
  azureStorageAccountKey?: string;
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

    // Helper function to suppress expected 404 errors for optional secrets
    const getOptionalSecret = (name: string) => 
      client.getSecret(name).catch(err => {
        if (err.statusCode !== 404) {
          console.warn(`⚠️ Unexpected error fetching optional secret '${name}':`, err.message);
        }
        return null;
      });

    // Fetch all secrets (some are optional)
    const [
      speechKey, speechEndpoint, azureOpenAIKey, azureOpenAIEndpoint, azureOpenAIDeployment,
      firebaseProjectId, firebaseClientEmail, firebasePrivateKey,
      azureFormRecognizerKey, azureFormRecognizerEndpoint, azureStorageAccountName, azureStorageAccountKey
    ] = await Promise.all([
      client.getSecret('speech-key'),
      client.getSecret('speech-endpoint'),
      client.getSecret('azure-openai-key'),
      client.getSecret('azure-openai-endpoint'),
      client.getSecret('azure-openai-deployment'),
      getOptionalSecret('firebase-project-id'),
      getOptionalSecret('firebase-client-email'),
      getOptionalSecret('firebase-private-key'),
      getOptionalSecret('azure-form-recognizer-key'),
      getOptionalSecret('azure-form-recognizer-endpoint'),
      getOptionalSecret('azure-storage-account-name'),
      getOptionalSecret('azure-storage-account-key')
    ]);

    // Validate only Azure-related secrets (Firebase can come from env vars)
    const requiredAzureSecrets = {
      speechKey: speechKey?.value,
      speechEndpoint: speechEndpoint?.value,
      azureOpenAIKey: azureOpenAIKey?.value,
      azureOpenAIEndpoint: azureOpenAIEndpoint?.value,
      azureOpenAIDeployment: azureOpenAIDeployment?.value
    };

    const missingAzureSecrets = Object.entries(requiredAzureSecrets)
      .filter(([_, value]) => !value)
      .map(([key, _]) => key);

    if (missingAzureSecrets.length > 0) {
      throw new Error(`Required Azure secrets missing from Key Vault: ${missingAzureSecrets.join(', ')}`);
    }

    cachedSecrets = {
      speechKey: speechKey.value!,
      speechEndpoint: speechEndpoint.value!,
      azureOpenAIKey: azureOpenAIKey.value!,
      azureOpenAIEndpoint: azureOpenAIEndpoint.value!,
      azureOpenAIDeployment: azureOpenAIDeployment.value!,
      firebaseProjectId: firebaseProjectId?.value || process.env.FIREBASE_PROJECT_ID || '',
      firebaseClientEmail: firebaseClientEmail?.value || process.env.FIREBASE_CLIENT_EMAIL || '',
      firebasePrivateKey: firebasePrivateKey?.value || process.env.FIREBASE_PRIVATE_KEY || '',
      azureFormRecognizerKey: azureFormRecognizerKey?.value,
      azureFormRecognizerEndpoint: azureFormRecognizerEndpoint?.value,
      azureStorageAccountName: azureStorageAccountName?.value,
      azureStorageAccountKey: azureStorageAccountKey?.value
    };

    console.log('✅ Azure secrets loaded successfully');
    return cachedSecrets;

  } catch (error) {
    console.error('❌ Failed to fetch Azure secrets:', error);
    
    // Fallback to environment variables if Key Vault fails
    console.log('🔄 Falling back to environment variables...');
    const fallbackSecrets: AzureSecrets = {
      speechKey: process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY || '',
      speechEndpoint: process.env.SPEECH_ENDPOINT || 'https://eastus2.api.cognitive.microsoft.com/',
      azureOpenAIKey: process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY || '',
      azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      azureOpenAIDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || '',
      // Firebase fallbacks
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
      firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
      firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || '',
      // Optional fallbacks
      azureFormRecognizerKey: process.env.AZURE_FORM_RECOGNIZER_KEY,
      azureFormRecognizerEndpoint: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
      azureStorageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
      azureStorageAccountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY
    };

    // Only warn about critical missing secrets
    const missingCritical = [];
    if (!fallbackSecrets.speechKey) missingCritical.push('SPEECH_KEY');
    if (!fallbackSecrets.azureOpenAIKey) missingCritical.push('AZURE_OPENAI_KEY');
    
    // Only warn about missing optional secrets if not available from environment
    const missingOptional = [];
    if (!fallbackSecrets.firebaseProjectId && !process.env.FIREBASE_PROJECT_ID) missingOptional.push('FIREBASE_PROJECT_ID');

    if (missingCritical.length > 0) {
      console.error(`❌ Critical secrets missing: ${missingCritical.join(', ')}`);
    }
    if (missingOptional.length > 0) {
      console.warn(`⚠️ Optional secrets missing: ${missingOptional.join(', ')}`);
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
    
    // Set Azure service environment variables
    process.env.NEXT_PUBLIC_SPEECH_KEY = secrets.speechKey;
    process.env.NEXT_PUBLIC_SPEECH_ENDPOINT = secrets.speechEndpoint;
    process.env.SPEECH_KEY = secrets.speechKey;
    process.env.SPEECH_ENDPOINT = secrets.speechEndpoint;
    
    // Set Azure OpenAI environment variables
    process.env.AZURE_OPENAI_KEY = secrets.azureOpenAIKey;
    process.env.AZURE_OPENAI_ENDPOINT = secrets.azureOpenAIEndpoint;
    process.env.AZURE_OPENAI_DEPLOYMENT = secrets.azureOpenAIDeployment;
    process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY = secrets.azureOpenAIKey;
    process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT = secrets.azureOpenAIEndpoint;
    process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT = secrets.azureOpenAIDeployment;
    
    // Set Firebase environment variables
    process.env.FIREBASE_PROJECT_ID = secrets.firebaseProjectId;
    process.env.FIREBASE_CLIENT_EMAIL = secrets.firebaseClientEmail;
    process.env.FIREBASE_PRIVATE_KEY = secrets.firebasePrivateKey;
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = secrets.firebaseProjectId;
    
    // Set optional Azure services if available
    if (secrets.azureFormRecognizerKey) {
      process.env.AZURE_FORM_RECOGNIZER_KEY = secrets.azureFormRecognizerKey;
    }
    if (secrets.azureFormRecognizerEndpoint) {
      process.env.AZURE_FORM_RECOGNIZER_ENDPOINT = secrets.azureFormRecognizerEndpoint;
    }
    if (secrets.azureStorageAccountName) {
      process.env.AZURE_STORAGE_ACCOUNT_NAME = secrets.azureStorageAccountName;
    }
    if (secrets.azureStorageAccountKey) {
      process.env.AZURE_STORAGE_ACCOUNT_KEY = secrets.azureStorageAccountKey;
    }

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
      azureOpenAIDeployment: !!process.env.AZURE_OPENAI_DEPLOYMENT
    }
  };
}
