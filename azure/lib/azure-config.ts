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
  sendgridApiKey?: string; // SendGrid API Key
  sendgridFromEmail?: string; // SendGrid From Email
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

    // Fetch all required secrets - breaking into smaller groups to avoid transpilation issues
    // Group 1: Speech and OpenAI base secrets
    const secretsPromises = [
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
      client.getSecret('azure-form-recognizer-key').catch(() => null), // Optional
      client.getSecret('sendgrid-api-key').catch(() => null), // Optional
      client.getSecret('sendgrid-from-email').catch(() => null) // Optional
    ];
    
    const secretsResults = await Promise.all(secretsPromises);
    
    // Extract secrets from results
    const speechKey = secretsResults[0];
    const speechEndpoint = secretsResults[1];
    const azureOpenAIKey = secretsResults[2];
    const azureOpenAIEndpoint = secretsResults[3];
    const azureOpenAIDeployment = secretsResults[4];
    const azureOpenAIGpt35 = secretsResults[5];
    const azureOpenAIGpt4o = secretsResults[6];
    const storageAccountName = secretsResults[7];
    const storageAccountKey = secretsResults[8];
    const formRecognizerEndpoint = secretsResults[9];
    const formRecognizerKey = secretsResults[10];
    const sendgridApiKey = secretsResults[11];
    const sendgridFromEmail = secretsResults[12];

    if (!speechKey?.value || !speechEndpoint?.value || !azureOpenAIKey?.value || !azureOpenAIEndpoint?.value || !azureOpenAIDeployment?.value) {
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
      azureFormRecognizerKey: formRecognizerKey?.value,
      sendgridApiKey: sendgridApiKey?.value,
      sendgridFromEmail: sendgridFromEmail?.value
    };

    console.log('✅ Azure secrets loaded successfully');
    return cachedSecrets;

  } catch (error) {
    console.error('❌ Failed to fetch Azure secrets:', error);
    
    // Fallback to environment variables if Key Vault fails
    console.log('🔄 Falling back to environment variables...');
    const processEnv = process.env as any;
    const fallbackSecrets = {
      speechKey: processEnv['SPEECH_KEY'] || processEnv['NEXT_PUBLIC_SPEECH_KEY'] || '',
      speechEndpoint: processEnv['SPEECH_ENDPOINT'] || processEnv['NEXT_PUBLIC_SPEECH_ENDPOINT'] || '',
      azureOpenAIKey: processEnv['AZURE_OPENAI_KEY'] || '',
      azureOpenAIEndpoint: processEnv['AZURE_OPENAI_ENDPOINT'] || '',
      azureOpenAIDeployment: processEnv['AZURE_OPENAI_DEPLOYMENT'] || '',
      azureOpenAIGpt35Deployment: processEnv['AZURE_OPENAI_GPT35_DEPLOYMENT'] || 'gpt-4o',
      azureOpenAIGpt4oDeployment: processEnv['AZURE_OPENAI_GPT4O_DEPLOYMENT'] || 'gpt-4o',
      azureStorageAccountName: processEnv['AZURE_STORAGE_ACCOUNT_NAME'],
      azureStorageAccountKey: processEnv['AZURE_STORAGE_ACCOUNT_KEY'],
      azureFormRecognizerEndpoint: processEnv['AZURE_FORM_RECOGNIZER_ENDPOINT'],
      azureFormRecognizerKey: processEnv['AZURE_FORM_RECOGNIZER_KEY'],
      sendgridApiKey: processEnv['SENDGRID_API_KEY'],
      sendgridFromEmail: processEnv['SENDGRID_FROM_EMAIL']
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
    
    // Set environment variables for the application (using dynamic property assignment to avoid webpack replacement)
    const processEnv = process.env as any;
    processEnv['NEXT_PUBLIC_SPEECH_KEY'] = secrets.speechKey;
    processEnv['NEXT_PUBLIC_SPEECH_ENDPOINT'] = secrets.speechEndpoint;
    processEnv['AZURE_OPENAI_KEY'] = secrets.azureOpenAIKey;
    processEnv['AZURE_OPENAI_ENDPOINT'] = secrets.azureOpenAIEndpoint;
    processEnv['AZURE_OPENAI_DEPLOYMENT'] = secrets.azureOpenAIDeployment;
    processEnv['AZURE_OPENAI_GPT35_DEPLOYMENT'] = secrets.azureOpenAIGpt35Deployment;
    processEnv['AZURE_OPENAI_GPT4O_DEPLOYMENT'] = secrets.azureOpenAIGpt4oDeployment;
    
    // Set SendGrid environment variables if available
    if (secrets.sendgridApiKey) {
      processEnv['SENDGRID_API_KEY'] = secrets.sendgridApiKey;
    }
    if (secrets.sendgridFromEmail) {
      processEnv['SENDGRID_FROM_EMAIL'] = secrets.sendgridFromEmail;
    }

    // Note: NEXT_PUBLIC_* variables are already handled by .env.local and don't need to be set here
    // Avoid setting them dynamically to prevent webpack build-time replacement conflicts

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
  const processEnv = process.env as any;
  return {
    keyVaultUri: AZURE_KEY_VAULT_URI,
    hasSecretsCache: !!cachedSecrets,
    environment: {
      speechKey: !!processEnv['NEXT_PUBLIC_SPEECH_KEY'],
      speechEndpoint: !!processEnv['NEXT_PUBLIC_SPEECH_ENDPOINT'],
      azureOpenAIKey: !!processEnv['AZURE_OPENAI_KEY'],
      azureOpenAIEndpoint: !!processEnv['AZURE_OPENAI_ENDPOINT'],
      azureOpenAIDeployment: !!processEnv['AZURE_OPENAI_DEPLOYMENT'],
      azureOpenAIGpt35Deployment: !!processEnv['AZURE_OPENAI_GPT35_DEPLOYMENT'],
      azureOpenAIGpt4oDeployment: !!processEnv['AZURE_OPENAI_GPT4O_DEPLOYMENT']
    },
    deployments: {
      default: processEnv['AZURE_OPENAI_DEPLOYMENT'],
      gpt35Turbo: processEnv['AZURE_OPENAI_GPT35_DEPLOYMENT'] || 'gpt-4o',
      gpt4o: processEnv['AZURE_OPENAI_GPT4O_DEPLOYMENT'] || 'gpt-4o'
    }
  };
}
