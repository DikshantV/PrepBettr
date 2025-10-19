// Dual-Write Repository Decorator
// Enables gradual migration by writing to both Firestore and Cosmos DB simultaneously

import { IDocumentRepository, QueryOptions, DocumentResult } from './interfaces/IDocumentRepository';
import { unifiedConfigService } from '../services/unified-config-service';

export interface DualWriteConfig {
  primaryProvider: 'firestore' | 'cosmos';
  secondaryProvider: 'firestore' | 'cosmos';
  enableDualWrite: boolean;
  enableDualRead: boolean;
  readFallbackEnabled: boolean;
  writeConsistencyCheck: boolean;
  syncDelayMs: number;
  maxRetries: number;
}

export interface DualWriteMetrics {
  primaryWrites: number;
  secondaryWrites: number;
  writeSuccesses: number;
  writeFailures: number;
  readHits: number;
  readMisses: number;
  fallbackReads: number;
  consistencyErrors: number;
  syncLatencyMs: number[];
}

export class DualWriteRepositoryDecorator<T extends { id: string }> implements IDocumentRepository<T> {
  private config: DualWriteConfig;
  private metrics: DualWriteMetrics;
  private primaryRepo: IDocumentRepository<T>;
  private secondaryRepo: IDocumentRepository<T>;

  constructor(
    primaryRepo: IDocumentRepository<T>,
    secondaryRepo: IDocumentRepository<T>,
    config?: Partial<DualWriteConfig>
  ) {
    this.primaryRepo = primaryRepo;
    this.secondaryRepo = secondaryRepo;
    
    this.config = {
      primaryProvider: 'cosmos',
      secondaryProvider: 'firestore',
      enableDualWrite: true,
      enableDualRead: false, // Start with dual writes only
      readFallbackEnabled: true,
      writeConsistencyCheck: false, // Expensive, enable for testing only
      syncDelayMs: 0,
      maxRetries: 2,
      ...config
    };

    this.metrics = {
      primaryWrites: 0,
      secondaryWrites: 0,
      writeSuccesses: 0,
      writeFailures: 0,
      readHits: 0,
      readMisses: 0,
      fallbackReads: 0,
      consistencyErrors: 0,
      syncLatencyMs: []
    };

    this.loadConfigFromRemote();
  }

  private async loadConfigFromRemote(): Promise<void> {
    try {
      // Load dual-write configuration from unified config service
      const dualWriteEnabled = await unifiedConfigService.get('migration.dualWriteEnabled', true);
      const readFallbackEnabled = await unifiedConfigService.get('migration.readFallbackEnabled', true);
      const consistencyCheckEnabled = await unifiedConfigService.get('migration.consistencyCheckEnabled', false);
      
      this.config.enableDualWrite = dualWriteEnabled;
      this.config.readFallbackEnabled = readFallbackEnabled;
      this.config.writeConsistencyCheck = consistencyCheckEnabled;
      
      console.log('📊 Dual-write configuration loaded:', {
        dualWrite: this.config.enableDualWrite,
        fallback: this.config.readFallbackEnabled,
        consistency: this.config.writeConsistencyCheck
      });
    } catch (error) {
      console.warn('⚠️ Failed to load dual-write config, using defaults:', error.message);
    }
  }

  async create(data: Omit<T, 'id'>): Promise<DocumentResult<T>> {
    const startTime = Date.now();
    
    try {
      // Primary write (always execute)
      const primaryResult = await this.primaryRepo.create(data);
      this.metrics.primaryWrites++;

      if (!primaryResult.success) {
        this.metrics.writeFailures++;
        return primaryResult;
      }

      // Secondary write (if dual-write enabled)
      if (this.config.enableDualWrite) {
        try {
          await this.executeSecondaryWrite(async () => {
            // Use the same ID for consistency
            const dataWithId = { ...data, id: primaryResult.data!.id } as T;
            return await this.secondaryRepo.create(dataWithId);
          });
        } catch (secondaryError) {
          console.warn(`⚠️ Secondary write failed (non-blocking):`, secondaryError.message);
          // Don't fail the operation if secondary write fails
        }
      }

      // Consistency check (if enabled)
      if (this.config.writeConsistencyCheck) {
        await this.performConsistencyCheck(primaryResult.data!.id);
      }

      this.metrics.writeSuccesses++;
      this.metrics.syncLatencyMs.push(Date.now() - startTime);

      return primaryResult;
    } catch (error) {
      this.metrics.writeFailures++;
      console.error('❌ Dual-write create operation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async findById(id: string): Promise<DocumentResult<T | null>> {
    try {
      // Try primary repository first
      const primaryResult = await this.primaryRepo.findById(id);
      
      if (primaryResult.success && primaryResult.data) {
        this.metrics.readHits++;
        return primaryResult;
      }

      this.metrics.readMisses++;

      // Fallback to secondary repository if enabled
      if (this.config.readFallbackEnabled) {
        try {
          const secondaryResult = await this.secondaryRepo.findById(id);
          if (secondaryResult.success && secondaryResult.data) {
            this.metrics.fallbackReads++;
            
            // Optional: trigger background sync to primary
            this.triggerBackgroundSync(secondaryResult.data);
            
            return secondaryResult;
          }
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback read failed:`, fallbackError.message);
        }
      }

      return primaryResult; // Return original result (likely null)
    } catch (error) {
      console.error('❌ Dual-write findById failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async findMany(query: QueryOptions): Promise<DocumentResult<T[]>> {
    try {
      // For complex queries, use primary repository only
      // Dual-read for queries is complex and may not be consistent
      const result = await this.primaryRepo.findMany(query);
      
      if (result.success) {
        this.metrics.readHits++;
      } else {
        this.metrics.readMisses++;
      }

      return result;
    } catch (error) {
      console.error('❌ Dual-write findMany failed:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  async update(id: string, data: Partial<T>): Promise<DocumentResult<T>> {
    const startTime = Date.now();
    
    try {
      // Primary update
      const primaryResult = await this.primaryRepo.update(id, data);
      this.metrics.primaryWrites++;

      if (!primaryResult.success) {
        this.metrics.writeFailures++;
        return primaryResult;
      }

      // Secondary update (if dual-write enabled)
      if (this.config.enableDualWrite) {
        try {
          await this.executeSecondaryWrite(async () => {
            return await this.secondaryRepo.update(id, data);
          });
        } catch (secondaryError) {
          console.warn(`⚠️ Secondary update failed (non-blocking):`, secondaryError.message);
        }
      }

      // Consistency check (if enabled)
      if (this.config.writeConsistencyCheck) {
        await this.performConsistencyCheck(id);
      }

      this.metrics.writeSuccesses++;
      this.metrics.syncLatencyMs.push(Date.now() - startTime);

      return primaryResult;
    } catch (error) {
      this.metrics.writeFailures++;
      console.error('❌ Dual-write update operation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async delete(id: string): Promise<DocumentResult<boolean>> {
    const startTime = Date.now();
    
    try {
      // Primary delete
      const primaryResult = await this.primaryRepo.delete(id);
      this.metrics.primaryWrites++;

      if (!primaryResult.success) {
        this.metrics.writeFailures++;
        return primaryResult;
      }

      // Secondary delete (if dual-write enabled)
      if (this.config.enableDualWrite) {
        try {
          await this.executeSecondaryWrite(async () => {
            return await this.secondaryRepo.delete(id);
          });
        } catch (secondaryError) {
          console.warn(`⚠️ Secondary delete failed (non-blocking):`, secondaryError.message);
        }
      }

      this.metrics.writeSuccesses++;
      this.metrics.syncLatencyMs.push(Date.now() - startTime);

      return primaryResult;
    } catch (error) {
      this.metrics.writeFailures++;
      console.error('❌ Dual-write delete operation failed:', error);
      return {
        success: false,
        error: error.message,
        data: false
      };
    }
  }

  async count(query?: QueryOptions): Promise<DocumentResult<number>> {
    try {
      // Use primary repository for count operations
      return await this.primaryRepo.count(query);
    } catch (error) {
      console.error('❌ Dual-write count failed:', error);
      return {
        success: false,
        error: error.message,
        data: 0
      };
    }
  }

  async exists(id: string): Promise<DocumentResult<boolean>> {
    try {
      // Check primary first
      const primaryResult = await this.primaryRepo.exists(id);
      
      if (primaryResult.success && primaryResult.data) {
        return primaryResult;
      }

      // Fallback to secondary if enabled
      if (this.config.readFallbackEnabled) {
        try {
          const secondaryResult = await this.secondaryRepo.exists(id);
          if (secondaryResult.success && secondaryResult.data) {
            this.metrics.fallbackReads++;
            return secondaryResult;
          }
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback exists check failed:`, fallbackError.message);
        }
      }

      return primaryResult;
    } catch (error) {
      console.error('❌ Dual-write exists check failed:', error);
      return {
        success: false,
        error: error.message,
        data: false
      };
    }
  }

  // Dual-write specific methods

  private async executeSecondaryWrite<R>(operation: () => Promise<DocumentResult<R>>): Promise<void> {
    if (this.config.syncDelayMs > 0) {
      // Delayed secondary write (async)
      setTimeout(async () => {
        try {
          await this.retryOperation(operation);
          this.metrics.secondaryWrites++;
        } catch (error) {
          console.warn('⚠️ Delayed secondary write failed:', error.message);
        }
      }, this.config.syncDelayMs);
    } else {
      // Immediate secondary write (sync)
      await this.retryOperation(operation);
      this.metrics.secondaryWrites++;
    }
  }

  private async retryOperation<R>(operation: () => Promise<DocumentResult<R>>): Promise<DocumentResult<R>> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await this.sleep(delay);
          console.log(`🔄 Retrying secondary operation (attempt ${attempt + 1}/${this.config.maxRetries + 1})`);
        }
      }
    }
    
    throw lastError!;
  }

  private async performConsistencyCheck(id: string): Promise<void> {
    try {
      const [primaryDoc, secondaryDoc] = await Promise.all([
        this.primaryRepo.findById(id),
        this.secondaryRepo.findById(id)
      ]);

      if (primaryDoc.success && secondaryDoc.success) {
        if (primaryDoc.data && secondaryDoc.data) {
          // Compare documents (basic comparison)
          const primaryStr = JSON.stringify(this.sanitizeForComparison(primaryDoc.data));
          const secondaryStr = JSON.stringify(this.sanitizeForComparison(secondaryDoc.data));
          
          if (primaryStr !== secondaryStr) {
            this.metrics.consistencyErrors++;
            console.warn(`⚠️ Consistency check failed for document ${id}`);
            
            // Log to monitoring/alerting system
            this.logConsistencyError(id, primaryDoc.data, secondaryDoc.data);
          }
        } else if (primaryDoc.data !== secondaryDoc.data) {
          // One exists, the other doesn't
          this.metrics.consistencyErrors++;
          console.warn(`⚠️ Document existence mismatch for ${id}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Consistency check failed:', error.message);
    }
  }

  private sanitizeForComparison(doc: T): any {
    const sanitized = { ...doc };
    
    // Remove fields that may differ between providers
    delete (sanitized as any)._migrationInfo;
    delete (sanitized as any)._ts; // Cosmos DB timestamp
    delete (sanitized as any)._etag; // Cosmos DB etag
    delete (sanitized as any).updatedAt; // May differ slightly
    
    return sanitized;
  }

  private async triggerBackgroundSync(data: T): Promise<void> {
    // Background sync from secondary to primary
    setTimeout(async () => {
      try {
        await this.primaryRepo.create(data);
        console.log(`📋 Background sync completed for document ${data.id}`);
      } catch (error) {
        console.warn(`⚠️ Background sync failed for document ${data.id}:`, error.message);
      }
    }, 5000); // 5 second delay
  }

  private logConsistencyError(id: string, primaryDoc: T, secondaryDoc: T): void {
    // In a real implementation, this would send to monitoring system
    console.error('🚨 CONSISTENCY ERROR:', {
      documentId: id,
      timestamp: new Date().toISOString(),
      primaryProvider: this.config.primaryProvider,
      secondaryProvider: this.config.secondaryProvider
    });

    // You could send this to Application Insights, Datadog, etc.
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Metrics and monitoring methods

  getMetrics(): DualWriteMetrics {
    return { ...this.metrics };
  }

  getHealthStatus(): {
    healthy: boolean;
    writeSuccessRate: number;
    avgSyncLatency: number;
    issues: string[];
  } {
    const totalWrites = this.metrics.writeSuccesses + this.metrics.writeFailures;
    const writeSuccessRate = totalWrites > 0 ? (this.metrics.writeSuccesses / totalWrites) * 100 : 100;
    const avgSyncLatency = this.metrics.syncLatencyMs.length > 0
      ? this.metrics.syncLatencyMs.reduce((a, b) => a + b, 0) / this.metrics.syncLatencyMs.length
      : 0;

    const issues: string[] = [];
    
    if (writeSuccessRate < 95) {
      issues.push(`Low write success rate: ${writeSuccessRate.toFixed(2)}%`);
    }
    
    if (avgSyncLatency > 5000) {
      issues.push(`High sync latency: ${avgSyncLatency.toFixed(0)}ms`);
    }
    
    if (this.metrics.consistencyErrors > 0) {
      issues.push(`Consistency errors detected: ${this.metrics.consistencyErrors}`);
    }

    return {
      healthy: issues.length === 0,
      writeSuccessRate,
      avgSyncLatency,
      issues
    };
  }

  resetMetrics(): void {
    this.metrics = {
      primaryWrites: 0,
      secondaryWrites: 0,
      writeSuccesses: 0,
      writeFailures: 0,
      readHits: 0,
      readMisses: 0,
      fallbackReads: 0,
      consistencyErrors: 0,
      syncLatencyMs: []
    };
  }

  // Configuration methods

  updateConfig(newConfig: Partial<DualWriteConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Dual-write configuration updated:', newConfig);
  }

  async enableDualWrite(enabled: boolean): Promise<void> {
    this.config.enableDualWrite = enabled;
    
    // Persist to unified config service
    try {
      await unifiedConfigService.set('migration.dualWriteEnabled', enabled);
      console.log(`🔄 Dual-write ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.warn('⚠️ Failed to persist dual-write setting:', error.message);
    }
  }

  async enableReadFallback(enabled: boolean): Promise<void> {
    this.config.readFallbackEnabled = enabled;
    
    // Persist to unified config service
    try {
      await unifiedConfigService.set('migration.readFallbackEnabled', enabled);
      console.log(`🔄 Read fallback ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.warn('⚠️ Failed to persist read fallback setting:', error.message);
    }
  }

  // Migration phase control methods

  async enterPhase1(): Promise<void> {
    // Phase 1: Dual writes to both systems, reads from primary only
    await this.enableDualWrite(true);
    await this.enableReadFallback(false);
    this.updateConfig({ enableDualRead: false });
    console.log('🚀 Entered Migration Phase 1: Dual writes, primary reads');
  }

  async enterPhase2(): Promise<void> {
    // Phase 2: Dual writes, reads from primary with fallback to secondary
    await this.enableDualWrite(true);
    await this.enableReadFallback(true);
    this.updateConfig({ enableDualRead: false });
    console.log('🚀 Entered Migration Phase 2: Dual writes, reads with fallback');
  }

  async enterPhase3(): Promise<void> {
    // Phase 3: Dual writes, dual reads (load balancing)
    await this.enableDualWrite(true);
    await this.enableReadFallback(true);
    this.updateConfig({ enableDualRead: true });
    console.log('🚀 Entered Migration Phase 3: Dual writes and reads');
  }

  async enterPhase4(): Promise<void> {
    // Phase 4: Single writes to primary, no fallback
    await this.enableDualWrite(false);
    await this.enableReadFallback(false);
    this.updateConfig({ enableDualRead: false });
    console.log('🎯 Entered Migration Phase 4: Single system (migration complete)');
  }
}

// Factory function for creating dual-write decorators
export function createDualWriteRepository<T extends { id: string }>(
  primaryRepo: IDocumentRepository<T>,
  secondaryRepo: IDocumentRepository<T>,
  config?: Partial<DualWriteConfig>
): DualWriteRepositoryDecorator<T> {
  return new DualWriteRepositoryDecorator(primaryRepo, secondaryRepo, config);
}

// Utility function for batch enabling dual-write across all repositories
export async function enableGlobalDualWrite(enabled: boolean): Promise<void> {
  try {
    await unifiedConfigService.set('migration.globalDualWriteEnabled', enabled);
    console.log(`🌍 Global dual-write ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('❌ Failed to set global dual-write setting:', error);
    throw error;
  }
}