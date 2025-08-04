"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAzureSecrets = fetchAzureSecrets;
exports.initializeAzureEnvironment = initializeAzureEnvironment;
exports.getAzureConfig = getAzureConfig;
const identity_1 = require("@azure/identity");
const keyvault_secrets_1 = require("@azure/keyvault-secrets");
// Azure Key Vault configuration
const AZURE_KEY_VAULT_URI = process.env.AZURE_KEY_VAULT_URI || 'https://pbVoiceVaultProd.vault.azure.net/';
let cachedSecrets = null;
/**
 * Initialize Azure Key Vault client
 */
function createKeyVaultClient() {
    if (!AZURE_KEY_VAULT_URI) {
        throw new Error('AZURE_KEY_VAULT_URI environment variable is required');
    }
    const credential = new identity_1.DefaultAzureCredential();
    return new keyvault_secrets_1.SecretClient(AZURE_KEY_VAULT_URI, credential);
}
/**
 * Fetch secrets from Azure Key Vault
 */
function fetchAzureSecrets() {
    return __awaiter(this, void 0, void 0, function* () {
        // Return cached secrets if available
        if (cachedSecrets) {
            return cachedSecrets;
        }
        try {
            console.log('🔑 Fetching secrets from Azure Key Vault...');
            const client = createKeyVaultClient();
            // Fetch all required secrets
            const [speechKey, speechEndpoint, azureOpenAIKey, azureOpenAIEndpoint, azureOpenAIDeployment] = yield Promise.all([
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
        }
        catch (error) {
            console.error('❌ Failed to fetch Azure secrets:', error);
            // Fallback to environment variables if Key Vault fails
            console.log('🔄 Falling back to environment variables...');
            const fallbackSecrets = {
                speechKey: process.env.NEXT_PUBLIC_SPEECH_KEY || '',
                speechEndpoint: process.env.NEXT_PUBLIC_SPEECH_ENDPOINT || '',
                azureOpenAIKey: process.env.AZURE_OPENAI_KEY || '',
                azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
                azureOpenAIDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || ''
            };
            if (!fallbackSecrets.speechKey || !fallbackSecrets.azureOpenAIKey) {
                console.warn('⚠️ Some secrets are missing from both Key Vault and environment variables');
            }
            cachedSecrets = fallbackSecrets;
            return cachedSecrets;
        }
    });
}
/**
 * Initialize environment variables from Azure Key Vault
 * This should be called at application startup
 */
function initializeAzureEnvironment() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const secrets = yield fetchAzureSecrets();
            // Set environment variables for the application
            process.env.NEXT_PUBLIC_SPEECH_KEY = secrets.speechKey;
            process.env.NEXT_PUBLIC_SPEECH_ENDPOINT = secrets.speechEndpoint;
            process.env.AZURE_OPENAI_KEY = secrets.azureOpenAIKey;
            process.env.AZURE_OPENAI_ENDPOINT = secrets.azureOpenAIEndpoint;
            process.env.AZURE_OPENAI_DEPLOYMENT = secrets.azureOpenAIDeployment;
            // Also set the Azure OpenAI key for the public environment (used by Vocode)
            process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY = secrets.azureOpenAIKey;
            process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT = secrets.azureOpenAIEndpoint;
            console.log('🌟 Azure environment initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize Azure environment:', error);
            throw error;
        }
    });
}
/**
 * Get current Azure configuration (for debugging)
 */
function getAzureConfig() {
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
//# sourceMappingURL=azure-config.js.map