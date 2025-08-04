import { initializeAzureEnvironment, getAzureConfig } from './azure-config';

/**
 * Initialize Azure services on server startup
 * This should be called during Next.js server initialization
 */
export async function initializeAzureServices(): Promise<void> {
  // Only run on server side
  if (typeof window !== 'undefined') {
    console.log('🔄 Skipping Azure initialization on client side');
    return;
  }

  try {
    console.log('🚀 Initializing Azure services...');
    
    // Initialize Azure environment
    await initializeAzureEnvironment();
    
    // Log configuration status
    const config = getAzureConfig();
    console.log('🔍 Azure configuration status:', {
      keyVaultUri: config.keyVaultUri,
      hasSecretsCache: config.hasSecretsCache,
      environmentVariables: {
        speechKey: config.environment.speechKey ? 'SET' : 'MISSING',
        speechEndpoint: config.environment.speechEndpoint ? 'SET' : 'MISSING',
        azureOpenAIKey: config.environment.azureOpenAIKey ? 'SET' : 'MISSING',
        azureOpenAIEndpoint: config.environment.azureOpenAIEndpoint ? 'SET' : 'MISSING',
        azureOpenAIDeployment: config.environment.azureOpenAIDeployment ? 'SET' : 'MISSING'
      }
    });
    
    console.log('✅ Azure services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Azure services:', error);
    // Don't throw error - let the app continue with fallback environment variables
  }
}

/**
 * Health check for Azure services
 */
export function getAzureHealthStatus() {
  const config = getAzureConfig();
  
  const requiredServices = [
    'speechKey',
    'speechEndpoint', 
    'azureOpenAIKey',
    'azureOpenAIEndpoint',
    'azureOpenAIDeployment'
  ] as const;

  const status = requiredServices.reduce((acc, service) => {
    acc[service] = config.environment[service] ? 'healthy' : 'missing';
    return acc;
  }, {} as Record<typeof requiredServices[number], 'healthy' | 'missing'>);

  const overallHealth = Object.values(status).every(s => s === 'healthy') ? 'healthy' : 'degraded';

  return {
    overall: overallHealth,
    services: status,
    keyVault: {
      uri: config.keyVaultUri,
      cached: config.hasSecretsCache
    }
  };
}
