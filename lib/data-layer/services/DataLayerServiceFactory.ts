/**
 * Data Layer Service Factory
 * Central factory for creating and configuring repository instances
 * Manages the transition between Firestore and Cosmos DB storage systems
 */

import { CosmosClient, CosmosClientOptions } from '@azure/cosmos';
import { getFirestore } from 'firebase-admin/firestore';
import { CosmosResumeRepository } from '../cosmos/CosmosResumeRepository';
import { CosmosUsageRepository } from '../cosmos/CosmosUsageRepository';
import { FirestoreResumeRepository } from '../firestore/FirestoreResumeRepository';
import { IResumeRepository, IUsageRepository } from '../interfaces/IRepositories';
import { 
  DualWriteRepositoryDecorator,
  DualWriteResumeRepository,
  DualWriteUsageRepository,
  WriteStrategy,
  ReadStrategy,
  DualWriteConfig 
} from '../decorators/DualWriteRepositoryDecorator';
import { DataMigrationManager, MigrationOptions } from '../migration/DataMigrationManager';

export enum DataStoreType {
  FIRESTORE = 'firestore',
  COSMOS_DB = 'cosmos_db',
  DUAL_WRITE = 'dual_write'
}

export enum MigrationPhase {
  // Phase 1: Pure Firestore (current state)
  FIRESTORE_ONLY = 'firestore_only',
  
  // Phase 2: Dual write with Firestore as primary, Cosmos DB as secondary
  DUAL_WRITE_FIRESTORE_PRIMARY = 'dual_write_firestore_primary',
  
  // Phase 3: Dual write with data consistency validation
  DUAL_WRITE_WITH_VALIDATION = 'dual_write_with_validation',
  
  // Phase 4: Read from Cosmos DB, write to both with Cosmos DB as primary
  DUAL_WRITE_COSMOS_PRIMARY = 'dual_write_cosmos_primary',
  
  // Phase 5: Pure Cosmos DB (final state)
  COSMOS_DB_ONLY = 'cosmos_db_only'
}

interface DataLayerConfig {
  // Data store configuration
  dataStore: DataStoreType;
  migrationPhase: MigrationPhase;
  
  // Azure Cosmos DB configuration
  cosmosEndpoint?: string;
  cosmosKey?: string;
  cosmosDatabaseId?: string;
  cosmosOptions?: CosmosClientOptions;
  
  // Dual write configuration
  dualWriteConfig?: Partial<DualWriteConfig>;
  
  // Migration configuration
  migrationConfig?: Partial<MigrationOptions>;
  
  // Feature flags
  enableConsistencyValidation?: boolean;
  enableAsyncWrites?: boolean;
  enableRetryMechanism?: boolean;
  enableMigrationMetrics?: boolean;
  
  // Performance settings
  defaultRetryAttempts?: number;
  defaultRetryDelayMs?: number;
  defaultTimeout?: number;
}

interface RepositoryInstances {
  resumeRepository: IResumeRepository;
  usageRepository: IUsageRepository;
  migrationManager?: DataMigrationManager;
}

interface DataLayerMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  dualWriteInconsistencies: number;
  averageLatency: number;
  lastOperationTime: Date;
}

/**
 * Main Data Layer Service Factory
 * Manages repository creation and configuration based on current migration phase
 */
export class DataLayerServiceFactory {
  private static instance: DataLayerServiceFactory;
  private config: Required<DataLayerConfig>;
  private cosmosClient: CosmosClient | null = null;
  private repositories: RepositoryInstances | null = null;
  private migrationManager: DataMigrationManager | null = null;
  private metrics: DataLayerMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    dualWriteInconsistencies: 0,
    averageLatency: 0,
    lastOperationTime: new Date()
  };

  private constructor(config: DataLayerConfig) {
    // Set default configuration
    this.config = {
      dataStore: config.dataStore,
      migrationPhase: config.migrationPhase,
      cosmosEndpoint: config.cosmosEndpoint || process.env.COSMOS_ENDPOINT || '',
      cosmosKey: config.cosmosKey || process.env.COSMOS_KEY || '',
      cosmosDatabaseId: config.cosmosDatabaseId || process.env.COSMOS_DATABASE_ID || 'prepbettr',
      cosmosOptions: config.cosmosOptions || {},
      dualWriteConfig: config.dualWriteConfig || {},
      migrationConfig: config.migrationConfig || {},
      enableConsistencyValidation: config.enableConsistencyValidation ?? true,
      enableAsyncWrites: config.enableAsyncWrites ?? true,
      enableRetryMechanism: config.enableRetryMechanism ?? true,
      enableMigrationMetrics: config.enableMigrationMetrics ?? true,
      defaultRetryAttempts: config.defaultRetryAttempts ?? 3,
      defaultRetryDelayMs: config.defaultRetryDelayMs ?? 1000,
      defaultTimeout: config.defaultTimeout ?? 30000
    };

    this.validateConfiguration();
  }

  /**
   * Singleton pattern implementation
   */
  static getInstance(config?: DataLayerConfig): DataLayerServiceFactory {
    if (!DataLayerServiceFactory.instance) {
      if (!config) {
        throw new Error('Configuration is required for first initialization');
      }
      DataLayerServiceFactory.instance = new DataLayerServiceFactory(config);
    }
    return DataLayerServiceFactory.instance;
  }

  /**
   * Initialize the data layer with proper repository instances
   */
  async initialize(): Promise<RepositoryInstances> {
    if (this.repositories) {
      return this.repositories;
    }

    console.log(`Initializing data layer with phase: ${this.config.migrationPhase}`);

    // Initialize Cosmos DB client if needed
    if (this.needsCosmosDB()) {
      await this.initializeCosmosClient();
    }

    // Create repository instances based on migration phase
    this.repositories = await this.createRepositoryInstances();

    // Initialize migration manager if needed
    if (this.needsMigrationManager()) {
      this.migrationManager = this.createMigrationManager();
    }

    console.log('Data layer initialization completed');
    return this.repositories;
  }

  /**
   * Get repository instances (initialize if needed)
   */
  async getRepositories(): Promise<RepositoryInstances> {
    if (!this.repositories) {
      return await this.initialize();
    }
    return this.repositories;
  }

  /**
   * Update migration phase and reconfigure repositories
   */
  async updateMigrationPhase(newPhase: MigrationPhase): Promise<void> {
    console.log(`Updating migration phase from ${this.config.migrationPhase} to ${newPhase}`);
    
    this.config.migrationPhase = newPhase;
    
    // Reset repositories to force recreation with new configuration
    this.repositories = null;
    
    // Reinitialize with new phase
    await this.initialize();
    
    console.log(`Migration phase updated successfully to ${newPhase}`);
  }

  /**
   * Get current migration manager
   */
  getMigrationManager(): DataMigrationManager | null {
    return this.migrationManager;
  }

  /**
   * Get current data layer metrics
   */
  getMetrics(): DataLayerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      dualWriteInconsistencies: 0,
      averageLatency: 0,
      lastOperationTime: new Date()
    };
  }

  /**
   * Validate if the system is ready for migration
   */
  async validateMigrationReadiness(): Promise<{
    ready: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check Cosmos DB connectivity
    if (this.needsCosmosDB()) {
      try {
        if (!this.cosmosClient) {
          await this.initializeCosmosClient();
        }
        
        // Test database connectivity
        const { database } = this.cosmosClient!.databases.database(this.config.cosmosDatabaseId);
        await database.read();
      } catch (error) {
        issues.push(`Cosmos DB connectivity failed: ${error.message}`);
      }
    }

    // Check Firestore connectivity
    try {
      const firestore = getFirestore();
      await firestore.collection('_health_check').limit(1).get();
    } catch (error) {
      issues.push(`Firestore connectivity failed: ${error.message}`);
    }

    // Check configuration completeness
    if (this.config.migrationPhase !== MigrationPhase.FIRESTORE_ONLY && !this.config.cosmosEndpoint) {
      issues.push('Cosmos DB endpoint is required for migration phases');
    }

    if (this.config.migrationPhase !== MigrationPhase.FIRESTORE_ONLY && !this.config.cosmosKey) {
      issues.push('Cosmos DB key is required for migration phases');
    }

    // Add recommendations based on phase
    switch (this.config.migrationPhase) {
      case MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY:
        recommendations.push('Consider enabling async writes for better performance');
        recommendations.push('Monitor dual write consistency metrics closely');
        break;
      
      case MigrationPhase.DUAL_WRITE_WITH_VALIDATION:
        recommendations.push('Enable detailed consistency validation logging');
        recommendations.push('Set up alerts for data inconsistencies');
        break;
      
      case MigrationPhase.COSMOS_DB_ONLY:
        recommendations.push('Ensure all data has been successfully migrated');
        recommendations.push('Consider backing up Firestore data before finalizing');
        break;
    }

    return {
      ready: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Perform health check on all configured data stores
   */
  async performHealthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    firestore: { status: 'healthy' | 'unhealthy'; latency?: number; error?: string };
    cosmosdb: { status: 'healthy' | 'unhealthy'; latency?: number; error?: string };
  }> {
    const result = {
      overall: 'healthy' as const,
      firestore: { status: 'healthy' as const, latency: 0 },
      cosmosdb: { status: 'healthy' as const, latency: 0 }
    };

    // Test Firestore
    try {
      const startTime = Date.now();
      const firestore = getFirestore();
      await firestore.collection('_health_check').limit(1).get();
      result.firestore.latency = Date.now() - startTime;
    } catch (error) {
      result.firestore.status = 'unhealthy';
      result.firestore.error = error.message;
      result.overall = 'degraded';
    }

    // Test Cosmos DB if needed
    if (this.needsCosmosDB()) {
      try {
        const startTime = Date.now();
        if (!this.cosmosClient) {
          await this.initializeCosmosClient();
        }
        const { database } = this.cosmosClient!.databases.database(this.config.cosmosDatabaseId);
        await database.read();
        result.cosmosdb.latency = Date.now() - startTime;
      } catch (error) {
        result.cosmosdb.status = 'unhealthy';
        result.cosmosdb.error = error.message;
        result.overall = result.firestore.status === 'unhealthy' ? 'unhealthy' : 'degraded';
      }
    }

    return result;
  }

  // Private methods

  private validateConfiguration(): void {
    if (!Object.values(DataStoreType).includes(this.config.dataStore)) {
      throw new Error(`Invalid data store type: ${this.config.dataStore}`);
    }

    if (!Object.values(MigrationPhase).includes(this.config.migrationPhase)) {
      throw new Error(`Invalid migration phase: ${this.config.migrationPhase}`);
    }

    if (this.needsCosmosDB() && !this.config.cosmosEndpoint) {
      throw new Error('Cosmos DB endpoint is required for the current migration phase');
    }

    if (this.needsCosmosDB() && !this.config.cosmosKey) {
      throw new Error('Cosmos DB key is required for the current migration phase');
    }
  }

  private needsCosmosDB(): boolean {
    return this.config.migrationPhase !== MigrationPhase.FIRESTORE_ONLY;
  }

  private needsMigrationManager(): boolean {
    return [
      MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY,
      MigrationPhase.DUAL_WRITE_WITH_VALIDATION,
      MigrationPhase.DUAL_WRITE_COSMOS_PRIMARY
    ].includes(this.config.migrationPhase);
  }

  private async initializeCosmosClient(): Promise<void> {
    if (this.cosmosClient) {
      return;
    }

    const clientOptions: CosmosClientOptions = {
      endpoint: this.config.cosmosEndpoint,
      key: this.config.cosmosKey,
      connectionPolicy: {
        requestTimeout: this.config.defaultTimeout,
        ...this.config.cosmosOptions.connectionPolicy
      },
      ...this.config.cosmosOptions
    };

    this.cosmosClient = new CosmosClient(clientOptions);

    // Test the connection
    try {
      const { database } = this.cosmosClient.databases.database(this.config.cosmosDatabaseId);
      await database.read();
      console.log('Cosmos DB client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Cosmos DB client:', error);
      throw error;
    }
  }

  private async createRepositoryInstances(): Promise<RepositoryInstances> {
    switch (this.config.migrationPhase) {
      case MigrationPhase.FIRESTORE_ONLY:
        return this.createFirestoreOnlyRepositories();
      
      case MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY:
        return this.createDualWriteFirestorePrimaryRepositories();
      
      case MigrationPhase.DUAL_WRITE_WITH_VALIDATION:
        return this.createDualWriteWithValidationRepositories();
      
      case MigrationPhase.DUAL_WRITE_COSMOS_PRIMARY:
        return this.createDualWriteCosmosPrimaryRepositories();
      
      case MigrationPhase.COSMOS_DB_ONLY:
        return this.createCosmosOnlyRepositories();
      
      default:
        throw new Error(`Unsupported migration phase: ${this.config.migrationPhase}`);
    }
  }

  private createFirestoreOnlyRepositories(): RepositoryInstances {
    return {
      resumeRepository: new FirestoreResumeRepository(),
      usageRepository: new FirestoreResumeRepository() as any // Placeholder - would need FirestoreUsageRepository
    };
  }

  private createDualWriteFirestorePrimaryRepositories(): RepositoryInstances {
    if (!this.cosmosClient) {
      throw new Error('Cosmos client not initialized');
    }

    const firestoreResumeRepo = new FirestoreResumeRepository();
    const cosmosResumeRepo = new CosmosResumeRepository(this.cosmosClient, this.config.cosmosDatabaseId);
    const cosmosUsageRepo = new CosmosUsageRepository(this.cosmosClient, this.config.cosmosDatabaseId);

    const dualWriteConfig: DualWriteConfig = {
      writeStrategy: this.config.enableAsyncWrites ? WriteStrategy.DUAL_WRITE_ASYNC : WriteStrategy.DUAL_WRITE,
      readStrategy: ReadStrategy.PRIMARY_WITH_FALLBACK,
      validateConsistency: false,
      maxRetries: this.config.defaultRetryAttempts,
      retryDelayMs: this.config.defaultRetryDelayMs,
      logInconsistencies: true,
      failOnInconsistency: false,
      ...this.config.dualWriteConfig
    };

    return {
      resumeRepository: new DualWriteResumeRepository(firestoreResumeRepo, cosmosResumeRepo, dualWriteConfig),
      usageRepository: new DualWriteUsageRepository(
        firestoreResumeRepo as any, // Placeholder
        cosmosUsageRepo,
        dualWriteConfig
      )
    };
  }

  private createDualWriteWithValidationRepositories(): RepositoryInstances {
    if (!this.cosmosClient) {
      throw new Error('Cosmos client not initialized');
    }

    const firestoreResumeRepo = new FirestoreResumeRepository();
    const cosmosResumeRepo = new CosmosResumeRepository(this.cosmosClient, this.config.cosmosDatabaseId);
    const cosmosUsageRepo = new CosmosUsageRepository(this.cosmosClient, this.config.cosmosDatabaseId);

    const dualWriteConfig: DualWriteConfig = {
      writeStrategy: WriteStrategy.DUAL_WRITE,
      readStrategy: ReadStrategy.COMPARE_AND_RETURN_PRIMARY,
      validateConsistency: this.config.enableConsistencyValidation,
      maxRetries: this.config.defaultRetryAttempts,
      retryDelayMs: this.config.defaultRetryDelayMs,
      logInconsistencies: true,
      failOnInconsistency: false,
      ...this.config.dualWriteConfig
    };

    return {
      resumeRepository: new DualWriteResumeRepository(firestoreResumeRepo, cosmosResumeRepo, dualWriteConfig),
      usageRepository: new DualWriteUsageRepository(
        firestoreResumeRepo as any, // Placeholder
        cosmosUsageRepo,
        dualWriteConfig
      )
    };
  }

  private createDualWriteCosmosPrimaryRepositories(): RepositoryInstances {
    if (!this.cosmosClient) {
      throw new Error('Cosmos client not initialized');
    }

    const firestoreResumeRepo = new FirestoreResumeRepository();
    const cosmosResumeRepo = new CosmosResumeRepository(this.cosmosClient, this.config.cosmosDatabaseId);
    const cosmosUsageRepo = new CosmosUsageRepository(this.cosmosClient, this.config.cosmosDatabaseId);

    const dualWriteConfig: DualWriteConfig = {
      writeStrategy: WriteStrategy.DUAL_WRITE,
      readStrategy: ReadStrategy.PRIMARY_ONLY,
      validateConsistency: false,
      maxRetries: this.config.defaultRetryAttempts,
      retryDelayMs: this.config.defaultRetryDelayMs,
      logInconsistencies: true,
      failOnInconsistency: false,
      ...this.config.dualWriteConfig
    };

    return {
      resumeRepository: new DualWriteResumeRepository(cosmosResumeRepo, firestoreResumeRepo, dualWriteConfig),
      usageRepository: new DualWriteUsageRepository(
        cosmosUsageRepo,
        firestoreResumeRepo as any, // Placeholder
        dualWriteConfig
      )
    };
  }

  private createCosmosOnlyRepositories(): RepositoryInstances {
    if (!this.cosmosClient) {
      throw new Error('Cosmos client not initialized');
    }

    return {
      resumeRepository: new CosmosResumeRepository(this.cosmosClient, this.config.cosmosDatabaseId),
      usageRepository: new CosmosUsageRepository(this.cosmosClient, this.config.cosmosDatabaseId)
    };
  }

  private createMigrationManager(): DataMigrationManager {
    if (!this.cosmosClient) {
      throw new Error('Cosmos client not initialized for migration manager');
    }

    const migrationOptions: MigrationOptions = {
      cosmosClient: this.cosmosClient,
      databaseId: this.config.cosmosDatabaseId,
      batchSize: 50,
      concurrency: 3,
      retryAttempts: this.config.defaultRetryAttempts,
      retryDelayMs: this.config.defaultRetryDelayMs,
      ...this.config.migrationConfig
    };

    return new DataMigrationManager(migrationOptions);
  }
}

/**
 * Convenience factory functions for common use cases
 */

class DataLayerFactory {
  /**
   * Create factory for development environment (Firestore only)
   */
  static forDevelopment(): DataLayerServiceFactory {
    return DataLayerServiceFactory.getInstance({
      dataStore: DataStoreType.FIRESTORE,
      migrationPhase: MigrationPhase.FIRESTORE_ONLY,
      enableConsistencyValidation: false,
      enableAsyncWrites: false,
      enableRetryMechanism: true
    });
  }

  /**
   * Create factory for staging environment (dual write with validation)
   */
  static forStaging(cosmosConfig: {
    endpoint: string;
    key: string;
    databaseId?: string;
  }): DataLayerServiceFactory {
    return DataLayerServiceFactory.getInstance({
      dataStore: DataStoreType.DUAL_WRITE,
      migrationPhase: MigrationPhase.DUAL_WRITE_WITH_VALIDATION,
      cosmosEndpoint: cosmosConfig.endpoint,
      cosmosKey: cosmosConfig.key,
      cosmosDatabaseId: cosmosConfig.databaseId || 'prepbettr-staging',
      enableConsistencyValidation: true,
      enableAsyncWrites: true,
      enableRetryMechanism: true,
      enableMigrationMetrics: true
    });
  }

  /**
   * Create factory for production environment
   */
  static forProduction(
    cosmosConfig: {
      endpoint: string;
      key: string;
      databaseId?: string;
    },
    phase: MigrationPhase = MigrationPhase.COSMOS_DB_ONLY
  ): DataLayerServiceFactory {
    return DataLayerServiceFactory.getInstance({
      dataStore: phase === MigrationPhase.COSMOS_DB_ONLY ? DataStoreType.COSMOS_DB : DataStoreType.DUAL_WRITE,
      migrationPhase: phase,
      cosmosEndpoint: cosmosConfig.endpoint,
      cosmosKey: cosmosConfig.key,
      cosmosDatabaseId: cosmosConfig.databaseId || 'prepbettr',
      enableConsistencyValidation: phase !== MigrationPhase.COSMOS_DB_ONLY,
      enableAsyncWrites: true,
      enableRetryMechanism: true,
      enableMigrationMetrics: true,
      defaultRetryAttempts: 5,
      defaultRetryDelayMs: 2000,
      defaultTimeout: 60000
    });
  }

  /**
   * Create factory for migration testing
   */
  static forMigrationTesting(cosmosConfig: {
    endpoint: string;
    key: string;
    databaseId?: string;
  }): DataLayerServiceFactory {
    return DataLayerServiceFactory.getInstance({
      dataStore: DataStoreType.DUAL_WRITE,
      migrationPhase: MigrationPhase.DUAL_WRITE_FIRESTORE_PRIMARY,
      cosmosEndpoint: cosmosConfig.endpoint,
      cosmosKey: cosmosConfig.key,
      cosmosDatabaseId: cosmosConfig.databaseId || 'prepbettr-test',
      enableConsistencyValidation: true,
      enableAsyncWrites: false, // Synchronous for testing
      enableRetryMechanism: true,
      enableMigrationMetrics: true,
      defaultRetryAttempts: 1,
      defaultRetryDelayMs: 500
    });
  }
}

// Export types and enums for external use
;