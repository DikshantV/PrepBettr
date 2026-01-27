/**
 * Data Layer Index
 * Main export file for the unified data layer system
 * Provides a clean API surface for repository management and data migration
 */

// Core Interfaces
export type {
  IResumeDocument,
  IUsageDocument,
  
} from './interfaces/IDocuments';

;

export type {
  RepositoryResult
} from './interfaces/RepositoryResult';

// Repository Implementations
;
;
;

// Dual Write Decorators
;

;

// Migration Manager
;

;

// Service Factory
export {
  DataLayerServiceFactory,
  
  
  
} from './services/DataLayerServiceFactory';

;

// Convenience re-exports for common patterns
type DataLayerInstance = {
  resumeRepository: IResumeRepository<IResumeDocument>;
  usageRepository: IUsageRepository<IUsageDocument>;
  migrationManager?: DataMigrationManager;
};

/**
 * Quick setup functions for common use cases
 */
const DataLayerSetup = {
  /**
   * Setup for development environment (Firestore only)
   */
  development: () => {
    return DataLayerFactory.forDevelopment();
  },

  /**
   * Setup for staging environment (dual write with validation)
   */
  staging: (cosmosConfig: { endpoint: string; key: string; databaseId?: string }) => {
    return DataLayerFactory.forStaging(cosmosConfig);
  },

  /**
   * Setup for production environment
   */
  production: (
    cosmosConfig: { endpoint: string; key: string; databaseId?: string },
    phase: MigrationPhase = MigrationPhase.COSMOS_DB_ONLY
  ) => {
    return DataLayerFactory.forProduction(cosmosConfig, phase);
  },

  /**
   * Setup for migration testing
   */
  migrationTesting: (cosmosConfig: { endpoint: string; key: string; databaseId?: string }) => {
    return DataLayerFactory.forMigrationTesting(cosmosConfig);
  }
};

/**
 * Migration utilities
 */
const MigrationUtils = {
  /**
   * Get recommended migration phases in order
   */
  getRecommendedPhases: (): MigrationPhase[] => {
    return [
      MigrationPhase.FIRESTORE_ONLY,
      MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY,
      MigrationPhase.DUAL_WRITE_WITH_VALIDATION,
      MigrationPhase.DUAL_WRITE_COSMOS_PRIMARY,
      MigrationPhase.COSMOS_DB_ONLY
    ];
  },

  /**
   * Get next migration phase
   */
  getNextPhase: (currentPhase: MigrationPhase): MigrationPhase | null => {
    const phases = MigrationUtils.getRecommendedPhases();
    const currentIndex = phases.indexOf(currentPhase);
    return currentIndex >= 0 && currentIndex < phases.length - 1 
      ? phases[currentIndex + 1] 
      : null;
  },

  /**
   * Check if migration is safe to proceed
   */
  isSafeToMigrate: (from: MigrationPhase, to: MigrationPhase): boolean => {
    const phases = MigrationUtils.getRecommendedPhases();
    const fromIndex = phases.indexOf(from);
    const toIndex = phases.indexOf(to);
    
    // Only allow forward migration one step at a time
    return fromIndex >= 0 && toIndex >= 0 && toIndex === fromIndex + 1;
  }
};

/**
 * Default export for easy imports
 */

// Version and metadata
const DATA_LAYER_VERSION = '1.0.0';
const SUPPORTED_DATABASES = ['firestore', 'cosmos-db'] as const;
const SUPPORTED_MIGRATION_STRATEGIES = [
  'dual_write',
  'async_dual_write',
  'validation_enabled'
] as const;