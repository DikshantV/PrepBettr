/**
 * Data Store Factory
 * 
 * Central factory for creating and managing data store providers.
 * Handles feature flag routing, dual-write configuration, and fallback mechanisms.
 * Implements the factory pattern following SOLID principles.
 */

import { 
  IDataStoreProvider, 
  DataStoreConfig, 
  DataStoreError,
  DataLayerFeatureFlags
} from './interfaces';
import { CosmosDataStoreProvider, createCosmosDataStoreProvider } from './adapters/cosmos-adapter';
import { FirestoreDataStoreProvider, createFirestoreDataStoreProvider } from './adapters/firestore-adapter';
import { DualWriteDataStoreProvider } from './adapters/dual-write-adapter';
import { unifiedConfigService } from '@/lib/services/unified-config-service';
import { logServerError } from '@/lib/errors';

// =============================================================================
// Configuration Management
// =============================================================================

interface DataStoreFactoryConfig {
  defaultProvider: 'cosmos' | 'firestore' | 'hybrid';
  enableFeatureFlags: boolean;
  cosmosConfig?: {
    connectionString?: string;
    databaseName: string;
  };
  firestoreConfig?: {
    projectId: string;
    serviceAccount?: string;
  };
  dualWriteConfig?: {
    primaryProvider: 'cosmos' | 'firestore';
    secondaryProvider: 'cosmos' | 'firestore';
    syncDelayMs: number;
    retryFailedWrites: boolean;
  };
  performance?: {
    enableCaching: boolean;
    cacheTimeoutMs: number;
    connectionPoolSize: number;
  };
}

// =============================================================================
// Data Store Factory Implementation
// =============================================================================

class DataStoreFactory {
  private static instance: DataStoreFactory;
  private providers: Map<string, IDataStoreProvider> = new Map();
  private config: DataStoreFactoryConfig | null = null;
  private featureFlags: DataLayerFeatureFlags | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): DataStoreFactory {
    if (!DataStoreFactory.instance) {
      DataStoreFactory.instance = new DataStoreFactory();
    }
    return DataStoreFactory.instance;
  }

  /**
   * Initialize the factory with configuration
   */
  async initialize(config?: Partial<DataStoreFactoryConfig>): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🏭 Initializing Data Store Factory...');

      // Load configuration
      this.config = await this.loadConfiguration(config);
      
      // Load feature flags
      if (this.config.enableFeatureFlags) {
        this.featureFlags = await this.loadFeatureFlags();
      }

      this.initialized = true;
      console.log('✅ Data Store Factory initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Data Store Factory:', error);
      throw new DataStoreError(
        'Failed to initialize Data Store Factory',
        'FACTORY_INITIALIZATION_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Get or create a data store provider based on configuration and feature flags
   */
  async getDataStoreProvider(): Promise<IDataStoreProvider> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Determine which provider to use
      const providerType = await this.determineProviderType();
      const cacheKey = `provider_${providerType}`;

      // Return cached provider if exists
      if (this.providers.has(cacheKey)) {
        return this.providers.get(cacheKey)!;
      }

      // Create new provider
      const provider = await this.createProvider(providerType);
      await provider.initialize();

      // Cache the provider
      this.providers.set(cacheKey, provider);
      
      console.log(`✅ Created and cached ${providerType} data store provider`);
      return provider;

    } catch (error) {
      console.error('❌ Failed to get data store provider:', error);
      throw new DataStoreError(
        'Failed to get data store provider',
        'PROVIDER_CREATION_FAILED',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Get a specific provider by type (for migration and testing)
   */
  async getProviderByType(type: 'cosmos' | 'firestore' | 'dual-write'): Promise<IDataStoreProvider> {
    const cacheKey = `provider_${type}`;

    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!;
    }

    const provider = await this.createProvider(type);
    await provider.initialize();
    this.providers.set(cacheKey, provider);

    return provider;
  }

  /**
   * Create a provider instance based on type
   */
  private async createProvider(type: 'cosmos' | 'firestore' | 'dual-write'): Promise<IDataStoreProvider> {
    switch (type) {
      case 'cosmos':
        return this.createCosmosProvider();
        
      case 'firestore':
        return this.createFirestoreProvider();
        
      case 'dual-write':
        return this.createDualWriteProvider();
        
      default:
        throw new DataStoreError(
          `Unknown provider type: ${type}`,
          'UNKNOWN_PROVIDER_TYPE'
        );
    }
  }

  /**
   * Create Cosmos DB provider
   */
  private async createCosmosProvider(): Promise<CosmosDataStoreProvider> {
    const cosmosConfig: DataStoreConfig = {
      provider: 'cosmos',
      connectionString: await this.getCosmosConnectionString(),
      databaseName: this.config?.cosmosConfig?.databaseName || 'prepbettr',
      enableFallback: true,
      retryOptions: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffMs: 30000
      },
      performance: this.config?.performance
    };

    return createCosmosDataStoreProvider(cosmosConfig);
  }

  /**
   * Create Firestore provider
   */
  private async createFirestoreProvider(): Promise<FirestoreDataStoreProvider> {
    const firestoreConfig: DataStoreConfig = {
      provider: 'firestore',
      enableFallback: false,
      retryOptions: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffMs: 15000
      },
      performance: this.config?.performance
    };

    return createFirestoreDataStoreProvider(firestoreConfig);
  }

  /**
   * Create dual-write provider
   */
  private async createDualWriteProvider(): Promise<DualWriteDataStoreProvider> {
    const dualWriteConfig = this.config?.dualWriteConfig;
    if (!dualWriteConfig) {
      throw new DataStoreError(
        'Dual-write configuration is required for dual-write provider',
        'MISSING_DUAL_WRITE_CONFIG'
      );
    }

    const primaryProvider = await this.getProviderByType(dualWriteConfig.primaryProvider);
    const secondaryProvider = await this.getProviderByType(dualWriteConfig.secondaryProvider);

    return new DualWriteDataStoreProvider({
      primaryProvider,
      secondaryProvider,
      syncDelayMs: dualWriteConfig.syncDelayMs,
      retryFailedWrites: dualWriteConfig.retryFailedWrites
    });
  }

  /**
   * Determine which provider to use based on feature flags and configuration
   */
  private async determineProviderType(): Promise<'cosmos' | 'firestore' | 'dual-write'> {
    // If feature flags are disabled, use default provider
    if (!this.config?.enableFeatureFlags || !this.featureFlags) {
      return this.config?.defaultProvider === 'hybrid' ? 'dual-write' : this.config?.defaultProvider || 'firestore';
    }

    // Check Azure data layer feature flag
    if (this.featureFlags.azureDataLayer) {
      // If dual-write is enabled, use dual-write provider
      if (this.featureFlags.enableDualWrite) {
        console.log('📊 Using dual-write provider (Azure primary, Firestore secondary)');
        return 'dual-write';
      }
      
      // Otherwise, use Cosmos DB directly
      console.log('☁️ Using Azure Cosmos DB provider');
      return 'cosmos';
    }

    // Fallback to Firestore
    console.log('🔥 Using Firestore provider (legacy mode)');
    return 'firestore';
  }

  /**
   * Load configuration from various sources
   */
  private async loadConfiguration(override?: Partial<DataStoreFactoryConfig>): Promise<DataStoreFactoryConfig> {
    const defaultConfig: DataStoreFactoryConfig = {
      defaultProvider: 'firestore',
      enableFeatureFlags: true,
      cosmosConfig: {
        databaseName: 'prepbettr'
      },
      dualWriteConfig: {
        primaryProvider: 'cosmos',
        secondaryProvider: 'firestore',
        syncDelayMs: 100,
        retryFailedWrites: true
      },
      performance: {
        enableCaching: true,
        cacheTimeoutMs: 300000, // 5 minutes
        connectionPoolSize: 10
      }
    };

    // Try to load from unified config service
    try {
      const configFromService = {
        defaultProvider: await unifiedConfigService.get('data.defaultProvider', defaultConfig.defaultProvider),
        enableFeatureFlags: await unifiedConfigService.get('data.enableFeatureFlags', defaultConfig.enableFeatureFlags),
        cosmosConfig: {
          databaseName: await unifiedConfigService.get('data.cosmos.databaseName', defaultConfig.cosmosConfig!.databaseName)
        }
      };

      return { ...defaultConfig, ...configFromService, ...override };
    } catch (error) {
      console.warn('⚠️ Could not load configuration from unified config service, using defaults:', error);
      return { ...defaultConfig, ...override };
    }
  }

  /**
   * Load feature flags for data layer
   */
  private async loadFeatureFlags(): Promise<DataLayerFeatureFlags> {
    const defaultFlags: DataLayerFeatureFlags = {
      azureDataLayer: false,
      enableDualWrite: false,
      enableFallback: true,
      migrateResumes: false,
      migrateInterviews: false,
      migrateUsage: false,
      migrateConsents: false,
      migrateAuditLogs: false,
      migrateNotifications: false,
      migratePayments: false
    };

    try {
      const flags: DataLayerFeatureFlags = {
        azureDataLayer: await unifiedConfigService.get('features.azureDataLayer', defaultFlags.azureDataLayer),
        enableDualWrite: await unifiedConfigService.get('features.enableDualWrite', defaultFlags.enableDualWrite),
        enableFallback: await unifiedConfigService.get('features.enableFallback', defaultFlags.enableFallback),
        migrateResumes: await unifiedConfigService.get('features.migrateResumes', defaultFlags.migrateResumes),
        migrateInterviews: await unifiedConfigService.get('features.migrateInterviews', defaultFlags.migrateInterviews),
        migrateUsage: await unifiedConfigService.get('features.migrateUsage', defaultFlags.migrateUsage),
        migrateConsents: await unifiedConfigService.get('features.migrateConsents', defaultFlags.migrateConsents),
        migrateAuditLogs: await unifiedConfigService.get('features.migrateAuditLogs', defaultFlags.migrateAuditLogs),
        migrateNotifications: await unifiedConfigService.get('features.migrateNotifications', defaultFlags.migrateNotifications),
        migratePayments: await unifiedConfigService.get('features.migratePayments', defaultFlags.migratePayments)
      };

      console.log('🎛️ Loaded data layer feature flags:', flags);
      return flags;

    } catch (error) {
      console.warn('⚠️ Could not load feature flags, using defaults:', error);
      return defaultFlags;
    }
  }

  /**
   * Get Cosmos DB connection string from configuration
   */
  private async getCosmosConnectionString(): Promise<string> {
    // Try unified config service first
    try {
      const connectionString = await unifiedConfigService.get('data.cosmos.connectionString', null);
      if (connectionString) {
        return connectionString;
      }
    } catch (error) {
      console.warn('⚠️ Could not load Cosmos connection string from config:', error);
    }

    // Try environment variable
    const envConnectionString = process.env.COSMOS_DB_CONNECTION_STRING;
    if (envConnectionString) {
      return envConnectionString;
    }

    // Try Azure Key Vault (if available)
    try {
      const { fetchAzureSecrets } = await import('@/azure/lib/azure-config');
      const secrets = await fetchAzureSecrets();
      if (secrets.cosmosConnectionString) {
        return secrets.cosmosConnectionString;
      }
    } catch (error) {
      console.warn('⚠️ Could not load Cosmos connection string from Key Vault:', error);
    }

    throw new DataStoreError(
      'Cosmos DB connection string not found in any configuration source',
      'MISSING_COSMOS_CONNECTION_STRING'
    );
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<{ healthy: boolean; providers: Record<string, any> }> {
    const results: Record<string, any> = {};
    let overallHealthy = true;

    for (const [key, provider] of this.providers) {
      try {
        const health = await provider.healthCheck();
        results[key] = health;
        
        if (!health.healthy) {
          overallHealthy = false;
        }
      } catch (error) {
        results[key] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        overallHealthy = false;
      }
    }

    return {
      healthy: overallHealthy,
      providers: results
    };
  }

  /**
   * Refresh feature flags and reconfigure providers
   */
  async refreshConfiguration(): Promise<void> {
    console.log('🔄 Refreshing data store configuration...');
    
    try {
      // Reload feature flags
      if (this.config?.enableFeatureFlags) {
        this.featureFlags = await this.loadFeatureFlags();
      }

      // Clear provider cache to force recreation with new config
      for (const provider of this.providers.values()) {
        if (provider.close) {
          await provider.close();
        }
      }
      this.providers.clear();

      console.log('✅ Data store configuration refreshed successfully');

    } catch (error) {
      console.error('❌ Failed to refresh configuration:', error);
      logServerError(error as Error, { action: 'refreshConfiguration' });
    }
  }

  /**
   * Graceful shutdown - close all providers
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Data Store Factory...');

    for (const [key, provider] of this.providers) {
      try {
        if (provider.close) {
          await provider.close();
          console.log(`✅ Closed ${key} provider`);
        }
      } catch (error) {
        console.error(`❌ Error closing ${key} provider:`, error);
      }
    }

    this.providers.clear();
    this.initialized = false;
    console.log('✅ Data Store Factory shutdown complete');
  }

  /**
   * Get current configuration (for debugging)
   */
  getCurrentConfig(): {
    config: DataStoreFactoryConfig | null;
    featureFlags: DataLayerFeatureFlags | null;
    providers: string[];
  } {
    return {
      config: this.config,
      featureFlags: this.featureFlags,
      providers: Array.from(this.providers.keys())
    };
  }
}

// =============================================================================
// Exports and Convenience Functions
// =============================================================================

// Export singleton instance
export const dataStoreFactory = DataStoreFactory.getInstance();

// Convenience function to get the default provider
export const getDataStoreProvider = async (): Promise<IDataStoreProvider> => {
  return await dataStoreFactory.getDataStoreProvider();
};

// Convenience functions for specific repositories
export const getResumeRepository = async () => {
  const provider = await getDataStoreProvider();
  return provider.getResumeRepository();
};

export const getInterviewRepository = async () => {
  const provider = await getDataStoreProvider();
  return provider.getInterviewRepository();
};

export const getUsageRepository = async () => {
  const provider = await getDataStoreProvider();
  return provider.getUsageRepository();
};

export const getUserConsentRepository = async () => {
  const provider = await getDataStoreProvider();
  return provider.getUserConsentRepository();
};

export const getAuditLogRepository = async () => {
  const provider = await getDataStoreProvider();
  return provider.getAuditLogRepository();
};

export const getNotificationRepository = async () => {
  const provider = await getDataStoreProvider();
  return provider.getNotificationRepository();
};

export const getPaymentRepository = async () => {
  const provider = await getDataStoreProvider();
  return provider.getPaymentRepository();
};

// Initialize factory on first import
if (typeof window === 'undefined') {
  // Only initialize on server-side
  dataStoreFactory.initialize().catch(error => {
    console.error('❌ Failed to initialize data store factory on import:', error);
  });
}