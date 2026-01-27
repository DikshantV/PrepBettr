/**
 * Dual Write Repository Decorator
 * Enables dual writes to both Firestore and Cosmos DB during migration
 * with fallback mechanisms, conflict resolution, and consistency checks
 */

import { IResumeRepository, IUsageRepository } from '../interfaces/IRepositories';
import { IResumeDocument, IUsageDocument, BaseDocument } from '../interfaces/IDocuments';
import { RepositoryResult } from '../interfaces/RepositoryResult';
import { QueryOptions, QueryResult } from '../interfaces/IRepositories';

export enum WriteStrategy {
  PRIMARY_ONLY = 'primary_only',
  DUAL_WRITE = 'dual_write',
  DUAL_WRITE_ASYNC = 'dual_write_async',
  SECONDARY_ONLY = 'secondary_only'
}

export enum ReadStrategy {
  PRIMARY_ONLY = 'primary_only',
  SECONDARY_ONLY = 'secondary_only',
  PRIMARY_WITH_FALLBACK = 'primary_with_fallback',
  COMPARE_AND_RETURN_PRIMARY = 'compare_and_return_primary'
}

export interface DualWriteConfig {
  writeStrategy: WriteStrategy;
  readStrategy: ReadStrategy;
  validateConsistency?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  logInconsistencies?: boolean;
  failOnInconsistency?: boolean;
  asyncWriteTimeoutMs?: number;
}

interface DualWriteResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  primaryResult?: RepositoryResult<T>;
  secondaryResult?: RepositoryResult<T>;
  inconsistencyDetected?: boolean;
  inconsistencyDetails?: string[];
}

interface ConsistencyCheckResult {
  consistent: boolean;
  differences: string[];
  primaryData?: any;
  secondaryData?: any;
}

/**
 * Generic Dual Write Repository Decorator
 * Wraps any repository implementation to enable dual writing
 */
export class DualWriteRepositoryDecorator<T extends BaseDocument> {
  private primaryRepo: IResumeRepository | IUsageRepository;
  private secondaryRepo: IResumeRepository | IUsageRepository;
  private config: Required<DualWriteConfig>;

  constructor(
    primaryRepo: IResumeRepository | IUsageRepository,
    secondaryRepo: IResumeRepository | IUsageRepository,
    config: DualWriteConfig
  ) {
    this.primaryRepo = primaryRepo;
    this.secondaryRepo = secondaryRepo;
    
    // Set default configuration
    this.config = {
      writeStrategy: config.writeStrategy,
      readStrategy: config.readStrategy,
      validateConsistency: config.validateConsistency ?? false,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      logInconsistencies: config.logInconsistencies ?? true,
      failOnInconsistency: config.failOnInconsistency ?? false,
      asyncWriteTimeoutMs: config.asyncWriteTimeoutMs ?? 5000
    };
  }

  /**
   * Create document with dual write support
   */
  async create(document: T): Promise<DualWriteResult<T>> {
    switch (this.config.writeStrategy) {
      case WriteStrategy.PRIMARY_ONLY:
        return this.createPrimaryOnly(document);
      
      case WriteStrategy.DUAL_WRITE:
        return this.createDualWrite(document);
      
      case WriteStrategy.DUAL_WRITE_ASYNC:
        return this.createDualWriteAsync(document);
      
      case WriteStrategy.SECONDARY_ONLY:
        return this.createSecondaryOnly(document);
      
      default:
        throw new Error(`Unsupported write strategy: ${this.config.writeStrategy}`);
    }
  }

  /**
   * Find document by ID with read strategy support
   */
  async findById(id: string): Promise<DualWriteResult<T>> {
    switch (this.config.readStrategy) {
      case ReadStrategy.PRIMARY_ONLY:
        return this.findByIdPrimaryOnly(id);
      
      case ReadStrategy.SECONDARY_ONLY:
        return this.findByIdSecondaryOnly(id);
      
      case ReadStrategy.PRIMARY_WITH_FALLBACK:
        return this.findByIdWithFallback(id);
      
      case ReadStrategy.COMPARE_AND_RETURN_PRIMARY:
        return this.findByIdWithComparison(id);
      
      default:
        throw new Error(`Unsupported read strategy: ${this.config.readStrategy}`);
    }
  }

  /**
   * Find multiple documents
   */
  async findMany(query: Record<string, any> = {}, options?: QueryOptions): Promise<DualWriteResult<T[]>> {
    switch (this.config.readStrategy) {
      case ReadStrategy.PRIMARY_ONLY:
        return this.findManyPrimaryOnly(query, options);
      
      case ReadStrategy.SECONDARY_ONLY:
        return this.findManySecondaryOnly(query, options);
      
      case ReadStrategy.PRIMARY_WITH_FALLBACK:
        return this.findManyWithFallback(query, options);
      
      case ReadStrategy.COMPARE_AND_RETURN_PRIMARY:
        return this.findManyWithComparison(query, options);
      
      default:
        throw new Error(`Unsupported read strategy: ${this.config.readStrategy}`);
    }
  }

  /**
   * Update document with dual write support
   */
  async update(id: string, updates: Partial<T>): Promise<DualWriteResult<T>> {
    switch (this.config.writeStrategy) {
      case WriteStrategy.PRIMARY_ONLY:
        return this.updatePrimaryOnly(id, updates);
      
      case WriteStrategy.DUAL_WRITE:
        return this.updateDualWrite(id, updates);
      
      case WriteStrategy.DUAL_WRITE_ASYNC:
        return this.updateDualWriteAsync(id, updates);
      
      case WriteStrategy.SECONDARY_ONLY:
        return this.updateSecondaryOnly(id, updates);
      
      default:
        throw new Error(`Unsupported write strategy: ${this.config.writeStrategy}`);
    }
  }

  /**
   * Delete document with dual write support
   */
  async delete(id: string): Promise<DualWriteResult<boolean>> {
    switch (this.config.writeStrategy) {
      case WriteStrategy.PRIMARY_ONLY:
        return this.deletePrimaryOnly(id);
      
      case WriteStrategy.DUAL_WRITE:
        return this.deleteDualWrite(id);
      
      case WriteStrategy.DUAL_WRITE_ASYNC:
        return this.deleteDualWriteAsync(id);
      
      case WriteStrategy.SECONDARY_ONLY:
        return this.deleteSecondaryOnly(id);
      
      default:
        throw new Error(`Unsupported write strategy: ${this.config.writeStrategy}`);
    }
  }

  /**
   * Count documents
   */
  async count(query: Record<string, any> = {}): Promise<DualWriteResult<number>> {
    switch (this.config.readStrategy) {
      case ReadStrategy.PRIMARY_ONLY:
        const primaryCountResult = await this.primaryRepo.count(query);
        return this.wrapResult(primaryCountResult);
      
      case ReadStrategy.SECONDARY_ONLY:
        const secondaryCountResult = await this.secondaryRepo.count(query);
        return this.wrapResult(secondaryCountResult);
      
      case ReadStrategy.PRIMARY_WITH_FALLBACK:
        const primaryResult = await this.primaryRepo.count(query);
        if (primaryResult.success) {
          return this.wrapResult(primaryResult);
        }
        const fallbackResult = await this.secondaryRepo.count(query);
        return this.wrapResult(fallbackResult);
      
      case ReadStrategy.COMPARE_AND_RETURN_PRIMARY:
        const [primary, secondary] = await Promise.allSettled([
          this.primaryRepo.count(query),
          this.secondaryRepo.count(query)
        ]);

        const primaryCount = primary.status === 'fulfilled' ? primary.value : null;
        const secondaryCount = secondary.status === 'fulfilled' ? secondary.value : null;

        if (primaryCount?.success && secondaryCount?.success) {
          const inconsistent = primaryCount.data !== secondaryCount.data;
          if (inconsistent && this.config.logInconsistencies) {
            console.warn(`Count inconsistency detected: Primary=${primaryCount.data}, Secondary=${secondaryCount.data}`);
          }
        }

        return this.wrapResult(primaryCount || { success: false, error: 'Primary count failed' });
      
      default:
        throw new Error(`Unsupported read strategy: ${this.config.readStrategy}`);
    }
  }

  /**
   * Check if document exists
   */
  async exists(id: string): Promise<DualWriteResult<boolean>> {
    const result = await this.findById(id);
    return {
      success: result.success,
      data: result.success && !!result.data,
      error: result.error,
      inconsistencyDetected: result.inconsistencyDetected,
      inconsistencyDetails: result.inconsistencyDetails
    };
  }

  // Private methods for different write strategies

  private async createPrimaryOnly(document: T): Promise<DualWriteResult<T>> {
    const result = await this.primaryRepo.create(document);
    return this.wrapResult(result);
  }

  private async createSecondaryOnly(document: T): Promise<DualWriteResult<T>> {
    const result = await this.secondaryRepo.create(document);
    return this.wrapResult(result);
  }

  private async createDualWrite(document: T): Promise<DualWriteResult<T>> {
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      this.primaryRepo.create(document),
      this.secondaryRepo.create(document)
    ]);

    const primary = primaryResult.status === 'fulfilled' ? primaryResult.value : null;
    const secondary = secondaryResult.status === 'fulfilled' ? secondaryResult.value : null;

    // Both must succeed for dual write
    if (primary?.success && secondary?.success) {
      return {
        success: true,
        data: primary.data,
        primaryResult: primary,
        secondaryResult: secondary
      };
    }

    // Handle partial failure
    let error = 'Dual write failed: ';
    if (!primary?.success) error += `Primary: ${primary?.error || 'Unknown error'}`;
    if (!secondary?.success) error += `${primary?.success ? '' : ', '}Secondary: ${secondary?.error || 'Unknown error'}`;

    return {
      success: false,
      error,
      primaryResult: primary || { success: false, error: 'Primary write rejected' },
      secondaryResult: secondary || { success: false, error: 'Secondary write rejected' }
    };
  }

  private async createDualWriteAsync(document: T): Promise<DualWriteResult<T>> {
    // Write to primary first
    const primaryResult = await this.primaryRepo.create(document);
    
    if (!primaryResult.success) {
      return this.wrapResult(primaryResult);
    }

    // Async write to secondary (don't wait for completion)
    const secondaryPromise = this.retryOperation(
      () => this.secondaryRepo.create(document),
      this.config.maxRetries
    );

    // Set timeout for async operation
    const timeoutPromise = new Promise<RepositoryResult<T>>((_, reject) => {
      setTimeout(() => reject(new Error('Secondary write timeout')), this.config.asyncWriteTimeoutMs);
    });

    // Start async write but don't wait
    Promise.race([secondaryPromise, timeoutPromise])
      .then(secondaryResult => {
        if (!secondaryResult.success && this.config.logInconsistencies) {
          console.error('Async secondary write failed:', secondaryResult.error);
        }
      })
      .catch(error => {
        if (this.config.logInconsistencies) {
          console.error('Async secondary write error:', error.message);
        }
      });

    return {
      success: true,
      data: primaryResult.data,
      primaryResult
    };
  }

  // Private methods for different read strategies

  private async findByIdPrimaryOnly(id: string): Promise<DualWriteResult<T>> {
    const result = await this.primaryRepo.findById(id);
    return this.wrapResult(result);
  }

  private async findByIdSecondaryOnly(id: string): Promise<DualWriteResult<T>> {
    const result = await this.secondaryRepo.findById(id);
    return this.wrapResult(result);
  }

  private async findByIdWithFallback(id: string): Promise<DualWriteResult<T>> {
    const primaryResult = await this.primaryRepo.findById(id);
    
    if (primaryResult.success) {
      return this.wrapResult(primaryResult);
    }

    // Fallback to secondary
    const secondaryResult = await this.secondaryRepo.findById(id);
    return this.wrapResult(secondaryResult);
  }

  private async findByIdWithComparison(id: string): Promise<DualWriteResult<T>> {
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      this.primaryRepo.findById(id),
      this.secondaryRepo.findById(id)
    ]);

    const primary = primaryResult.status === 'fulfilled' ? primaryResult.value : null;
    const secondary = secondaryResult.status === 'fulfilled' ? secondaryResult.value : null;

    // Check for inconsistencies
    let inconsistencyDetected = false;
    let inconsistencyDetails: string[] = [];

    if (primary?.success && secondary?.success && this.config.validateConsistency) {
      const consistencyCheck = this.checkDataConsistency(primary.data, secondary.data);
      inconsistencyDetected = !consistencyCheck.consistent;
      inconsistencyDetails = consistencyCheck.differences;

      if (inconsistencyDetected && this.config.logInconsistencies) {
        console.warn(`Data inconsistency detected for document ${id}:`, inconsistencyDetails);
      }
    }

    // Return primary result
    return {
      success: primary?.success || false,
      data: primary?.data,
      error: primary?.error,
      primaryResult: primary || { success: false, error: 'Primary read failed' },
      secondaryResult: secondary || { success: false, error: 'Secondary read failed' },
      inconsistencyDetected,
      inconsistencyDetails
    };
  }

  // Update methods
  private async updatePrimaryOnly(id: string, updates: Partial<T>): Promise<DualWriteResult<T>> {
    const result = await this.primaryRepo.update(id, updates);
    return this.wrapResult(result);
  }

  private async updateSecondaryOnly(id: string, updates: Partial<T>): Promise<DualWriteResult<T>> {
    const result = await this.secondaryRepo.update(id, updates);
    return this.wrapResult(result);
  }

  private async updateDualWrite(id: string, updates: Partial<T>): Promise<DualWriteResult<T>> {
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      this.primaryRepo.update(id, updates),
      this.secondaryRepo.update(id, updates)
    ]);

    const primary = primaryResult.status === 'fulfilled' ? primaryResult.value : null;
    const secondary = secondaryResult.status === 'fulfilled' ? secondaryResult.value : null;

    if (primary?.success && secondary?.success) {
      return {
        success: true,
        data: primary.data,
        primaryResult: primary,
        secondaryResult: secondary
      };
    }

    return {
      success: false,
      error: `Update failed - Primary: ${primary?.error || 'Unknown'}, Secondary: ${secondary?.error || 'Unknown'}`,
      primaryResult: primary || { success: false, error: 'Primary update rejected' },
      secondaryResult: secondary || { success: false, error: 'Secondary update rejected' }
    };
  }

  private async updateDualWriteAsync(id: string, updates: Partial<T>): Promise<DualWriteResult<T>> {
    const primaryResult = await this.primaryRepo.update(id, updates);
    
    if (!primaryResult.success) {
      return this.wrapResult(primaryResult);
    }

    // Async update to secondary
    this.retryOperation(
      () => this.secondaryRepo.update(id, updates),
      this.config.maxRetries
    ).catch(error => {
      if (this.config.logInconsistencies) {
        console.error(`Async secondary update failed for ${id}:`, error.message);
      }
    });

    return {
      success: true,
      data: primaryResult.data,
      primaryResult
    };
  }

  // Delete methods
  private async deletePrimaryOnly(id: string): Promise<DualWriteResult<boolean>> {
    const result = await this.primaryRepo.delete(id);
    return this.wrapResult(result);
  }

  private async deleteSecondaryOnly(id: string): Promise<DualWriteResult<boolean>> {
    const result = await this.secondaryRepo.delete(id);
    return this.wrapResult(result);
  }

  private async deleteDualWrite(id: string): Promise<DualWriteResult<boolean>> {
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      this.primaryRepo.delete(id),
      this.secondaryRepo.delete(id)
    ]);

    const primary = primaryResult.status === 'fulfilled' ? primaryResult.value : null;
    const secondary = secondaryResult.status === 'fulfilled' ? secondaryResult.value : null;

    if (primary?.success && secondary?.success) {
      return {
        success: true,
        data: true,
        primaryResult: primary,
        secondaryResult: secondary
      };
    }

    return {
      success: false,
      error: `Delete failed - Primary: ${primary?.error || 'Unknown'}, Secondary: ${secondary?.error || 'Unknown'}`,
      primaryResult: primary || { success: false, error: 'Primary delete rejected' },
      secondaryResult: secondary || { success: false, error: 'Secondary delete rejected' }
    };
  }

  private async deleteDualWriteAsync(id: string): Promise<DualWriteResult<boolean>> {
    const primaryResult = await this.primaryRepo.delete(id);
    
    if (!primaryResult.success) {
      return this.wrapResult(primaryResult);
    }

    // Async delete from secondary
    this.retryOperation(
      () => this.secondaryRepo.delete(id),
      this.config.maxRetries
    ).catch(error => {
      if (this.config.logInconsistencies) {
        console.error(`Async secondary delete failed for ${id}:`, error.message);
      }
    });

    return {
      success: true,
      data: true,
      primaryResult
    };
  }

  // Find many methods
  private async findManyPrimaryOnly(query: Record<string, any>, options?: QueryOptions): Promise<DualWriteResult<T[]>> {
    const result = await this.primaryRepo.findMany(query, options);
    return this.wrapResult(result);
  }

  private async findManySecondaryOnly(query: Record<string, any>, options?: QueryOptions): Promise<DualWriteResult<T[]>> {
    const result = await this.secondaryRepo.findMany(query, options);
    return this.wrapResult(result);
  }

  private async findManyWithFallback(query: Record<string, any>, options?: QueryOptions): Promise<DualWriteResult<T[]>> {
    const primaryResult = await this.primaryRepo.findMany(query, options);
    
    if (primaryResult.success) {
      return this.wrapResult(primaryResult);
    }

    const secondaryResult = await this.secondaryRepo.findMany(query, options);
    return this.wrapResult(secondaryResult);
  }

  private async findManyWithComparison(query: Record<string, any>, options?: QueryOptions): Promise<DualWriteResult<T[]>> {
    const [primaryResult, secondaryResult] = await Promise.allSettled([
      this.primaryRepo.findMany(query, options),
      this.secondaryRepo.findMany(query, options)
    ]);

    const primary = primaryResult.status === 'fulfilled' ? primaryResult.value : null;
    const secondary = secondaryResult.status === 'fulfilled' ? secondaryResult.value : null;

    if (primary?.success && secondary?.success && this.config.validateConsistency) {
      const primaryCount = primary.data?.length || 0;
      const secondaryCount = secondary.data?.length || 0;
      
      if (primaryCount !== secondaryCount && this.config.logInconsistencies) {
        console.warn(`Result count inconsistency: Primary=${primaryCount}, Secondary=${secondaryCount}`);
      }
    }

    return this.wrapResult(primary || { success: false, error: 'Primary findMany failed' });
  }

  // Utility methods

  private wrapResult<U>(result: RepositoryResult<U>): DualWriteResult<U> {
    return {
      success: result.success,
      data: result.data,
      error: result.error
    };
  }

  private async retryOperation<U>(
    operation: () => Promise<RepositoryResult<U>>,
    maxRetries: number
  ): Promise<RepositoryResult<U>> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await this.delay(this.config.retryDelayMs * (attempt + 1));
        }
      }
    }
    
    return {
      success: false,
      error: `Operation failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`
    };
  }

  private checkDataConsistency(data1: T | undefined, data2: T | undefined): ConsistencyCheckResult {
    if (!data1 && !data2) {
      return { consistent: true, differences: [] };
    }
    
    if (!data1 || !data2) {
      return {
        consistent: false,
        differences: ['One data source has no data'],
        primaryData: data1,
        secondaryData: data2
      };
    }

    const differences: string[] = [];
    
    // Compare key fields (customize based on document type)
    if (data1.id !== data2.id) differences.push('id mismatch');
    if (data1.userId !== data2.userId) differences.push('userId mismatch');
    if (data1.updatedDate !== data2.updatedDate) differences.push('updatedDate mismatch');
    
    // Add type-specific comparisons for resume documents
    if ('fileName' in data1 && 'fileName' in data2) {
      if ((data1 as any).fileName !== (data2 as any).fileName) {
        differences.push('fileName mismatch');
      }
    }
    
    return {
      consistent: differences.length === 0,
      differences,
      primaryData: data1,
      secondaryData: data2
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Specific dual write decorator for Resume repositories
 */
export class DualWriteResumeRepository extends DualWriteRepositoryDecorator<IResumeDocument> implements IResumeRepository {
  constructor(
    primaryRepo: IResumeRepository,
    secondaryRepo: IResumeRepository,
    config: DualWriteConfig
  ) {
    super(primaryRepo, secondaryRepo, config);
  }

  // Implement IResumeRepository specific methods
  async getResumesByUser(userId: string): Promise<DualWriteResult<IResumeDocument[]>> {
    // For now, delegate to findMany - could be optimized for specific repository methods
    return this.findMany({ userId });
  }

  async getResumesByAtsScore(minScore: number, maxScore: number): Promise<DualWriteResult<IResumeDocument[]>> {
    const query = {
      atsScore: { $gte: minScore, $lte: maxScore }
    };
    return this.findMany(query);
  }

  async searchResumes(searchTerms: string[]): Promise<DualWriteResult<IResumeDocument[]>> {
    // Implementation would depend on specific repository search capabilities
    const query = {
      $or: searchTerms.map(term => ({
        $or: [
          { fileName: { $regex: term, $options: 'i' } },
          { 'skills': { $regex: term, $options: 'i' } }
        ]
      }))
    };
    return this.findMany(query);
  }

  // Batch operations
  async batchCreate(documents: IResumeDocument[]): Promise<DualWriteResult<IResumeDocument[]>> {
    // Simple implementation - could be optimized
    const results: IResumeDocument[] = [];
    const errors: string[] = [];

    for (const doc of documents) {
      const result = await this.create(doc);
      if (result.success && result.data) {
        results.push(result.data);
      } else {
        errors.push(result.error || 'Unknown error');
      }
    }

    return {
      success: errors.length === 0,
      data: results,
      error: errors.length > 0 ? `Batch create had ${errors.length} failures` : undefined
    };
  }

  async getStats(): Promise<DualWriteResult<any>> {
    // Delegate to primary repository for stats
    const primaryRepo = this.primaryRepo as IResumeRepository;
    if ('getStats' in primaryRepo) {
      const result = await primaryRepo.getStats();
      return this.wrapResult(result);
    }
    
    return {
      success: false,
      error: 'Stats not supported by primary repository'
    };
  }
}

/**
 * Specific dual write decorator for Usage repositories
 */
export class DualWriteUsageRepository extends DualWriteRepositoryDecorator<IUsageDocument> implements IUsageRepository {
  constructor(
    primaryRepo: IUsageRepository,
    secondaryRepo: IUsageRepository,
    config: DualWriteConfig
  ) {
    super(primaryRepo, secondaryRepo, config);
  }

  async incrementUsage(userId: string, feature: string, amount: number = 1): Promise<DualWriteResult<IUsageDocument>> {
    // Delegate to specific repository methods
    const primaryRepo = this.primaryRepo as IUsageRepository;
    const secondaryRepo = this.secondaryRepo as IUsageRepository;

    if (this.config.writeStrategy === WriteStrategy.DUAL_WRITE) {
      const [primaryResult, secondaryResult] = await Promise.allSettled([
        primaryRepo.incrementUsage(userId, feature, amount),
        secondaryRepo.incrementUsage(userId, feature, amount)
      ]);

      const primary = primaryResult.status === 'fulfilled' ? primaryResult.value : null;
      const secondary = secondaryResult.status === 'fulfilled' ? secondaryResult.value : null;

      if (primary?.success && secondary?.success) {
        return {
          success: true,
          data: primary.data,
          primaryResult: primary,
          secondaryResult: secondary
        };
      }

      return {
        success: false,
        error: `Increment failed - Primary: ${primary?.error || 'Unknown'}, Secondary: ${secondary?.error || 'Unknown'}`,
        primaryResult: primary || { success: false, error: 'Primary increment rejected' },
        secondaryResult: secondary || { success: false, error: 'Secondary increment rejected' }
      };
    }

    // For other strategies, use primary only for now
    const result = await primaryRepo.incrementUsage(userId, feature, amount);
    return this.wrapResult(result);
  }

  async getUserUsageStats(userId: string, feature?: string): Promise<DualWriteResult<any>> {
    const primaryRepo = this.primaryRepo as IUsageRepository;
    const result = await primaryRepo.getUserUsageStats(userId, feature);
    return this.wrapResult(result);
  }

  async getUsageByDateRange(startDate: Date, endDate: Date): Promise<DualWriteResult<IUsageDocument[]>> {
    const query = {
      date: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString()
      }
    };
    return this.findMany(query);
  }
}