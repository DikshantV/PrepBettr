/**
 * Unified Service Factory
 * 
 * Provides provider-agnostic access to all services with automatic
 * provider selection based on feature flags and configuration
 */

import { 
  IServiceFactory,
  IAuthService,
  IStorageService,
  IDocumentService,
  IConfigService,
  ServiceProvider
} from './interfaces';
import { BaseServiceFactory, ProviderSelector } from './interfaces/base-services';
import { getConfigManager, getFeatureFlagManager } from '../config/unified-config';

// Azure service imports
import { CosmosDBService } from '../azure/database/cosmos-db-service';
import { AzureBlobStorageService } from '../azure/storage/blob-storage-service';
import { AzureAppConfigService } from '../azure/config/app-config-service';

// Firebase service imports (adapters for existing services)
import { FirebaseAuthAdapter } from '../firebase/auth/auth-adapter';
import { FirebaseFirestoreAdapter } from '../firebase/database/firestore-adapter';
import { FirebaseStorageAdapter } from '../firebase/storage/storage-adapter';
import { FirebaseRemoteConfigAdapter } from '../firebase/config/remote-config-adapter';

export class UnifiedServiceFactory extends BaseServiceFactory implements IServiceFactory {
  private static instance: UnifiedServiceFactory;
  
  /**
   * Get singleton instance
   */
  static getInstance(): UnifiedServiceFactory {
    if (!UnifiedServiceFactory.instance) {
      UnifiedServiceFactory.instance = new UnifiedServiceFactory();
    }
    return UnifiedServiceFactory.instance;
  }
  
  /**
   * Get service provider (Firebase or Azure)
   */
  getProvider(name: 'firebase' | 'azure'): ServiceProvider {
    return {
      name,
      auth: this.getAuthService(name),
      storage: this.getStorageService(name),
      database: this.getDatabaseService(name),
      config: this.getConfigService(name)
    };
  }
  
  /**
   * Get authentication service with provider selection
   */
  getAuthService(provider?: 'firebase' | 'azure'): IAuthService {
    // Always use Firebase for auth (as per migration strategy)
    return this.getOrCreateService('auth-firebase', () => new FirebaseAuthAdapter());
  }
  
  /**
   * Get storage service with intelligent provider selection
   */
  getStorageService(provider?: 'firebase' | 'azure'): IStorageService {
    if (provider === 'azure') {
      return this.getOrCreateService('storage-azure', () => new AzureBlobStorageService());
    }
    
    if (provider === 'firebase') {
      return this.getOrCreateService('storage-firebase', () => new FirebaseStorageAdapter());
    }
    
    // Dynamic provider selection based on feature flags
    return new DynamicStorageService();
  }
  
  /**
   * Get database service with intelligent provider selection
   */
  getDatabaseService(provider?: 'firebase' | 'azure'): IDocumentService {
    if (provider === 'azure') {
      return this.getOrCreateService('database-azure', () => new CosmosDBService());
    }
    
    if (provider === 'firebase') {
      return this.getOrCreateService('database-firebase', () => new FirebaseFirestoreAdapter());
    }
    
    // Dynamic provider selection based on feature flags
    return new DynamicDatabaseService();
  }
  
  /**
   * Get configuration service with intelligent provider selection
   */
  getConfigService(provider?: 'firebase' | 'azure'): IConfigService {
    if (provider === 'azure') {
      return this.getOrCreateService('config-azure', () => new AzureAppConfigService());
    }
    
    if (provider === 'firebase') {
      return this.getOrCreateService('config-firebase', () => new FirebaseRemoteConfigAdapter());
    }
    
    // Dynamic provider selection based on feature flags
    return new DynamicConfigService();
  }
  
  /**
   * Get function service (placeholder - Azure Functions are different paradigm)
   */
  getFunctionService(provider?: 'firebase' | 'azure'): any {
    throw new Error('Function service not implemented in this migration (Azure Functions use different patterns)');
  }
  
  /**
   * Get speech service (Azure only)
   */
  getSpeechService(provider?: 'firebase' | 'azure'): any {
    // Speech is Azure-only, no Firebase equivalent
    return this.getOrCreateService('speech-azure', () => {
      // Import and return Azure Speech Service
      throw new Error('Azure Speech Service implementation needed');
    });
  }
  
  /**
   * Get AI service (Azure only)
   */
  getAIService(provider?: 'firebase' | 'azure'): any {
    // AI is Azure-only, no Firebase equivalent
    return this.getOrCreateService('ai-azure', () => {
      // Import and return Azure OpenAI Service
      throw new Error('Azure OpenAI Service implementation needed');
    });
  }
}

// ===== DYNAMIC SERVICE IMPLEMENTATIONS =====

/**
 * Dynamic Storage Service - automatically selects provider based on feature flags
 */
class DynamicStorageService implements IStorageService {
  private factory = UnifiedServiceFactory.getInstance();
  
  async upload(container: string, fileName: string, fileBuffer: Buffer, mimeType: string, options?: any): Promise<any> {
    const provider = await ProviderSelector.selectProvider('storage', options?.userId);
    const service = this.factory.getStorageService(provider);
    return service.upload(container, fileName, fileBuffer, mimeType, options);
  }
  
  async download(container: string, fileName: string): Promise<Buffer> {
    // Try Azure first, fallback to Firebase
    try {
      const azureService = this.factory.getStorageService('azure');
      return await azureService.download(container, fileName);
    } catch (error) {
      console.warn('Azure download failed, trying Firebase fallback');
      const firebaseService = this.factory.getStorageService('firebase');
      return firebaseService.download(container, fileName);
    }
  }
  
  async delete(container: string, fileName: string): Promise<void> {
    // Delete from both providers to ensure cleanup
    const [azureService, firebaseService] = [
      this.factory.getStorageService('azure'),
      this.factory.getStorageService('firebase')
    ];
    
    await Promise.allSettled([
      azureService.delete(container, fileName),
      firebaseService.delete(container, fileName)
    ]);
  }
  
  async generateSignedUrl(container: string, fileName: string, expiryHours?: number): Promise<string> {
    const provider = await ProviderSelector.selectProvider('storage');
    const service = this.factory.getStorageService(provider);
    return service.generateSignedUrl(container, fileName, expiryHours);
  }
  
  async listFiles(container: string, prefix?: string): Promise<any[]> {
    const provider = await ProviderSelector.selectProvider('storage');
    const service = this.factory.getStorageService(provider);
    return service.listFiles(container, prefix);
  }
  
  async getFileMetadata(container: string, fileName: string): Promise<any> {
    // Try both providers and return first successful result
    const [azureService, firebaseService] = [
      this.factory.getStorageService('azure'),
      this.factory.getStorageService('firebase')
    ];
    
    try {
      return await azureService.getFileMetadata(container, fileName);
    } catch (error) {
      console.warn('Azure metadata fetch failed, trying Firebase fallback');
      return firebaseService.getFileMetadata(container, fileName);
    }
  }
}

/**
 * Dynamic Database Service - automatically selects provider based on feature flags
 */
class DynamicDatabaseService implements IDocumentService {
  private factory = UnifiedServiceFactory.getInstance();
  
  async get(collection: string, documentId: string): Promise<any> {
    const provider = await ProviderSelector.selectProvider('database');
    const service = this.factory.getDatabaseService(provider);
    return service.get(collection, documentId);
  }
  
  async create(collection: string, data: Record<string, any>, documentId?: string): Promise<string> {
    const provider = await ProviderSelector.selectProvider('database', data.userId);
    const service = this.factory.getDatabaseService(provider);
    return service.create(collection, data, documentId);
  }
  
  async update(collection: string, documentId: string, data: Record<string, any>): Promise<void> {
    const provider = await ProviderSelector.selectProvider('database', data.userId);
    const service = this.factory.getDatabaseService(provider);
    return service.update(collection, documentId, data);
  }
  
  async delete(collection: string, documentId: string): Promise<void> {
    // Delete from both providers during migration period
    const [azureService, firebaseService] = [
      this.factory.getDatabaseService('azure'),
      this.factory.getDatabaseService('firebase')
    ];
    
    await Promise.allSettled([
      azureService.delete(collection, documentId),
      firebaseService.delete(collection, documentId)
    ]);
  }
  
  async query(collection: string, options?: any): Promise<any[]> {
    const provider = await ProviderSelector.selectProvider('database');
    const service = this.factory.getDatabaseService(provider);
    return service.query(collection, options);
  }
  
  subscribe(collection: string, documentId: string, callback: (doc: any) => void): () => void {
    // Always use Firebase for real-time subscriptions (Cosmos DB polling is less efficient)
    const firebaseService = this.factory.getDatabaseService('firebase');
    return firebaseService.subscribe(collection, documentId, callback);
  }
  
  subscribeToQuery(collection: string, options: any, callback: (docs: any[]) => void): () => void {
    // Always use Firebase for real-time query subscriptions
    const firebaseService = this.factory.getDatabaseService('firebase');
    return firebaseService.subscribeToQuery(collection, options, callback);
  }
}

/**
 * Dynamic Config Service - automatically selects provider based on feature flags
 */
class DynamicConfigService implements IConfigService {
  private factory = UnifiedServiceFactory.getInstance();
  
  async get(key: string, defaultValue?: any): Promise<any> {
    const provider = await ProviderSelector.selectProvider('config');
    const service = this.factory.getConfigService(provider);
    return service.get(key, defaultValue);
  }
  
  async set(key: string, value: any, environment?: string): Promise<void> {
    const provider = await ProviderSelector.selectProvider('config');
    const service = this.factory.getConfigService(provider);
    return service.set(key, value, environment);
  }
  
  async getAll(prefix?: string): Promise<Record<string, any>> {
    const provider = await ProviderSelector.selectProvider('config');
    const service = this.factory.getConfigService(provider);
    return service.getAll(prefix);
  }
  
  async refresh(): Promise<void> {
    // Refresh both providers
    const [azureService, firebaseService] = [
      this.factory.getConfigService('azure'),
      this.factory.getConfigService('firebase')
    ];
    
    await Promise.allSettled([
      azureService.refresh(),
      firebaseService.refresh()
    ]);
  }
  
  subscribe(key: string, callback: (value: any) => void): () => void {
    // Subscribe to both providers and merge updates
    const azureService = this.factory.getConfigService('azure');
    const firebaseService = this.factory.getConfigService('firebase');
    
    const azureUnsub = azureService.subscribe(key, callback);
    const firebaseUnsub = firebaseService.subscribe(key, callback);
    
    return () => {
      azureUnsub();
      firebaseUnsub();
    };
  }
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Get the unified service factory instance
 */
export function getServiceFactory(): UnifiedServiceFactory {
  return UnifiedServiceFactory.getInstance();
}

/**
 * Quick access to auth service (always Firebase)
 */
export function getAuthService(): IAuthService {
  return getServiceFactory().getAuthService();
}

/**
 * Quick access to storage service with dynamic provider selection
 */
export function getStorageService(): IStorageService {
  return getServiceFactory().getStorageService();
}

/**
 * Quick access to database service with dynamic provider selection
 */
export function getDatabaseService(): IDocumentService {
  return getServiceFactory().getDatabaseService();
}

/**
 * Quick access to config service with dynamic provider selection
 */
export function getConfigService(): IConfigService {
  return getServiceFactory().getConfigService();
}

// ===== HEALTH CHECK UTILITIES =====

export class ServiceHealthChecker {
  /**
   * Check health of all services
   */
  static async checkAllServices(): Promise<Record<string, { healthy: boolean; message?: string; provider: string }>> {
    const factory = getServiceFactory();
    const results: Record<string, { healthy: boolean; message?: string; provider: string }> = {};
    
    // Check Firebase services
    try {
      const firebaseAuth = factory.getAuthService();
      if (firebaseAuth && typeof (firebaseAuth as any).healthCheck === 'function') {
        results['auth-firebase'] = {
          ...(await (firebaseAuth as any).healthCheck()),
          provider: 'firebase'
        };
      }
    } catch (error) {
      results['auth-firebase'] = { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Unknown error',
        provider: 'firebase'
      };
    }
    
    // Check Azure services
    const azureServices = [
      { name: 'database-azure', service: new CosmosDBService() },
      { name: 'storage-azure', service: new AzureBlobStorageService() },
      { name: 'config-azure', service: new AzureAppConfigService() }
    ];
    
    for (const { name, service } of azureServices) {
      try {
        results[name] = {
          ...(await service.healthCheck()),
          provider: 'azure'
        };
      } catch (error) {
        results[name] = { 
          healthy: false, 
          message: error instanceof Error ? error.message : 'Unknown error',
          provider: 'azure'
        };
      }
    }
    
    return results;
  }
  
  /**
   * Get health summary
   */
  static async getHealthSummary(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    details: string[];
  }> {
    const healthResults = await this.checkAllServices();
    const services: Record<string, boolean> = {};
    const details: string[] = [];
    
    let healthyCount = 0;
    let totalCount = 0;
    
    Object.entries(healthResults).forEach(([serviceName, result]) => {
      services[serviceName] = result.healthy;
      totalCount++;
      
      if (result.healthy) {
        healthyCount++;
      } else {
        details.push(`${serviceName}: ${result.message || 'Unknown error'}`);
      }
    });
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }
    
    return { overall, services, details };
  }
}

// ===== MIGRATION ORCHESTRATOR =====

export class MigrationOrchestrator {
  private factory = UnifiedServiceFactory.getInstance();
  
  /**
   * Migrate storage from Firebase to Azure
   */
  async migrateStorage(options: {
    containers?: string[];
    dryRun?: boolean;
    batchSize?: number;
  } = {}): Promise<{ success: boolean; results: Record<string, any> }> {
    const { containers = ['resumes', 'documents'], dryRun = false } = options;
    
    try {
      const firebaseStorage = this.factory.getStorageService('firebase');
      const azureStorage = this.factory.getStorageService('azure') as AzureBlobStorageService;
      
      const results: Record<string, any> = {};
      
      for (const container of containers) {
        console.log(`📦 Migrating container: ${container}`);
        
        const { BlobStorageMigrationUtils } = await import('../azure/storage/blob-storage-service');
        const result = await BlobStorageMigrationUtils.migrateFiles(
          firebaseStorage,
          azureStorage,
          container,
          { dryRun, batchSize: options.batchSize }
        );
        
        results[container] = result;
      }
      
      const success = Object.values(results).every((r: any) => r.success);
      
      return { success, results };
    } catch (error) {
      console.error('Storage migration failed:', error);
      return { 
        success: false, 
        results: { error: error instanceof Error ? error.message : 'Unknown error' } 
      };
    }
  }
  
  /**
   * Migrate database from Firestore to Cosmos DB
   */
  async migrateDatabase(options: {
    collections?: string[];
    dryRun?: boolean;
    batchSize?: number;
  } = {}): Promise<{ success: boolean; results: Record<string, any> }> {
    const { collections = ['users', 'interviews', 'resumes'], dryRun = false } = options;
    
    try {
      const firestoreService = this.factory.getDatabaseService('firebase');
      const cosmosService = this.factory.getDatabaseService('azure') as CosmosDBService;
      
      const results: Record<string, any> = {};
      
      for (const collection of collections) {
        console.log(`📦 Migrating collection: ${collection}`);
        
        const { CosmosDBMigrationUtils } = await import('../azure/database/cosmos-db-service');
        const result = await CosmosDBMigrationUtils.migrateCollection(
          firestoreService,
          cosmosService,
          collection,
          { dryRun, batchSize: options.batchSize }
        );
        
        results[collection] = result;
      }
      
      const success = Object.values(results).every((r: any) => r.success);
      
      return { success, results };
    } catch (error) {
      console.error('Database migration failed:', error);
      return { 
        success: false, 
        results: { error: error instanceof Error ? error.message : 'Unknown error' } 
      };
    }
  }
  
  /**
   * Rollback migration by switching back to Firebase
   */
  async rollbackToFirebase(): Promise<void> {
    try {
      const flagManager = await getFeatureFlagManager();
      await flagManager.emergencyDisable();
      
      console.log('✅ Rollback completed - all services switched back to Firebase');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
}

// ===== GLOBAL INSTANCES =====

let globalMigrationOrchestrator: MigrationOrchestrator | null = null;

export function getMigrationOrchestrator(): MigrationOrchestrator {
  if (!globalMigrationOrchestrator) {
    globalMigrationOrchestrator = new MigrationOrchestrator();
  }
  return globalMigrationOrchestrator;
}
