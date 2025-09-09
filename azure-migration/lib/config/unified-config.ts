/**
 * Unified Configuration System
 * 
 * Supports both Azure and Firebase services during migration period
 * with feature flags, environment management, and fallback strategies.
 */

import { IConfigService, FeatureFlag, MigrationState } from '../shared/interfaces';

// ===== CONFIGURATION TYPES =====

export interface ServiceConfig {
  provider: 'firebase' | 'azure';
  enabled: boolean;
  fallbackProvider?: 'firebase' | 'azure';
  config: Record<string, any>;
}

export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  
  // Firebase Configuration
  firebase: {
    auth: ServiceConfig;
    firestore: ServiceConfig;
    storage: ServiceConfig;
    functions: ServiceConfig;
    remoteConfig: ServiceConfig;
  };
  
  // Azure Configuration  
  azure: {
    auth: ServiceConfig;
    cosmosdb: ServiceConfig;
    blobStorage: ServiceConfig;
    functions: ServiceConfig;
    appConfiguration: ServiceConfig;
    speech: ServiceConfig;
    foundry: ServiceConfig;
    openai: ServiceConfig; // Legacy - deprecated
  };
  
  // Migration Settings
  migration: {
    enabled: boolean;
    rolloutPercentage: number;
    featureFlags: Record<string, FeatureFlag>;
    rollbackEnabled: boolean;
  };
}

// ===== CONFIGURATION TEMPLATES =====

export const DEFAULT_DEVELOPMENT_CONFIG: EnvironmentConfig = {
  environment: 'development',
  
  firebase: {
    auth: {
      provider: 'firebase',
      enabled: true,
      config: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientKey: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY,
        adminServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      }
    },
    firestore: {
      provider: 'firebase',
      enabled: true,
      fallbackProvider: 'azure',
      config: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        databaseId: '(default)'
      }
    },
    storage: {
      provider: 'firebase',
      enabled: true,
      fallbackProvider: 'azure',
      config: {
        bucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
      }
    },
    functions: {
      provider: 'firebase',
      enabled: true,
      fallbackProvider: 'azure',
      config: {
        region: 'us-central1'
      }
    },
    remoteConfig: {
      provider: 'firebase',
      enabled: true,
      fallbackProvider: 'azure',
      config: {
        minimumFetchIntervalMillis: 3600000 // 1 hour
      }
    }
  },
  
  azure: {
    auth: {
      provider: 'azure',
      enabled: false, // Secondary auth provider
      config: {
        tenantId: process.env.AZURE_TENANT_ID,
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET
      }
    },
    cosmosdb: {
      provider: 'azure',
      enabled: false, // Migration target
      config: {
        endpoint: process.env.AZURE_COSMOS_ENDPOINT,
        key: process.env.AZURE_COSMOS_KEY,
        databaseName: 'prepbettr',
        consistencyLevel: 'Session'
      }
    },
    blobStorage: {
      provider: 'azure',
      enabled: false, // Migration target
      config: {
        accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
        accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
        containers: {
          resumes: 'user-resumes',
          profilePictures: 'profile-pictures',
          documents: 'user-documents'
        }
      }
    },
    functions: {
      provider: 'azure',
      enabled: true, // Already in use
      config: {
        appName: process.env.AZURE_FUNCTION_APP_NAME,
        resourceGroup: process.env.AZURE_RESOURCE_GROUP,
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID
      }
    },
    appConfiguration: {
      provider: 'azure',
      enabled: false, // Migration target
      config: {
        endpoint: process.env.AZURE_APP_CONFIG_ENDPOINT,
        connectionString: process.env.AZURE_APP_CONFIG_CONNECTION_STRING
      }
    },
    speech: {
      provider: 'azure',
      enabled: true, // Already in use
      config: {
        key: process.env.AZURE_SPEECH_KEY,
        region: process.env.AZURE_SPEECH_REGION,
        endpoint: process.env.AZURE_SPEECH_ENDPOINT
      }
    },
    foundry: {
      provider: 'azure',
      enabled: true, // Migrated from legacy OpenAI
      config: {
        apiKey: process.env.AZURE_FOUNDRY_API_KEY,
        endpoint: process.env.AZURE_FOUNDRY_ENDPOINT,
        projectId: process.env.AZURE_FOUNDRY_PROJECT_ID,
        resourceGroup: process.env.AZURE_FOUNDRY_RESOURCE_GROUP,
        region: process.env.AZURE_FOUNDRY_REGION,
        models: {
          chat: process.env.AZURE_FOUNDRY_DEFAULT_CHAT_MODEL || 'gpt-4o',
          embedding: process.env.AZURE_FOUNDRY_DEFAULT_EMBEDDING_MODEL || 'text-embedding-3-large'
        }
      }
    },
    // Legacy OpenAI (deprecated)
    openai: {
      provider: 'azure',
      enabled: false, // Deprecated - use foundry instead
      config: {
        key: process.env.AZURE_OPENAI_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deployments: {
          gpt35: process.env.AZURE_OPENAI_GPT35_DEPLOYMENT,
          gpt4o: process.env.AZURE_OPENAI_GPT4O_DEPLOYMENT
        }
      }
    }
  },
  
  migration: {
    enabled: true,
    rolloutPercentage: 0, // Start with 0% Azure services
    rollbackEnabled: true,
    featureFlags: {
      'azure-cosmos-db': {
        key: 'azure-cosmos-db',
        enabled: false,
        rolloutPercentage: 0,
        environment: 'development'
      },
      'azure-blob-storage': {
        key: 'azure-blob-storage',
        enabled: false,
        rolloutPercentage: 0,
        environment: 'development'
      },
      'azure-app-config': {
        key: 'azure-app-config',
        enabled: false,
        rolloutPercentage: 0,
        environment: 'development'
      }
    }
  }
};

export const PRODUCTION_CONFIG_TEMPLATE: Partial<EnvironmentConfig> = {
  environment: 'production',
  
  migration: {
    enabled: true,
    rolloutPercentage: 5, // Start with 5% rollout
    rollbackEnabled: true,
    featureFlags: {
      'azure-cosmos-db': {
        key: 'azure-cosmos-db',
        enabled: false,
        rolloutPercentage: 0,
        environment: 'production'
      },
      'azure-blob-storage': {
        key: 'azure-blob-storage',
        enabled: false,
        rolloutPercentage: 5, // Start storage migration first
        environment: 'production'
      }
    }
  }
};

// ===== CONFIGURATION MANAGER =====

export class UnifiedConfigManager {
  private config: EnvironmentConfig;
  private configService?: IConfigService;
  
  constructor(environment: string = 'development') {
    this.config = this.loadEnvironmentConfig(environment);
  }
  
  private loadEnvironmentConfig(environment: string): EnvironmentConfig {
    switch (environment) {
      case 'production':
        return { ...DEFAULT_DEVELOPMENT_CONFIG, ...PRODUCTION_CONFIG_TEMPLATE };
      case 'staging':
        return { 
          ...DEFAULT_DEVELOPMENT_CONFIG, 
          environment: 'staging',
          migration: { 
            ...DEFAULT_DEVELOPMENT_CONFIG.migration,
            rolloutPercentage: 25 // Higher rollout in staging
          }
        };
      default:
        return DEFAULT_DEVELOPMENT_CONFIG;
    }
  }
  
  /**
   * Get service configuration with fallback support
   */
  getServiceConfig(service: keyof EnvironmentConfig['firebase'] | keyof EnvironmentConfig['azure'], provider: 'firebase' | 'azure'): ServiceConfig {
    const providerConfig = provider === 'firebase' ? this.config.firebase : this.config.azure;
    return providerConfig[service as keyof typeof providerConfig];
  }
  
  /**
   * Check if service should use Azure provider based on feature flags
   */
  async shouldUseAzure(serviceName: string, userId?: string): Promise<boolean> {
    const featureFlag = this.config.migration.featureFlags[`azure-${serviceName}`];
    
    if (!featureFlag || !featureFlag.enabled) {
      return false;
    }
    
    // Check rollout percentage
    if (userId) {
      const userHash = this.hashUserId(userId);
      return userHash <= featureFlag.rolloutPercentage;
    }
    
    // For non-user specific calls, use general rollout
    return Math.random() * 100 <= featureFlag.rolloutPercentage;
  }
  
  /**
   * Hash user ID for consistent rollout experience
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }
  
  /**
   * Get provider name based on feature flags and configuration
   */
  async getProvider(serviceName: string, userId?: string): Promise<'firebase' | 'azure'> {
    if (await this.shouldUseAzure(serviceName, userId)) {
      return 'azure';
    }
    return 'firebase';
  }
  
  /**
   * Update feature flag at runtime
   */
  async updateFeatureFlag(key: string, updates: Partial<FeatureFlag>): Promise<void> {
    if (this.config.migration.featureFlags[key]) {
      this.config.migration.featureFlags[key] = {
        ...this.config.migration.featureFlags[key],
        ...updates
      };
      
      // Persist to remote config service if available
      if (this.configService) {
        await this.configService.set(`feature-flags.${key}`, updates);
      }
    }
  }
  
  /**
   * Emergency rollback - disable all Azure services
   */
  async emergencyRollback(): Promise<void> {
    for (const flagKey in this.config.migration.featureFlags) {
      this.config.migration.featureFlags[flagKey].enabled = false;
      this.config.migration.featureFlags[flagKey].rolloutPercentage = 0;
    }
    
    console.warn('🚨 Emergency rollback activated - all Azure services disabled');
  }
  
  /**
   * Get complete configuration for debugging
   */
  getFullConfig(): EnvironmentConfig {
    return this.config;
  }
  
  /**
   * Validate configuration completeness
   */
  validateConfig(): { isValid: boolean; missingKeys: string[] } {
    const missingKeys: string[] = [];
    
    // Check Firebase required configs
    if (this.config.firebase.auth.enabled && !this.config.firebase.auth.config.projectId) {
      missingKeys.push('FIREBASE_PROJECT_ID');
    }
    
    // Check Azure required configs
    if (this.config.azure.speech.enabled && !this.config.azure.speech.config.key) {
      missingKeys.push('AZURE_SPEECH_KEY');
    }
    
    return {
      isValid: missingKeys.length === 0,
      missingKeys
    };
  }
}

// ===== ENVIRONMENT VARIABLES TEMPLATE =====

export const ENVIRONMENT_VARIABLES_TEMPLATE = `
# ===== UNIFIED SERVICE CONFIGURATION =====
# Copy this template to your .env file and fill in the values

# Environment
NODE_ENV=development
MIGRATION_ENABLED=true
ROLLOUT_PERCENTAGE=0

# ===== FIREBASE CONFIGURATION (PRIMARY IDENTITY) =====
FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_CLIENT_KEY=your-firebase-web-api-key
FIREBASE_SERVICE_ACCOUNT_KEY=your-firebase-service-account-json
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket

# ===== AZURE CONFIGURATION =====

# Azure Identity & Key Vault
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_CLIENT_ID=your-azure-client-id  
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net

# Azure Cosmos DB (Firestore replacement)
AZURE_COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com:443/
AZURE_COSMOS_KEY=your-cosmos-primary-key
AZURE_COSMOS_DATABASE=prepbettr

# Azure Blob Storage (Firebase Storage replacement)
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...

# Azure App Configuration (Remote Config replacement)
AZURE_APP_CONFIG_ENDPOINT=https://your-appconfig.azconfig.io
AZURE_APP_CONFIG_CONNECTION_STRING=Endpoint=https://...

# Azure Functions
AZURE_FUNCTION_APP_NAME=your-function-app
AZURE_RESOURCE_GROUP=your-resource-group
AZURE_SUBSCRIPTION_ID=your-subscription-id

# Azure AI Services
AZURE_SPEECH_KEY=your-speech-key
AZURE_SPEECH_REGION=your-speech-region

# Azure AI Foundry (replaces legacy OpenAI)
AZURE_FOUNDRY_API_KEY=your-foundry-api-key
AZURE_FOUNDRY_ENDPOINT=https://your-foundry.services.ai.azure.com
AZURE_FOUNDRY_PROJECT_ID=your-foundry-project-id
AZURE_FOUNDRY_RESOURCE_GROUP=your-resource-group
AZURE_FOUNDRY_REGION=your-region
AZURE_FOUNDRY_DEFAULT_CHAT_MODEL=gpt-4o
AZURE_FOUNDRY_DEFAULT_EMBEDDING_MODEL=text-embedding-3-large

# Legacy Azure OpenAI (deprecated - remove after migration)
# AZURE_OPENAI_KEY=your-legacy-openai-key
# AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com
# AZURE_OPENAI_GPT35_DEPLOYMENT=gpt-35-turbo
# AZURE_OPENAI_GPT4O_DEPLOYMENT=gpt-4o

# Azure Form Recognizer
AZURE_FORM_RECOGNIZER_ENDPOINT=https://your-formrecognizer.cognitiveservices.azure.com
AZURE_FORM_RECOGNIZER_KEY=your-form-recognizer-key

# ===== FEATURE FLAGS =====
# Individual service migration toggles
FF_AZURE_COSMOS_DB=false
FF_AZURE_BLOB_STORAGE=false  
FF_AZURE_APP_CONFIG=false
FF_AZURE_FUNCTIONS_ONLY=false

# Rollout percentages (0-100)
ROLLOUT_COSMOS_DB=0
ROLLOUT_BLOB_STORAGE=0
ROLLOUT_APP_CONFIG=0

# ===== MONITORING & OBSERVABILITY =====
AZURE_APPLICATION_INSIGHTS_CONNECTION_STRING=InstrumentationKey=...
AZURE_LOG_ANALYTICS_WORKSPACE_ID=your-workspace-id
AZURE_LOG_ANALYTICS_SHARED_KEY=your-shared-key
`;

// ===== CONFIGURATION LOADER =====

export class ConfigurationLoader {
  static async loadConfig(): Promise<UnifiedConfigManager> {
    const environment = process.env.NODE_ENV || 'development';
    const configManager = new UnifiedConfigManager(environment);
    
    // Validate configuration
    const validation = configManager.validateConfig();
    if (!validation.isValid) {
      console.warn('⚠️ Configuration validation failed:', validation.missingKeys);
      
      if (environment === 'production') {
        throw new Error(`Missing required configuration: ${validation.missingKeys.join(', ')}`);
      }
    }
    
    return configManager;
  }
  
  /**
   * Load configuration from Azure App Configuration (when available)
   */
  static async loadFromAzureAppConfig(endpoint: string): Promise<Record<string, any>> {
    try {
      // This would integrate with Azure App Configuration client
      // Implementation depends on @azure/app-configuration package
      console.log('🔄 Loading configuration from Azure App Configuration...');
      
      // TODO: Implement actual Azure App Configuration integration
      return {};
    } catch (error) {
      console.warn('⚠️ Failed to load from Azure App Configuration, using environment variables');
      return {};
    }
  }
}

// ===== FEATURE FLAG MANAGER =====

export class FeatureFlagManager {
  private flags: Map<string, FeatureFlag> = new Map();
  
  constructor(private configManager: UnifiedConfigManager) {
    this.loadFlags();
  }
  
  private loadFlags(): void {
    const config = this.configManager.getFullConfig();
    Object.entries(config.migration.featureFlags).forEach(([key, flag]) => {
      this.flags.set(key, flag);
    });
  }
  
  /**
   * Check if feature is enabled for user
   */
  async isEnabled(flagKey: string, userId?: string): Promise<boolean> {
    const flag = this.flags.get(flagKey);
    if (!flag || !flag.enabled) {
      return false;
    }
    
    return await this.configManager.shouldUseAzure(
      flagKey.replace('azure-', ''),
      userId
    );
  }
  
  /**
   * Update feature flag
   */
  async updateFlag(key: string, updates: Partial<FeatureFlag>): Promise<void> {
    const flag = this.flags.get(key);
    if (flag) {
      const updatedFlag = { ...flag, ...updates };
      this.flags.set(key, updatedFlag);
      await this.configManager.updateFeatureFlag(key, updates);
    }
  }
  
  /**
   * Get all flags for debugging
   */
  getAllFlags(): Record<string, FeatureFlag> {
    const result: Record<string, FeatureFlag> = {};
    this.flags.forEach((flag, key) => {
      result[key] = flag;
    });
    return result;
  }
  
  /**
   * Emergency disable all Azure features
   */
  async emergencyDisable(): Promise<void> {
    for (const [key, flag] of this.flags.entries()) {
      if (key.startsWith('azure-')) {
        await this.updateFlag(key, { enabled: false, rolloutPercentage: 0 });
      }
    }
    console.warn('🚨 Emergency disable activated for all Azure features');
  }
}

// ===== MIGRATION STATE MANAGER =====

export class MigrationStateManager {
  private states: Map<string, MigrationState> = new Map();
  
  async getMigrationState(service: string): Promise<MigrationState> {
    return this.states.get(service) || {
      service,
      sourceProvider: 'firebase',
      targetProvider: 'azure',
      status: 'pending'
    };
  }
  
  async updateMigrationState(service: string, updates: Partial<MigrationState>): Promise<void> {
    const currentState = await this.getMigrationState(service);
    const newState = { ...currentState, ...updates };
    this.states.set(service, newState);
    
    // Log significant state changes
    if (updates.status) {
      console.log(`📊 Migration ${service}: ${currentState.status} → ${updates.status}`);
    }
  }
  
  async startMigration(service: string): Promise<void> {
    await this.updateMigrationState(service, {
      status: 'in-progress',
      startedAt: new Date(),
      progress: 0
    });
  }
  
  async completeMigration(service: string): Promise<void> {
    await this.updateMigrationState(service, {
      status: 'completed',
      completedAt: new Date(),
      progress: 100
    });
  }
  
  async rollbackMigration(service: string, error?: string): Promise<void> {
    await this.updateMigrationState(service, {
      status: 'rolled-back',
      error
    });
  }
  
  getAllMigrationStates(): Record<string, MigrationState> {
    const result: Record<string, MigrationState> = {};
    this.states.forEach((state, service) => {
      result[service] = state;
    });
    return result;
  }
}

// ===== SINGLETON INSTANCES =====

let globalConfigManager: UnifiedConfigManager | null = null;
let globalFeatureFlagManager: FeatureFlagManager | null = null;
let globalMigrationStateManager: MigrationStateManager | null = null;

export async function getConfigManager(): Promise<UnifiedConfigManager> {
  if (!globalConfigManager) {
    globalConfigManager = await ConfigurationLoader.loadConfig();
  }
  return globalConfigManager;
}

export async function getFeatureFlagManager(): Promise<FeatureFlagManager> {
  if (!globalFeatureFlagManager) {
    const configManager = await getConfigManager();
    globalFeatureFlagManager = new FeatureFlagManager(configManager);
  }
  return globalFeatureFlagManager;
}

export async function getMigrationStateManager(): Promise<MigrationStateManager> {
  if (!globalMigrationStateManager) {
    globalMigrationStateManager = new MigrationStateManager();
  }
  return globalMigrationStateManager;
}
