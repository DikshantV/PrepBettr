/**
 * Azure Migration Library
 * 
 * Provider-agnostic migration from Firebase to Azure services
 */

// ===== CORE EXPORTS =====

// Service Factory - Main entry point
export {
  UnifiedServiceFactory,
  getServiceFactory,
  getAuthService,
  getStorageService,
  getDatabaseService,
  getConfigService,
  ServiceHealthChecker,
  MigrationOrchestrator,
  getMigrationOrchestrator
} from './shared/service-factory';

// Configuration Management
export {
  UnifiedConfigManager,
  FeatureFlagManager,
  getConfigManager,
  getFeatureFlagManager
} from './config/unified-config';

// ===== INTERFACES =====

export type {
  // Core service interfaces
  IAuthService,
  IStorageService,
  IDocumentService,
  IConfigService,
  
  // Service factory interface
  IServiceFactory,
  ServiceProvider,
  
  // Data types
  AuthUser,
  StorageFile,
  DatabaseDocument,
  ConfigValue,
  
  // Query and filter types
  QueryOptions,
  QueryFilter,
  
  // Configuration types
  FeatureFlag
} from './shared/interfaces';

// ===== AZURE SERVICES =====

export {
  CosmosDBService,
  CosmosDBMigrationUtils
} from './azure/database/cosmos-db-service';

export {
  AzureBlobStorageService,
  BlobStorageMigrationUtils
} from './azure/storage/blob-storage-service';

export {
  AzureAppConfigService
} from './azure/config/app-config-service';

// ===== FIREBASE ADAPTERS =====

export {
  FirebaseAuthAdapter,
  FirebaseStorageAdapter,
  FirebaseFirestoreAdapter,
  FirebaseRemoteConfigAdapter
} from './firebase';

// ===== TESTING UTILITIES =====

export {
  MockAuthService,
  MockStorageService,
  MockDatabaseService,
  MockConfigService,
  TestEnvironmentManager,
  MigrationTestRunner
} from './testing';

// ===== UTILITY FUNCTIONS =====

/**
 * Quick setup function for new installations
 */
export async function setupMigration(config: {
  environment: 'development' | 'staging' | 'production';
  enableAzure?: boolean;
  azureRolloutPercentage?: number;
}): Promise<void> {
  const { environment, enableAzure = false, azureRolloutPercentage = 0 } = config;
  
  // Import here to avoid circular dependency
  const { getConfigManager, getFeatureFlagManager } = await import('./config/unified-config');
  
  const configManager = await getConfigManager();
  const flagManager = await getFeatureFlagManager();
  
  if (enableAzure) {
    // Set up initial Azure rollout flags
    await flagManager.updateFlag('azure-blob-storage', { 
      enabled: true, 
      rolloutPercentage: azureRolloutPercentage 
    });
    await flagManager.updateFlag('azure-cosmos-db', { 
      enabled: true, 
      rolloutPercentage: azureRolloutPercentage 
    });
    await flagManager.updateFlag('azure-app-config', { 
      enabled: true, 
      rolloutPercentage: azureRolloutPercentage 
    });
  }
  
  console.log(`✅ Migration setup complete for ${environment} environment`);
  if (enableAzure) {
    console.log(`🔄 Azure rollout set to ${azureRolloutPercentage}%`);
  }
}

/**
 * Quick health check function
 */
export async function checkMigrationHealth(): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  details: string[];
}> {
  const { ServiceHealthChecker } = await import('./shared/service-factory');
  const health = await ServiceHealthChecker.getHealthSummary();
  return {
    overall: health.overall,
    details: health.details
  };
}

/**
 * Quick rollback function for emergency situations
 */
export async function emergencyRollback(): Promise<void> {
  const { getMigrationOrchestrator } = await import('./shared/service-factory');
  const orchestrator = getMigrationOrchestrator();
  await orchestrator.rollbackToFirebase();
  console.log('🚨 Emergency rollback completed - all services using Firebase');
}

// ===== VERSION =====

export const VERSION = '1.0.0';
