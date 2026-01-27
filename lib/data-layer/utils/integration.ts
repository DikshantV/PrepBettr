/**
 * Integration Utilities
 * Helper functions for integrating the data layer with existing PrepBettr services
 */

import { DataLayerServiceFactory, DataStoreType, MigrationPhase } from '../services/DataLayerServiceFactory';
import { IResumeRepository, IUsageRepository } from '../interfaces/IRepositories';
import { unifiedConfigService } from '@/lib/services/unified-config-service';

/**
 * Configuration keys for data layer settings
 */
export const DATA_LAYER_CONFIG_KEYS = {
  MIGRATION_PHASE: 'data.migrationPhase',
  ENABLE_DUAL_WRITE: 'data.enableDualWrite',
  ENABLE_CONSISTENCY_VALIDATION: 'data.enableConsistencyValidation',
  COSMOS_ENDPOINT: 'data.cosmos.endpoint',
  COSMOS_DATABASE_ID: 'data.cosmos.databaseId',
  BATCH_SIZE: 'data.migration.batchSize',
  RETRY_ATTEMPTS: 'data.migration.retryAttempts',
  ASYNC_WRITES: 'data.enableAsyncWrites'
} as const;

/**
 * Initialize data layer based on unified configuration
 */
export async function initializeDataLayerFromConfig(): Promise<DataLayerServiceFactory> {
  try {
    // Get configuration values
    const migrationPhase = await unifiedConfigService.get(
      DATA_LAYER_CONFIG_KEYS.MIGRATION_PHASE, 
      MigrationPhase.FIRESTORE_ONLY
    ) as MigrationPhase;

    const enableDualWrite = await unifiedConfigService.get(
      DATA_LAYER_CONFIG_KEYS.ENABLE_DUAL_WRITE, 
      false
    );

    const enableConsistencyValidation = await unifiedConfigService.get(
      DATA_LAYER_CONFIG_KEYS.ENABLE_CONSISTENCY_VALIDATION, 
      true
    );

    const enableAsyncWrites = await unifiedConfigService.get(
      DATA_LAYER_CONFIG_KEYS.ASYNC_WRITES, 
      true
    );

    const batchSize = await unifiedConfigService.get(
      DATA_LAYER_CONFIG_KEYS.BATCH_SIZE, 
      50
    );

    const retryAttempts = await unifiedConfigService.get(
      DATA_LAYER_CONFIG_KEYS.RETRY_ATTEMPTS, 
      3
    );

    // Determine data store type based on migration phase
    let dataStore: DataStoreType;
    if (migrationPhase === MigrationPhase.FIRESTORE_ONLY) {
      dataStore = DataStoreType.FIRESTORE;
    } else if (migrationPhase === MigrationPhase.COSMOS_DB_ONLY) {
      dataStore = DataStoreType.COSMOS_DB;
    } else {
      dataStore = DataStoreType.DUAL_WRITE;
    }

    // Get Cosmos DB configuration if needed
    let cosmosEndpoint: string | undefined;
    let cosmosKey: string | undefined;
    let cosmosDatabaseId: string | undefined;

    if (dataStore !== DataStoreType.FIRESTORE) {
      cosmosEndpoint = process.env.COSMOS_ENDPOINT || await unifiedConfigService.get(
        DATA_LAYER_CONFIG_KEYS.COSMOS_ENDPOINT, 
        ''
      );

      cosmosKey = process.env.COSMOS_KEY || '';
      
      cosmosDatabaseId = await unifiedConfigService.get(
        DATA_LAYER_CONFIG_KEYS.COSMOS_DATABASE_ID, 
        'prepbettr'
      );
    }

    // Create factory instance
    const factory = DataLayerServiceFactory.getInstance({
      dataStore,
      migrationPhase,
      cosmosEndpoint,
      cosmosKey,
      cosmosDatabaseId,
      enableConsistencyValidation,
      enableAsyncWrites,
      defaultRetryAttempts: retryAttempts,
      migrationConfig: {
        batchSize
      }
    });

    console.log(`Data layer initialized with phase: ${migrationPhase}`);
    return factory;

  } catch (error) {
    console.error('Failed to initialize data layer from config:', error);
    
    // Fallback to development mode
    console.log('Falling back to development configuration');
    return DataLayerServiceFactory.getInstance({
      dataStore: DataStoreType.FIRESTORE,
      migrationPhase: MigrationPhase.FIRESTORE_ONLY
    });
  }
}

/**
 * Get repositories with automatic initialization
 */
export async function getDataLayerRepositories(): Promise<{
  resumeRepository: IResumeRepository;
  usageRepository: IUsageRepository;
}> {
  const factory = await initializeDataLayerFromConfig();
  const repositories = await factory.getRepositories();
  
  return {
    resumeRepository: repositories.resumeRepository,
    usageRepository: repositories.usageRepository
  };
}

/**
 * Migration phase controller
 */
export class MigrationPhaseController {
  private factory: DataLayerServiceFactory | null = null;

  async getCurrentPhase(): Promise<MigrationPhase> {
    return await unifiedConfigService.get(
      DATA_LAYER_CONFIG_KEYS.MIGRATION_PHASE, 
      MigrationPhase.FIRESTORE_ONLY
    ) as MigrationPhase;
  }

  async updateMigrationPhase(newPhase: MigrationPhase): Promise<void> {
    console.log(`Updating migration phase to: ${newPhase}`);
    
    // Update configuration
    await unifiedConfigService.set(DATA_LAYER_CONFIG_KEYS.MIGRATION_PHASE, newPhase);
    
    // Update factory if initialized
    if (this.factory) {
      await this.factory.updateMigrationPhase(newPhase);
    }

    console.log(`Migration phase updated successfully`);
  }

  async validatePhaseTransition(fromPhase: MigrationPhase, toPhase: MigrationPhase): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if transition is valid
    const validTransitions: Record<MigrationPhase, MigrationPhase[]> = {
      [MigrationPhase.FIRESTORE_ONLY]: [MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY],
      [MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY]: [
        MigrationPhase.DUAL_WRITE_WITH_VALIDATION,
        MigrationPhase.FIRESTORE_ONLY // rollback
      ],
      [MigrationPhase.DUAL_WRITE_WITH_VALIDATION]: [
        MigrationPhase.DUAL_WRITE_COSMOS_PRIMARY,
        MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY // rollback
      ],
      [MigrationPhase.DUAL_WRITE_COSMOS_PRIMARY]: [
        MigrationPhase.COSMOS_DB_ONLY,
        MigrationPhase.DUAL_WRITE_WITH_VALIDATION // rollback
      ],
      [MigrationPhase.COSMOS_DB_ONLY]: [] // final state
    };

    if (!validTransitions[fromPhase]?.includes(toPhase)) {
      issues.push(`Invalid phase transition from ${fromPhase} to ${toPhase}`);
    }

    // Check prerequisites for each phase
    if (toPhase !== MigrationPhase.FIRESTORE_ONLY) {
      if (!process.env.COSMOS_ENDPOINT && !await unifiedConfigService.get(DATA_LAYER_CONFIG_KEYS.COSMOS_ENDPOINT, '')) {
        issues.push('Cosmos DB endpoint not configured');
      }
      
      if (!process.env.COSMOS_KEY) {
        issues.push('Cosmos DB key not configured');
      }
    }

    // Add recommendations
    switch (toPhase) {
      case MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY:
        recommendations.push('Monitor dual write metrics closely');
        recommendations.push('Start with low traffic to validate system stability');
        break;
      
      case MigrationPhase.DUAL_WRITE_WITH_VALIDATION:
        recommendations.push('Enable detailed consistency validation logging');
        recommendations.push('Set up alerts for data inconsistencies');
        break;
      
      case MigrationPhase.DUAL_WRITE_COSMOS_PRIMARY:
        recommendations.push('Validate Cosmos DB performance under load');
        recommendations.push('Prepare rollback plan if issues arise');
        break;
      
      case MigrationPhase.COSMOS_DB_ONLY:
        recommendations.push('Ensure all data has been successfully migrated');
        recommendations.push('Plan Firestore data archival strategy');
        break;
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }

  async performPreMigrationChecks(): Promise<{
    ready: boolean;
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warning';
      message: string;
    }>;
  }> {
    const checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warning';
      message: string;
    }> = [];

    // Initialize factory for health checks
    this.factory = await initializeDataLayerFromConfig();

    // Health check
    try {
      const healthStatus = await this.factory.performHealthCheck();
      
      if (healthStatus.overall === 'healthy') {
        checks.push({
          name: 'System Health',
          status: 'pass',
          message: 'All systems are healthy'
        });
      } else {
        checks.push({
          name: 'System Health',
          status: 'warning',
          message: `System status: ${healthStatus.overall}`
        });
      }
    } catch (error) {
      checks.push({
        name: 'System Health',
        status: 'fail',
        message: `Health check failed: ${error.message}`
      });
    }

    // Configuration validation
    const currentPhase = await this.getCurrentPhase();
    if (currentPhase !== MigrationPhase.FIRESTORE_ONLY) {
      const cosmosEndpoint = process.env.COSMOS_ENDPOINT || await unifiedConfigService.get(DATA_LAYER_CONFIG_KEYS.COSMOS_ENDPOINT, '');
      
      if (cosmosEndpoint) {
        checks.push({
          name: 'Cosmos DB Configuration',
          status: 'pass',
          message: 'Cosmos DB endpoint configured'
        });
      } else {
        checks.push({
          name: 'Cosmos DB Configuration',
          status: 'fail',
          message: 'Cosmos DB endpoint not configured'
        });
      }
    }

    // Migration readiness
    try {
      const readiness = await this.factory.validateMigrationReadiness();
      
      if (readiness.ready) {
        checks.push({
          name: 'Migration Readiness',
          status: 'pass',
          message: 'System ready for migration'
        });
      } else {
        checks.push({
          name: 'Migration Readiness',
          status: 'fail',
          message: `Issues: ${readiness.issues.join(', ')}`
        });
      }
    } catch (error) {
      checks.push({
        name: 'Migration Readiness',
        status: 'fail',
        message: `Readiness check failed: ${error.message}`
      });
    }

    const ready = checks.every(check => check.status === 'pass');
    
    return { ready, checks };
  }
}

/**
 * Data layer middleware for Next.js API routes
 */
function withDataLayer(handler: (
  repositories: { resumeRepository: IResumeRepository; usageRepository: IUsageRepository }
) => Promise<any>) {
  return async (req: any, res: any) => {
    try {
      const repositories = await getDataLayerRepositories();
      return await handler(repositories);
    } catch (error) {
      console.error('Data layer middleware error:', error);
      throw error;
    }
  };
}

/**
 * Repository cache for performance optimization
 */
class RepositoryCache {
  private static instance: RepositoryCache;
  private repositories: {
    resumeRepository?: IResumeRepository;
    usageRepository?: IUsageRepository;
  } = {};
  private lastInitialized?: Date;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): RepositoryCache {
    if (!RepositoryCache.instance) {
      RepositoryCache.instance = new RepositoryCache();
    }
    return RepositoryCache.instance;
  }

  private isExpired(): boolean {
    if (!this.lastInitialized) return true;
    return Date.now() - this.lastInitialized.getTime() > this.CACHE_TTL;
  }

  async getRepositories(): Promise<{
    resumeRepository: IResumeRepository;
    usageRepository: IUsageRepository;
  }> {
    if (!this.repositories.resumeRepository || !this.repositories.usageRepository || this.isExpired()) {
      const repos = await getDataLayerRepositories();
      this.repositories = repos;
      this.lastInitialized = new Date();
    }

    return {
      resumeRepository: this.repositories.resumeRepository!,
      usageRepository: this.repositories.usageRepository!
    };
  }

  clearCache(): void {
    this.repositories = {};
    this.lastInitialized = undefined;
  }
}

const repositoryCache = RepositoryCache.getInstance();

/**
 * Metrics collector for data layer operations
 */
class DataLayerMetricsCollector {
  private metrics: Array<{
    operation: string;
    duration: number;
    success: boolean;
    timestamp: Date;
    metadata?: any;
  }> = [];

  recordOperation(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: any
  ): void {
    this.metrics.push({
      operation,
      duration,
      success,
      timestamp: new Date(),
      metadata
    });

    // Keep only last 1000 entries
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  getMetrics(timeRange?: { start: Date; end: Date }): {
    totalOperations: number;
    successRate: number;
    averageDuration: number;
    operationBreakdown: Record<string, number>;
    recentErrors: Array<{ operation: string; timestamp: Date; metadata?: any }>;
  } {
    let filteredMetrics = this.metrics;
    
    if (timeRange) {
      filteredMetrics = this.metrics.filter(
        m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    const totalOperations = filteredMetrics.length;
    const successfulOperations = filteredMetrics.filter(m => m.success).length;
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;
    const averageDuration = totalOperations > 0 
      ? filteredMetrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations 
      : 0;

    const operationBreakdown: Record<string, number> = {};
    filteredMetrics.forEach(m => {
      operationBreakdown[m.operation] = (operationBreakdown[m.operation] || 0) + 1;
    });

    const recentErrors = filteredMetrics
      .filter(m => !m.success)
      .slice(-10)
      .map(m => ({
        operation: m.operation,
        timestamp: m.timestamp,
        metadata: m.metadata
      }));

    return {
      totalOperations,
      successRate,
      averageDuration,
      operationBreakdown,
      recentErrors
    };
  }

  clearMetrics(): void {
    this.metrics = [];
  }
}

export const metricsCollector = new DataLayerMetricsCollector();

/**
 * Helper function to measure operation performance
 */
export async function measureOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: any
): Promise<T> {
  const startTime = Date.now();
  let success = false;
  
  try {
    const result = await fn();
    success = true;
    return result;
  } catch (error) {
    metadata = { ...metadata, error: error.message };
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    metricsCollector.recordOperation(operation, duration, success, metadata);
  }
}