/**
 * Environment Configuration Loader
 * 
 * Provides centralized environment variable management with hierarchical loading:
 * 1. Azure App Configuration (primary)
 * 2. Azure Key Vault (sensitive secrets)
 * 3. Environment variables (fallback for local dev)
 * 
 * Special handling for Cosmos DB connection strings and other sensitive data.
 */

import { unifiedConfigService } from '@/lib/services/unified-config-service';
import { logServerError } from '@/lib/errors';

// ===== INTERFACES =====

export interface CosmosDbConfig {
  connectionString: string;
  database: string;
  maxRUPerSecond: number;
  batchSize: number;
  connectionTimeout: number;
  retryAttempts: number;
}

export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  cosmosDb: CosmosDbConfig;
  azure: {
    appConfigConnectionString?: string;
    appConfigEndpoint?: string;
    keyVaultUrl?: string;
  };
  firebase: {
    clientKey?: string;
    adminKey?: string;
  };
  features: {
    enableCosmosDb: boolean;
    enableUnifiedConfig: boolean;
    enableKeyVault: boolean;
  };
}

// ===== CONFIGURATION LOADER =====

class EnvironmentConfigurationLoader {
  private config: EnvironmentConfig | null = null;
  private initialized = false;

  /**
   * Load environment configuration with hierarchy
   */
  async load(): Promise<EnvironmentConfig> {
    if (this.config && this.initialized) {
      return this.config;
    }

    try {
      console.log('🔧 Loading environment configuration...');

      // Load base environment settings
      const environment = this.getEnvironment();

      // Load Cosmos DB configuration
      const cosmosDb = await this.loadCosmosDbConfig();

      // Load Azure service configuration
      const azure = await this.loadAzureConfig();

      // Load Firebase configuration
      const firebase = await this.loadFirebaseConfig();

      // Load feature flags
      const features = await this.loadFeatureConfig();

      this.config = {
        environment,
        cosmosDb,
        azure,
        firebase,
        features
      };

      this.initialized = true;
      console.log(`✅ Environment configuration loaded for ${environment}`);

      return this.config;
    } catch (error) {
      console.error('❌ Failed to load environment configuration:', error);
      logServerError(error as Error, { service: 'environment-loader', action: 'load' });

      // Return minimal fallback configuration
      return this.getFallbackConfig();
    }
  }

  /**
   * Load Cosmos DB configuration with hierarchy
   */
  private async loadCosmosDbConfig(): Promise<CosmosDbConfig> {
    try {
      // Try unified config service first
      const [connectionString, maxRUPerSecond, batchSize, connectionTimeout, retryAttempts] = await Promise.all([
        this.getConfigValue('data.cosmos.connectionString', process.env.COSMOS_CONNECTION_STRING),
        this.getConfigValue('data.cosmos.maxRUPerSecond', 4000),
        this.getConfigValue('data.cosmos.batchSize', 100),
        this.getConfigValue('data.cosmos.connectionTimeout', 10000),
        this.getConfigValue('data.cosmos.retryAttempts', 3)
      ]);

      if (!connectionString) {
        throw new Error('Cosmos DB connection string is required');
      }

      return {
        connectionString,
        database: process.env.COSMOS_DATABASE || 'prepbettr',
        maxRUPerSecond: Number(maxRUPerSecond),
        batchSize: Number(batchSize),
        connectionTimeout: Number(connectionTimeout),
        retryAttempts: Number(retryAttempts)
      };
    } catch (error) {
      console.warn('⚠️ Failed to load Cosmos DB config from unified service, using environment fallback');
      
      return {
        connectionString: process.env.COSMOS_CONNECTION_STRING || '',
        database: process.env.COSMOS_DATABASE || 'prepbettr',
        maxRUPerSecond: Number(process.env.COSMOS_MAX_RU_PER_SECOND || 4000),
        batchSize: Number(process.env.COSMOS_BATCH_SIZE || 100),
        connectionTimeout: Number(process.env.COSMOS_CONNECTION_TIMEOUT || 10000),
        retryAttempts: Number(process.env.COSMOS_RETRY_ATTEMPTS || 3)
      };
    }
  }

  /**
   * Load Azure service configuration
   */
  private async loadAzureConfig() {
    return {
      appConfigConnectionString: process.env.AZURE_APP_CONFIG_CONNECTION_STRING,
      appConfigEndpoint: process.env.AZURE_APP_CONFIG_ENDPOINT,
      keyVaultUrl: process.env.AZURE_KEY_VAULT_URL
    };
  }

  /**
   * Load Firebase configuration
   */
  private async loadFirebaseConfig() {
    try {
      const [clientKey, adminKey] = await Promise.all([
        this.getConfigValue('auth.firebase.clientKey', process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY),
        this.getConfigValue('auth.firebase.adminKey', process.env.FIREBASE_ADMIN_KEY)
      ]);

      return { clientKey, adminKey };
    } catch (error) {
      console.warn('⚠️ Failed to load Firebase config from unified service, using environment fallback');
      
      return {
        clientKey: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY,
        adminKey: process.env.FIREBASE_ADMIN_KEY
      };
    }
  }

  /**
   * Load feature configuration
   */
  private async loadFeatureConfig() {
    try {
      const [enableCosmosDb, enableUnifiedConfig, enableKeyVault] = await Promise.all([
        this.getConfigValue('features.enableCosmosDb', true),
        this.getConfigValue('features.enableUnifiedConfig', true),
        this.getConfigValue('features.enableKeyVault', false)
      ]);

      return {
        enableCosmosDb: Boolean(enableCosmosDb),
        enableUnifiedConfig: Boolean(enableUnifiedConfig),
        enableKeyVault: Boolean(enableKeyVault)
      };
    } catch (error) {
      console.warn('⚠️ Failed to load feature config from unified service, using defaults');
      
      return {
        enableCosmosDb: process.env.NODE_ENV === 'production',
        enableUnifiedConfig: true,
        enableKeyVault: false
      };
    }
  }

  /**
   * Get configuration value with fallback hierarchy
   */
  private async getConfigValue<T>(key: string, fallback: T): Promise<T> {
    try {
      // Try unified config service first
      const value = await unifiedConfigService.get(key, fallback);
      return value;
    } catch (error) {
      // Fall back to provided fallback value
      console.warn(`⚠️ Failed to get config ${key} from unified service:`, error);
      return fallback;
    }
  }

  /**
   * Determine current environment
   */
  private getEnvironment(): 'development' | 'staging' | 'production' {
    const env = process.env.NODE_ENV || 'development';
    const vercelEnv = process.env.VERCEL_ENV;
    
    if (env === 'production') {
      return 'production';
    } else if (vercelEnv === 'preview' || process.env.APP_ENV === 'staging') {
      return 'staging';
    } else {
      return 'development';
    }
  }

  /**
   * Get fallback configuration when loading fails
   */
  private getFallbackConfig(): EnvironmentConfig {
    console.warn('⚠️ Using fallback environment configuration');
    
    return {
      environment: this.getEnvironment(),
      cosmosDb: {
        connectionString: process.env.COSMOS_CONNECTION_STRING || '',
        database: process.env.COSMOS_DATABASE || 'prepbettr',
        maxRUPerSecond: 4000,
        batchSize: 100,
        connectionTimeout: 10000,
        retryAttempts: 3
      },
      azure: {
        appConfigConnectionString: process.env.AZURE_APP_CONFIG_CONNECTION_STRING,
        appConfigEndpoint: process.env.AZURE_APP_CONFIG_ENDPOINT,
        keyVaultUrl: process.env.AZURE_KEY_VAULT_URL
      },
      firebase: {
        clientKey: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY,
        adminKey: process.env.FIREBASE_ADMIN_KEY
      },
      features: {
        enableCosmosDb: process.env.NODE_ENV === 'production',
        enableUnifiedConfig: false, // Disable if unified config failed
        enableKeyVault: false
      }
    };
  }

  /**
   * Refresh configuration (useful for hot reloading in development)
   */
  async refresh(): Promise<EnvironmentConfig> {
    this.config = null;
    this.initialized = false;
    return await this.load();
  }

  /**
   * Get current configuration (throws if not loaded)
   */
  getCurrentConfig(): EnvironmentConfig {
    if (!this.config) {
      throw new Error('Environment configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Check if configuration is loaded
   */
  isLoaded(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Export configuration for deployment scripts
   */
  exportForDeployment(): Record<string, string> {
    const config = this.getCurrentConfig();
    
    return {
      NODE_ENV: config.environment,
      COSMOS_DATABASE: config.cosmosDb.database,
      COSMOS_MAX_RU_PER_SECOND: config.cosmosDb.maxRUPerSecond.toString(),
      COSMOS_BATCH_SIZE: config.cosmosDb.batchSize.toString(),
      COSMOS_CONNECTION_TIMEOUT: config.cosmosDb.connectionTimeout.toString(),
      COSMOS_RETRY_ATTEMPTS: config.cosmosDb.retryAttempts.toString(),
      // NOTE: Don't export connection strings or sensitive keys for security
      AZURE_APP_CONFIG_ENDPOINT: config.azure.appConfigEndpoint || '',
      AZURE_KEY_VAULT_URL: config.azure.keyVaultUrl || ''
    };
  }
}

// ===== SINGLETON INSTANCE =====

export const environmentLoader = new EnvironmentConfigurationLoader();

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Load environment configuration (idempotent)
 */
export async function loadEnvironmentConfig(): Promise<EnvironmentConfig> {
  return await environmentLoader.load();
}

/**
 * Get Cosmos DB configuration
 */
export async function getCosmosDbConfig(): Promise<CosmosDbConfig> {
  const config = await loadEnvironmentConfig();
  return config.cosmosDb;
}

/**
 * Check if Cosmos DB is enabled
 */
export async function isCosmosDbEnabled(): Promise<boolean> {
  try {
    const config = await loadEnvironmentConfig();
    return config.features.enableCosmosDb && !!config.cosmosDb.connectionString;
  } catch (error) {
    console.warn('Failed to check Cosmos DB status:', error);
    return false;
  }
}

/**
 * Get environment name
 */
export async function getEnvironmentName(): Promise<string> {
  const config = await loadEnvironmentConfig();
  return config.environment;
}

export default environmentLoader;
