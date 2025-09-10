/**
 * Environment validation for Azure AI Foundry migration
 * This module validates the presence of required Azure AI Foundry environment variables
 * and provides development fallbacks where appropriate.
 */

export interface AzureFoundryEnvironment {
  // Azure AI Foundry Core
  projectId: string;
  resourceGroup: string;
  subscriptionId: string;
  region: string;
  
  // Authentication
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  
  // Endpoints and Configuration  
  endpoint: string;
  apiVersion: string;
  
  // Models
  defaultChatModel: string;
  defaultEmbeddingModel: string;
  
  // Feature flags
  enableCostTracking: boolean;
  enableRequestLogging: boolean;
  enableFallback: boolean;
  
  // Development settings
  isDevelopment: boolean;
  isProduction: boolean;
}

interface EnvironmentValidation {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Required environment variables for Azure AI Foundry
 */
const REQUIRED_VARS = [
  'AZURE_FOUNDRY_PROJECT_ID',
  'AZURE_FOUNDRY_RESOURCE_GROUP', 
  'AZURE_FOUNDRY_SUBSCRIPTION_ID',
  'AZURE_FOUNDRY_REGION',
  'AZURE_FOUNDRY_ENDPOINT'
] as const;

/**
 * Optional environment variables with defaults
 */
const OPTIONAL_VARS = {
  'AZURE_FOUNDRY_CLIENT_ID': undefined,
  'AZURE_FOUNDRY_CLIENT_SECRET': undefined, 
  'AZURE_FOUNDRY_TENANT_ID': undefined,
  'AZURE_FOUNDRY_API_VERSION': '2024-02-15-preview',
  'AZURE_FOUNDRY_DEFAULT_CHAT_MODEL': 'gpt-4o',
  'AZURE_FOUNDRY_DEFAULT_EMBEDDING_MODEL': 'text-embedding-3-large',
  'AZURE_FOUNDRY_ENABLE_COST_TRACKING': 'true',
  'AZURE_FOUNDRY_ENABLE_REQUEST_LOGGING': 'false',
  'AZURE_FOUNDRY_ENABLE_FALLBACK': 'true'
} as const;

/**
 * Development fallback values
 */
const DEVELOPMENT_FALLBACKS = {
  'AZURE_FOUNDRY_PROJECT_ID': 'prepbettr-dev-project',
  'AZURE_FOUNDRY_RESOURCE_GROUP': 'prepbettr-dev-rg',
  'AZURE_FOUNDRY_SUBSCRIPTION_ID': 'dev-subscription-id',
  'AZURE_FOUNDRY_REGION': 'eastus',
  'AZURE_FOUNDRY_ENDPOINT': 'https://prepbettr-ai-foundry.services.ai.azure.com'
} as const;

/**
 * Get environment variable with validation
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (value) {
    return value;
  }
  
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  
  // Check for development fallbacks
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
  if (isDev && key in DEVELOPMENT_FALLBACKS) {
    const fallback = DEVELOPMENT_FALLBACKS[key as keyof typeof DEVELOPMENT_FALLBACKS];
    console.warn(`⚠️ Using development fallback for ${key}: ${fallback}`);
    return fallback;
  }
  
  throw new Error(`Missing required environment variable: ${key}`);
}

/**
 * Validate all required environment variables
 */
export function validateEnvironment(): EnvironmentValidation {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Check required variables
  for (const varName of REQUIRED_VARS) {
    try {
      getEnvVar(varName);
    } catch {
      missing.push(varName);
    }
  }
  
  // Check for legacy Azure OpenAI variables that should be replaced
  const legacyVars = [
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_ENDPOINT', 
    'AZURE_OPENAI_DEPLOYMENT',
    'NEXT_PUBLIC_AZURE_OPENAI_API_KEY',
    'NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT'
  ];
  
  for (const legacyVar of legacyVars) {
    if (process.env[legacyVar]) {
      warnings.push(`Legacy variable ${legacyVar} is still present. Consider removing after migration is complete.`);
    }
  }
  
  return {
    isValid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Get validated Azure AI Foundry environment configuration
 */
export function getEnv(): AzureFoundryEnvironment {
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    const missingVars = validation.missing.join(', ');
    throw new Error(`Missing required Azure AI Foundry environment variables: ${missingVars}`);
  }
  
  // Log warnings
  validation.warnings.forEach(warning => console.warn(`⚠️ ${warning}`));
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    // Core configuration
    projectId: getEnvVar('AZURE_FOUNDRY_PROJECT_ID'),
    resourceGroup: getEnvVar('AZURE_FOUNDRY_RESOURCE_GROUP'),
    subscriptionId: getEnvVar('AZURE_FOUNDRY_SUBSCRIPTION_ID'),
    region: getEnvVar('AZURE_FOUNDRY_REGION'),
    
    // Authentication (optional)
    clientId: getEnvVar('AZURE_FOUNDRY_CLIENT_ID', OPTIONAL_VARS.AZURE_FOUNDRY_CLIENT_ID),
    clientSecret: getEnvVar('AZURE_FOUNDRY_CLIENT_SECRET', OPTIONAL_VARS.AZURE_FOUNDRY_CLIENT_SECRET),
    tenantId: getEnvVar('AZURE_FOUNDRY_TENANT_ID', OPTIONAL_VARS.AZURE_FOUNDRY_TENANT_ID),
    
    // Endpoints
    endpoint: getEnvVar('AZURE_FOUNDRY_ENDPOINT'),
    apiVersion: getEnvVar('AZURE_FOUNDRY_API_VERSION', OPTIONAL_VARS.AZURE_FOUNDRY_API_VERSION),
    
    // Models
    defaultChatModel: getEnvVar('AZURE_FOUNDRY_DEFAULT_CHAT_MODEL', OPTIONAL_VARS.AZURE_FOUNDRY_DEFAULT_CHAT_MODEL),
    defaultEmbeddingModel: getEnvVar('AZURE_FOUNDRY_DEFAULT_EMBEDDING_MODEL', OPTIONAL_VARS.AZURE_FOUNDRY_DEFAULT_EMBEDDING_MODEL),
    
    // Feature flags
    enableCostTracking: getEnvVar('AZURE_FOUNDRY_ENABLE_COST_TRACKING', OPTIONAL_VARS.AZURE_FOUNDRY_ENABLE_COST_TRACKING) === 'true',
    enableRequestLogging: getEnvVar('AZURE_FOUNDRY_ENABLE_REQUEST_LOGGING', OPTIONAL_VARS.AZURE_FOUNDRY_ENABLE_REQUEST_LOGGING) === 'true',
    enableFallback: getEnvVar('AZURE_FOUNDRY_ENABLE_FALLBACK', OPTIONAL_VARS.AZURE_FOUNDRY_ENABLE_FALLBACK) === 'true',
    
    // Environment flags
    isDevelopment,
    isProduction
  };
}

/**
 * Get environment configuration with error handling for development
 */
export function getEnvSafe(): AzureFoundryEnvironment | null {
  try {
    return getEnv();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Failed to load Azure AI Foundry environment configuration:', error);
      return null;
    }
    throw error;
  }
}

/**
 * Initialize and validate environment on module load (for early validation)
 */
export function initializeEnvironment(): void {
  const validation = validateEnvironment();
  
  if (validation.warnings.length > 0) {
    console.log('🔧 Azure AI Foundry Environment Warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  if (!validation.isValid && process.env.NODE_ENV === 'production') {
    console.error('❌ Azure AI Foundry Environment Validation Failed:');
    validation.missing.forEach(missing => console.error(`  - Missing: ${missing}`));
    throw new Error('Production environment validation failed');
  }
  
  if (validation.isValid) {
    console.log('✅ Azure AI Foundry environment configuration validated');
  }
}

// Auto-initialize in production or when explicitly requested
if (process.env.NODE_ENV === 'production' || process.env.AZURE_FOUNDRY_AUTO_INIT === 'true') {
  initializeEnvironment();
}
