/**
 * Standard result interface for all repository operations
 * Provides consistent error handling and data return patterns
 */

// Base result interface
export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    [key: string]: any;
  };
}

// Extended result interface with pagination support
interface PaginatedRepositoryResult<T> extends RepositoryResult<T[]> {
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrevious: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

// Result interface for batch operations
interface BatchRepositoryResult<T> extends RepositoryResult<T[]> {
  batchMetadata?: {
    totalRequested: number;
    successfulOperations: number;
    failedOperations: number;
    partialSuccess: boolean;
    errors: Array<{
      index: number;
      operation: string;
      error: string;
    }>;
  };
}

// Result interface for dual-write operations
interface DualWriteRepositoryResult<T> extends RepositoryResult<T> {
  primaryResult?: RepositoryResult<T>;
  secondaryResult?: RepositoryResult<T>;
  consistencyCheck?: {
    isConsistent: boolean;
    inconsistencies?: string[];
    checkedFields?: string[];
  };
  writeStrategy?: 'primary-only' | 'secondary-only' | 'dual-write' | 'dual-write-async';
}

// Result interface for migration operations
interface MigrationRepositoryResult<T> extends RepositoryResult<T> {
  migrationMetadata?: {
    sourceStore: 'firestore' | 'cosmos';
    targetStore: 'firestore' | 'cosmos';
    documentsProcessed: number;
    documentsSkipped: number;
    processingTimeMs: number;
    retryCount?: number;
    consistencyValidated?: boolean;
  };
}

// Result interface for analytics operations
interface AnalyticsRepositoryResult<T> extends RepositoryResult<T> {
  analyticsMetadata?: {
    calculationTimeMs: number;
    dataRange?: {
      startDate: string;
      endDate: string;
    };
    sampleSize?: number;
    filters?: string[];
    aggregations?: string[];
  };
}

// Result interface for health check operations
interface HealthCheckRepositoryResult extends RepositoryResult<{
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    [checkName: string]: {
      status: 'pass' | 'fail' | 'warning';
      latency?: number;
      error?: string;
      details?: any;
    };
  };
}> {
  healthMetadata?: {
    checkDurationMs: number;
    timestamp: string;
    environment?: string;
    version?: string;
  };
}

// Utility functions for creating results

/**
 * Create a successful result
 */
function createSuccessResult<T>(
  data: T,
  message?: string,
  metadata?: { [key: string]: any }
): RepositoryResult<T> {
  return {
    success: true,
    data,
    message,
    metadata
  };
}

/**
 * Create a failed result
 */
function createErrorResult<T>(
  error: string,
  data?: T,
  metadata?: { [key: string]: any }
): RepositoryResult<T> {
  return {
    success: false,
    error,
    data,
    metadata
  };
}

/**
 * Create a paginated result
 */
function createPaginatedResult<T>(
  data: T[],
  pagination: PaginatedRepositoryResult<T>['pagination'],
  message?: string
): PaginatedRepositoryResult<T> {
  return {
    success: true,
    data,
    message,
    pagination
  };
}

/**
 * Create a batch result
 */
function createBatchResult<T>(
  data: T[],
  batchMetadata: BatchRepositoryResult<T>['batchMetadata'],
  message?: string
): BatchRepositoryResult<T> {
  return {
    success: batchMetadata ? batchMetadata.failedOperations === 0 : true,
    data,
    message,
    batchMetadata
  };
}

/**
 * Create a dual-write result
 */
function createDualWriteResult<T>(
  data: T,
  primaryResult: RepositoryResult<T>,
  secondaryResult: RepositoryResult<T>,
  consistencyCheck?: DualWriteRepositoryResult<T>['consistencyCheck'],
  writeStrategy?: DualWriteRepositoryResult<T>['writeStrategy']
): DualWriteRepositoryResult<T> {
  const overallSuccess = primaryResult.success && secondaryResult.success;
  
  return {
    success: overallSuccess,
    data,
    message: overallSuccess 
      ? 'Dual write operation completed successfully' 
      : 'Dual write operation completed with errors',
    primaryResult,
    secondaryResult,
    consistencyCheck,
    writeStrategy,
    metadata: {
      primarySuccess: primaryResult.success,
      secondarySuccess: secondaryResult.success,
      consistencyChecked: !!consistencyCheck,
      isConsistent: consistencyCheck?.isConsistent
    }
  };
}

/**
 * Create a migration result
 */
function createMigrationResult<T>(
  data: T,
  migrationMetadata: MigrationRepositoryResult<T>['migrationMetadata'],
  success: boolean = true,
  error?: string
): MigrationRepositoryResult<T> {
  return {
    success,
    data,
    error,
    message: success 
      ? 'Migration operation completed successfully' 
      : 'Migration operation failed',
    migrationMetadata
  };
}

/**
 * Create an analytics result
 */
function createAnalyticsResult<T>(
  data: T,
  analyticsMetadata: AnalyticsRepositoryResult<T>['analyticsMetadata'],
  message?: string
): AnalyticsRepositoryResult<T> {
  return {
    success: true,
    data,
    message: message || 'Analytics calculation completed',
    analyticsMetadata
  };
}

/**
 * Create a health check result
 */
function createHealthCheckResult(
  status: 'healthy' | 'unhealthy' | 'degraded',
  checks: HealthCheckRepositoryResult['data']['checks'],
  healthMetadata?: HealthCheckRepositoryResult['healthMetadata']
): HealthCheckRepositoryResult {
  return {
    success: status !== 'unhealthy',
    data: { status, checks },
    message: `System status: ${status}`,
    healthMetadata
  };
}

/**
 * Transform a result to a different type
 */
function transformResult<T, U>(
  result: RepositoryResult<T>,
  transformer: (data: T) => U
): RepositoryResult<U> {
  if (!result.success || !result.data) {
    return {
      success: result.success,
      error: result.error,
      message: result.message,
      metadata: result.metadata
    };
  }

  try {
    const transformedData = transformer(result.data);
    return {
      success: true,
      data: transformedData,
      message: result.message,
      metadata: result.metadata
    };
  } catch (error) {
    return {
      success: false,
      error: `Transformation failed: ${error.message}`,
      metadata: { ...result.metadata, originalData: result.data }
    };
  }
}

/**
 * Combine multiple results into a single result
 */
function combineResults<T>(
  results: RepositoryResult<T>[],
  combiner?: (data: T[]) => T
): RepositoryResult<T | T[]> {
  const errors: string[] = [];
  const successfulData: T[] = [];
  const allMetadata: any[] = [];

  for (const result of results) {
    if (result.success && result.data) {
      successfulData.push(result.data);
    } else if (result.error) {
      errors.push(result.error);
    }
    
    if (result.metadata) {
      allMetadata.push(result.metadata);
    }
  }

  const allSuccessful = errors.length === 0;
  const hasPartialSuccess = successfulData.length > 0;

  if (!allSuccessful && !hasPartialSuccess) {
    return {
      success: false,
      error: `All operations failed: ${errors.join('; ')}`,
      metadata: { errors, metadata: allMetadata }
    };
  }

  const finalData = combiner ? combiner(successfulData) : successfulData;

  return {
    success: allSuccessful,
    data: finalData as T | T[],
    message: allSuccessful 
      ? 'All operations completed successfully' 
      : `Partial success: ${successfulData.length}/${results.length} operations succeeded`,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    metadata: {
      totalOperations: results.length,
      successfulOperations: successfulData.length,
      failedOperations: errors.length,
      errors,
      combinedMetadata: allMetadata
    }
  };
}

/**
 * Type guard to check if result is successful
 */
function isSuccessfulResult<T>(result: RepositoryResult<T>): result is RepositoryResult<T> & { success: true; data: T } {
  return result.success === true && result.data !== undefined;
}

/**
 * Type guard to check if result is a dual-write result
 */
function isDualWriteResult<T>(result: RepositoryResult<T>): result is DualWriteRepositoryResult<T> {
  return 'primaryResult' in result && 'secondaryResult' in result;
}

/**
 * Type guard to check if result is a batch result
 */
function isBatchResult<T>(result: RepositoryResult<T[]>): result is BatchRepositoryResult<T> {
  return 'batchMetadata' in result;
}

/**
 * Type guard to check if result is a paginated result
 */
function isPaginatedResult<T>(result: RepositoryResult<T[]>): result is PaginatedRepositoryResult<T> {
  return 'pagination' in result;
}