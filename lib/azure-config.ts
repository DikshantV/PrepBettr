import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

// Client-side safety check - provide empty implementations when running on client
const isClient = typeof window !== 'undefined';

if (isClient) {
  console.warn('[Azure Config] Running on client side - using fallback implementations');
}

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
  firebaseClientKey?: string;
  // Additional Azure services
  azureFormRecognizerKey?: string;
  azureFormRecognizerEndpoint?: string;
  // Storage configuration
  azureStorageAccount?: string;
  azureStorageAccountKey?: string;
  azureStorageConnectionString?: string;
  azureStorageContainer?: string;
  storageProvider?: string;
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
  if (isClient) return;
  console.log('🔄 Clearing Azure secrets cache...');
  cachedSecrets = null;
}

/**
 * Fetch secrets from Azure Key Vault
 */
export async function fetchAzureSecrets(forceRefresh: boolean = false): Promise<AzureSecrets> {
  if (isClient) {
    return {
      speechKey: '',
      speechEndpoint: '',
      azureOpenAIKey: '',
      azureOpenAIEndpoint: '',
      azureOpenAIDeployment: '',
      firebaseProjectId: '',
      firebaseClientEmail: '',
      firebasePrivateKey: ''
    };
  }
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
      firebaseProjectId, firebaseClientEmail, firebasePrivateKey, firebaseClientKey,
      azureFormRecognizerKey, azureFormRecognizerEndpoint, 
      azureStorageAccount, azureStorageAccountKey, azureStorageConnectionString,
      azureStorageContainer, storageProvider
    ] = await Promise.all([
      client.getSecret('speech-key'),
      client.getSecret('speech-endpoint'),
      client.getSecret('azure-openai-key'),
      client.getSecret('azure-openai-endpoint'),
      client.getSecret('azure-openai-deployment'),
      getOptionalSecret('firebase-project-id'),
      getOptionalSecret('firebase-client-email'),
      getOptionalSecret('firebase-private-key'),
      getOptionalSecret('NEXT-PUBLIC-FIREBASE-CLIENT-KEY'),
      getOptionalSecret('azure-form-recognizer-key'),
      getOptionalSecret('azure-form-recognizer-endpoint'),
      getOptionalSecret('azure-storage-account'),
      getOptionalSecret('azure-storage-account-key'),
      getOptionalSecret('azure-storage-connection-string'),
      getOptionalSecret('azure-storage-container'),
      getOptionalSecret('storage-provider')
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

    // Log which secrets came from where
    const secretSources = {
      firebaseProjectId: firebaseProjectId?.value ? 'Azure KV' : (process.env.FIREBASE_PROJECT_ID ? 'env' : 'missing'),
      firebaseClientEmail: firebaseClientEmail?.value ? 'Azure KV' : (process.env.FIREBASE_CLIENT_EMAIL ? 'env' : 'missing'),
      firebasePrivateKey: firebasePrivateKey?.value ? 'Azure KV' : (process.env.FIREBASE_PRIVATE_KEY ? 'env' : 'missing')
    };
    
    console.log('🔑 Secret sources for Firebase configuration:', secretSources);
    
    cachedSecrets = {
      speechKey: speechKey.value!,
      speechEndpoint: speechEndpoint.value!,
      azureOpenAIKey: azureOpenAIKey.value!,
      azureOpenAIEndpoint: azureOpenAIEndpoint.value!,
      azureOpenAIDeployment: azureOpenAIDeployment.value!,
      firebaseProjectId: firebaseProjectId?.value || process.env.FIREBASE_PROJECT_ID || '',
      firebaseClientEmail: firebaseClientEmail?.value || process.env.FIREBASE_CLIENT_EMAIL || '',
      firebasePrivateKey: firebasePrivateKey?.value || process.env.FIREBASE_PRIVATE_KEY || '',
      firebaseClientKey: firebaseClientKey?.value || '',
      azureFormRecognizerKey: azureFormRecognizerKey?.value,
      azureFormRecognizerEndpoint: azureFormRecognizerEndpoint?.value,
      azureStorageAccount: azureStorageAccount?.value,
      azureStorageAccountKey: azureStorageAccountKey?.value,
      azureStorageConnectionString: azureStorageConnectionString?.value,
      azureStorageContainer: azureStorageContainer?.value,
      storageProvider: storageProvider?.value
    };

    console.log('✅ Azure secrets loaded successfully');
    return cachedSecrets;

  } catch (error) {
    console.error('❌ Failed to fetch Azure secrets:', error);
    
    // Fallback to environment variables if Key Vault fails
    console.log('🔄 Falling back to environment variables...');
    
    // Log fallback sources for Firebase
    const fallbackSources = {
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID ? 'env fallback' : 'missing',
      firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 'env fallback' : 'missing',
      firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ? 'env fallback' : 'missing'
    };
    
    console.log('🔑 Fallback secret sources for Firebase configuration:', fallbackSources);
    
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
      firebaseClientKey: '',
      // Optional fallbacks
      azureFormRecognizerKey: process.env.AZURE_FORM_RECOGNIZER_KEY,
      azureFormRecognizerEndpoint: process.env.AZURE_FORM_RECOGNIZER_ENDPOINT,
      azureStorageAccount: process.env.AZURE_STORAGE_ACCOUNT_NAME,
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
  if (isClient) return;
  try {
    const secrets = await fetchAzureSecrets();
    
    // Set Azure service environment variables
    process.env.SPEECH_KEY = secrets.speechKey;
    process.env.SPEECH_ENDPOINT = secrets.speechEndpoint;
    
    // Set Azure OpenAI environment variables
    process.env.AZURE_OPENAI_KEY = secrets.azureOpenAIKey;
    process.env.AZURE_OPENAI_ENDPOINT = secrets.azureOpenAIEndpoint;
    process.env.AZURE_OPENAI_DEPLOYMENT = secrets.azureOpenAIDeployment;
    
    // Set Firebase environment variables
    process.env.FIREBASE_PROJECT_ID = secrets.firebaseProjectId;
    process.env.FIREBASE_CLIENT_EMAIL = secrets.firebaseClientEmail;
    process.env.FIREBASE_PRIVATE_KEY = secrets.firebasePrivateKey;
    
    // Set client-side environment variables using string concatenation to avoid Next.js inlining
    const nextPublicPrefix = 'NEXT_PUBLIC_';
    process.env[nextPublicPrefix + 'SPEECH_KEY'] = secrets.speechKey;
    process.env[nextPublicPrefix + 'SPEECH_ENDPOINT'] = secrets.speechEndpoint;
    process.env[nextPublicPrefix + 'AZURE_OPENAI_API_KEY'] = secrets.azureOpenAIKey;
    process.env[nextPublicPrefix + 'AZURE_OPENAI_ENDPOINT'] = secrets.azureOpenAIEndpoint;
    process.env[nextPublicPrefix + 'AZURE_OPENAI_DEPLOYMENT'] = secrets.azureOpenAIDeployment;
    process.env[nextPublicPrefix + 'FIREBASE_PROJECT_ID'] = secrets.firebaseProjectId;
    
    // Set the Firebase client key from secrets or environment
    if (secrets.firebaseClientKey) {
      process.env[nextPublicPrefix + 'FIREBASE_CLIENT_KEY'] = secrets.firebaseClientKey;
      console.log('🔑 Firebase client key set from Azure Key Vault');
    } else {
      console.warn('⚠️ Firebase client key not found in Azure Key Vault');
    }
    
    // Set optional Azure services if available
    if (secrets.azureFormRecognizerKey) {
      process.env.AZURE_FORM_RECOGNIZER_KEY = secrets.azureFormRecognizerKey;
    }
    if (secrets.azureFormRecognizerEndpoint) {
      process.env.AZURE_FORM_RECOGNIZER_ENDPOINT = secrets.azureFormRecognizerEndpoint;
    }
    // Set storage configuration
    if (secrets.azureStorageAccount) {
      process.env.AZURE_STORAGE_ACCOUNT = secrets.azureStorageAccount;
    }
    if (secrets.azureStorageAccountKey) {
      process.env.AZURE_STORAGE_ACCOUNT_KEY = secrets.azureStorageAccountKey;
    }
    if (secrets.azureStorageConnectionString) {
      process.env.AZURE_STORAGE_CONNECTION_STRING = secrets.azureStorageConnectionString;
    }
    if (secrets.azureStorageContainer) {
      process.env.AZURE_STORAGE_CONTAINER = secrets.azureStorageContainer;
    }
    if (secrets.storageProvider) {
      process.env.STORAGE_PROVIDER = secrets.storageProvider;
    }

    console.log('🌟 Azure environment initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Azure environment:', error);
    throw error;
  }
}

/**
 * Get generic configuration values (used by storage abstraction and other services)
 */
export async function getConfiguration(): Promise<Record<string, string>> {
  try {
    const secrets = await fetchAzureSecrets();
    
    return {
      // Azure Storage configuration
      'AZURE_STORAGE_ACCOUNT': secrets.azureStorageAccount || process.env.AZURE_STORAGE_ACCOUNT || 'prepbettrstorage684',
      'AZURE_STORAGE_ACCOUNT_KEY': secrets.azureStorageAccountKey || process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
      'AZURE_STORAGE_CONNECTION_STRING': secrets.azureStorageConnectionString || process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      'AZURE_STORAGE_CONTAINER': secrets.azureStorageContainer || process.env.AZURE_STORAGE_CONTAINER || 'resumes',
      'STORAGE_PROVIDER': secrets.storageProvider || process.env.STORAGE_PROVIDER || 'firebase',
      
      // Azure AI services
      'AZURE_OPENAI_KEY': secrets.azureOpenAIKey,
      'AZURE_OPENAI_ENDPOINT': secrets.azureOpenAIEndpoint,
      'AZURE_OPENAI_DEPLOYMENT': secrets.azureOpenAIDeployment,
      'AZURE_SPEECH_KEY': secrets.speechKey,
      'AZURE_SPEECH_ENDPOINT': secrets.speechEndpoint,
      'AZURE_FORM_RECOGNIZER_KEY': secrets.azureFormRecognizerKey || '',
      'AZURE_FORM_RECOGNIZER_ENDPOINT': secrets.azureFormRecognizerEndpoint || '',
      
      // Firebase configuration
      'FIREBASE_PROJECT_ID': secrets.firebaseProjectId,
      'FIREBASE_CLIENT_EMAIL': secrets.firebaseClientEmail,
      'FIREBASE_PRIVATE_KEY': secrets.firebasePrivateKey,
      'FIREBASE_CLIENT_KEY': secrets.firebaseClientKey || ''
    };
  } catch (error) {
    console.warn('Failed to get configuration from Azure, using environment variables:', error);
    
    // Fallback to environment variables only
    return {
      'AZURE_STORAGE_ACCOUNT': process.env.AZURE_STORAGE_ACCOUNT || 'prepbettrstorage684',
      'AZURE_STORAGE_ACCOUNT_KEY': process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
      'AZURE_STORAGE_CONNECTION_STRING': process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      'AZURE_STORAGE_CONTAINER': process.env.AZURE_STORAGE_CONTAINER || 'resumes',
      'STORAGE_PROVIDER': process.env.STORAGE_PROVIDER || 'firebase',
      'AZURE_OPENAI_KEY': process.env.AZURE_OPENAI_KEY || '',
      'AZURE_OPENAI_ENDPOINT': process.env.AZURE_OPENAI_ENDPOINT || '',
      'AZURE_OPENAI_DEPLOYMENT': process.env.AZURE_OPENAI_DEPLOYMENT || '',
      'AZURE_SPEECH_KEY': process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY || '',
      'AZURE_SPEECH_ENDPOINT': process.env.SPEECH_ENDPOINT || '',
      'AZURE_FORM_RECOGNIZER_KEY': process.env.AZURE_FORM_RECOGNIZER_KEY || '',
      'AZURE_FORM_RECOGNIZER_ENDPOINT': process.env.AZURE_FORM_RECOGNIZER_ENDPOINT || '',
      'FIREBASE_PROJECT_ID': process.env.FIREBASE_PROJECT_ID || '',
      'FIREBASE_CLIENT_EMAIL': process.env.FIREBASE_CLIENT_EMAIL || '',
      'FIREBASE_PRIVATE_KEY': process.env.FIREBASE_PRIVATE_KEY || '',
      // Use string concatenation to avoid Next.js inlining
      'FIREBASE_CLIENT_KEY': process.env['NEXT_PUBLIC_' + 'FIREBASE_CLIENT_KEY'] || ''
    };
  }
}

/**
 * Get current Azure configuration (for debugging)
 */
export function getAzureConfig() {
  const nextPublicPrefix = 'NEXT_PUBLIC_';
  return {
    keyVaultUri: AZURE_KEY_VAULT_URI,
    hasSecretsCache: !!cachedSecrets,
    environment: {
      speechKey: !!process.env[nextPublicPrefix + 'SPEECH_KEY'],
      speechEndpoint: !!process.env[nextPublicPrefix + 'SPEECH_ENDPOINT'],
      azureOpenAIKey: !!process.env.AZURE_OPENAI_KEY,
      azureOpenAIEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
      azureOpenAIDeployment: !!process.env.AZURE_OPENAI_DEPLOYMENT
    }
  };
}
