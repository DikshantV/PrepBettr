/**
 * Abstract Base Classes for Service Implementations
 * 
 * Provides common patterns and utilities for both Firebase and Azure service implementations
 */

import { 
  IAuthService, 
  IStorageService, 
  IDocumentService, 
  IConfigService,
  AuthVerificationResult,
  StorageFile,
  UploadResult,
  UploadOptions,
  DatabaseDocument,
  QueryOptions
} from './index';
import { getConfigManager, getMigrationStateManager } from '../../config/unified-config';

// ===== BASE SERVICE CLASS =====

export abstract class BaseService {
  protected serviceName: string;
  protected provider: 'firebase' | 'azure';
  protected initialized: boolean = false;
  protected initializationPromise?: Promise<void>;
  
  constructor(serviceName: string, provider: 'firebase' | 'azure') {
    this.serviceName = serviceName;
    this.provider = provider;
  }
  
  /**
   * Ensure service is initialized before use
   */
  protected async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }
    
    this.initializationPromise = this.initialize();
    await this.initializationPromise;
    this.initialized = true;
  }
  
  /**
   * Initialize the service - must be implemented by concrete classes
   */
  protected abstract initialize(): Promise<void>;
  
  /**
   * Health check for the service
   */
  abstract healthCheck(): Promise<{ healthy: boolean; message?: string }>;
  
  /**
   * Get service metrics for monitoring
   */
  getMetrics(): Record<string, any> {
    return {
      serviceName: this.serviceName,
      provider: this.provider,
      initialized: this.initialized,
      lastHealthCheck: new Date().toISOString()
    };
  }
  
  /**
   * Common error handling with logging
   */
  protected handleError(error: unknown, operation: string, metadata?: Record<string, any>): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`❌ ${this.serviceName} (${this.provider}) - ${operation} failed:`, {
      error: errorMessage,
      service: this.serviceName,
      provider: this.provider,
      operation,
      metadata
    });
    
    throw error;
  }
  
  /**
   * Common success logging
   */
  protected logSuccess(operation: string, metadata?: Record<string, any>): void {
    console.log(`✅ ${this.serviceName} (${this.provider}) - ${operation} succeeded`, metadata);
  }
}

// ===== ABSTRACT AUTH SERVICE =====

export abstract class BaseAuthService extends BaseService implements IAuthService {
  constructor(provider: 'firebase' | 'azure') {
    super('auth', provider);
  }
  
  abstract verifyToken(token: string): Promise<AuthVerificationResult>;
  abstract createUser(userData: any): Promise<any>;
  abstract updateUser(uid: string, userData: any): Promise<void>;
  abstract deleteUser(uid: string): Promise<void>;
  abstract getUser(uid: string): Promise<any>;
  abstract setCustomClaims(uid: string, claims: Record<string, any>): Promise<void>;
  
  /**
   * Common token validation logic
   */
  protected validateToken(token: string): void {
    if (!token || token.trim().length === 0) {
      throw new Error('Token is required');
    }
    
    if (token.length < 10) {
      throw new Error('Token appears invalid');
    }
  }
  
  /**
   * Standard user data validation
   */
  protected validateUserData(userData: any): void {
    if (userData.email && !this.isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }
  }
  
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// ===== ABSTRACT STORAGE SERVICE =====

export abstract class BaseStorageService extends BaseService implements IStorageService {
  protected readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  protected readonly allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  constructor(provider: 'firebase' | 'azure') {
    super('storage', provider);
  }
  
  abstract upload(container: string, fileName: string, fileBuffer: Buffer, mimeType: string, options?: UploadOptions): Promise<UploadResult>;
  abstract download(container: string, fileName: string): Promise<Buffer>;
  abstract delete(container: string, fileName: string): Promise<void>;
  abstract generateSignedUrl(container: string, fileName: string, expiryHours?: number): Promise<string>;
  abstract listFiles(container: string, prefix?: string): Promise<StorageFile[]>;
  abstract getFileMetadata(container: string, fileName: string): Promise<StorageFile>;
  
  /**
   * Validate file before upload
   */
  protected validateFile(fileBuffer: Buffer, fileName: string, mimeType: string): void {
    // Size validation
    if (fileBuffer.length > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
    }
    
    // MIME type validation
    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }
    
    // File name validation
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
      throw new Error('File name contains invalid characters');
    }
  }
  
  /**
   * Generate safe file path
   */
  protected generateSafeFilePath(userId: string, fileName: string): string {
    const timestamp = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${userId}/${timestamp}-${safeFileName}`;
  }
}

// ===== ABSTRACT DATABASE SERVICE =====

export abstract class BaseDocumentService extends BaseService implements IDocumentService {
  constructor(provider: 'firebase' | 'azure') {
    super('database', provider);
  }
  
  abstract get(collection: string, documentId: string): Promise<DatabaseDocument | null>;
  abstract create(collection: string, data: Record<string, any>, documentId?: string): Promise<string>;
  abstract update(collection: string, documentId: string, data: Record<string, any>): Promise<void>;
  abstract delete(collection: string, documentId: string): Promise<void>;
  abstract query(collection: string, options?: QueryOptions): Promise<DatabaseDocument[]>;
  abstract subscribe(collection: string, documentId: string, callback: (doc: DatabaseDocument | null) => void): () => void;
  abstract subscribeToQuery(collection: string, options: QueryOptions, callback: (docs: DatabaseDocument[]) => void): () => void;
  
  /**
   * Validate collection and document names
   */
  protected validateNames(collection: string, documentId?: string): void {
    if (!collection || collection.trim().length === 0) {
      throw new Error('Collection name is required');
    }
    
    if (documentId && documentId.trim().length === 0) {
      throw new Error('Document ID cannot be empty');
    }
    
    // Check for invalid characters
    const invalidChars = /[^\w\-\.]/;
    if (invalidChars.test(collection)) {
      throw new Error('Collection name contains invalid characters');
    }
    
    if (documentId && invalidChars.test(documentId)) {
      throw new Error('Document ID contains invalid characters');
    }
  }
  
  /**
   * Add common metadata to documents
   */
  protected addMetadata(data: Record<string, any>, isUpdate: boolean = false): Record<string, any> {
    const now = new Date();
    
    if (isUpdate) {
      return {
        ...data,
        updatedAt: now
      };
    }
    
    return {
      ...data,
      createdAt: now,
      updatedAt: now
    };
  }
  
  /**
   * Convert provider-specific document to standard format
   */
  protected abstract convertToStandardDocument(providerDoc: any): DatabaseDocument;
}

// ===== ABSTRACT CONFIG SERVICE =====

export abstract class BaseConfigService extends BaseService implements IConfigService {
  protected cache: Map<string, { value: any; expiry: Date }> = new Map();
  protected readonly cacheExpiryMinutes = 15;
  
  constructor(provider: 'firebase' | 'azure') {
    super('config', provider);
  }
  
  abstract get(key: string, defaultValue?: any): Promise<any>;
  abstract set(key: string, value: any, environment?: string): Promise<void>;
  abstract getAll(prefix?: string): Promise<Record<string, any>>;
  abstract refresh(): Promise<void>;
  abstract subscribe(key: string, callback: (value: any) => void): () => void;
  
  /**
   * Get value from cache if available and not expired
   */
  protected getCachedValue(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > new Date()) {
      return cached.value;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }
  
  /**
   * Store value in cache
   */
  protected setCachedValue(key: string, value: any): void {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + this.cacheExpiryMinutes);
    
    this.cache.set(key, { value, expiry });
  }
  
  /**
   * Clear all cached values
   */
  protected clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Parse configuration value based on type
   */
  protected parseConfigValue(value: string, type: 'string' | 'number' | 'boolean' | 'json'): any {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          throw new Error(`Invalid JSON value for config: ${value}`);
        }
      default:
        return value;
    }
  }
}

// ===== SERVICE FACTORY BASE =====

export abstract class BaseServiceFactory {
  protected services: Map<string, any> = new Map();
  
  /**
   * Get or create service instance
   */
  protected getOrCreateService<T>(key: string, factory: () => T): T {
    if (!this.services.has(key)) {
      this.services.set(key, factory());
    }
    return this.services.get(key);
  }
  
  /**
   * Clear all service instances (useful for testing)
   */
  clearServices(): void {
    this.services.clear();
  }
  
  /**
   * Health check all services
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [key, service] of this.services.entries()) {
      if (service && typeof service.healthCheck === 'function') {
        try {
          const health = await service.healthCheck();
          results[key] = health.healthy;
        } catch (error) {
          results[key] = false;
        }
      }
    }
    
    return results;
  }
}

// ===== MIGRATION UTILITIES =====

export class MigrationUtilities {
  /**
   * Compare data between providers for validation
   */
  static async compareData(
    sourceService: IDocumentService,
    targetService: IDocumentService,
    collection: string,
    documentId: string
  ): Promise<{ matches: boolean; differences: string[] }> {
    try {
      const [sourceDoc, targetDoc] = await Promise.all([
        sourceService.get(collection, documentId),
        targetService.get(collection, documentId)
      ]);
      
      if (!sourceDoc && !targetDoc) {
        return { matches: true, differences: [] };
      }
      
      if (!sourceDoc || !targetDoc) {
        return { 
          matches: false, 
          differences: [`Document exists in ${sourceDoc ? 'source' : 'target'} but not ${sourceDoc ? 'target' : 'source'}`]
        };
      }
      
      // Compare data (excluding timestamps and provider-specific fields)
      const differences = this.findDataDifferences(sourceDoc.data, targetDoc.data);
      
      return {
        matches: differences.length === 0,
        differences
      };
    } catch (error) {
      return {
        matches: false,
        differences: [`Comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
  
  private static findDataDifferences(source: any, target: any, path: string = ''): string[] {
    const differences: string[] = [];
    
    // Handle different types
    if (typeof source !== typeof target) {
      differences.push(`${path}: type mismatch (${typeof source} vs ${typeof target})`);
      return differences;
    }
    
    if (source === null || target === null) {
      if (source !== target) {
        differences.push(`${path}: null mismatch`);
      }
      return differences;
    }
    
    if (typeof source === 'object') {
      // Compare object properties
      const sourceKeys = Object.keys(source);
      const targetKeys = Object.keys(target);
      
      // Check for missing keys
      for (const key of sourceKeys) {
        if (!targetKeys.includes(key)) {
          differences.push(`${path}.${key}: missing in target`);
        } else {
          differences.push(...this.findDataDifferences(source[key], target[key], `${path}.${key}`));
        }
      }
      
      // Check for extra keys
      for (const key of targetKeys) {
        if (!sourceKeys.includes(key)) {
          differences.push(`${path}.${key}: extra in target`);
        }
      }
    } else if (source !== target) {
      differences.push(`${path}: value mismatch (${source} vs ${target})`);
    }
    
    return differences;
  }
  
  /**
   * Batch migrate documents with progress tracking
   */
  static async batchMigrateDocuments(
    sourceService: IDocumentService,
    targetService: IDocumentService,
    collection: string,
    batchSize: number = 50,
    onProgress?: (processed: number, total: number) => void
  ): Promise<{ migrated: number; errors: string[] }> {
    try {
      // Get all documents from source
      const documents = await sourceService.query(collection);
      const total = documents.length;
      let processed = 0;
      const errors: string[] = [];
      
      // Process in batches
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (doc) => {
          try {
            await targetService.create(collection, doc.data, doc.id);
            processed++;
          } catch (error) {
            errors.push(`Document ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });
        
        await Promise.all(batchPromises);
        
        if (onProgress) {
          onProgress(processed, total);
        }
      }
      
      return { migrated: processed, errors };
    } catch (error) {
      throw new Error(`Batch migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ===== PROVIDER SELECTION UTILITIES =====

export class ProviderSelector {
  /**
   * Select appropriate provider based on configuration and feature flags
   */
  static async selectProvider(
    serviceName: string,
    userId?: string,
    operation?: string
  ): Promise<'firebase' | 'azure'> {
    try {
      const configManager = await getConfigManager();
      const provider = await configManager.getProvider(serviceName, userId);
      
      // Log provider selection for monitoring
      console.debug(`🎯 Provider selected for ${serviceName}:`, {
        provider,
        userId: userId ? `${userId.substring(0, 8)}...` : 'anonymous',
        operation
      });
      
      return provider;
    } catch (error) {
      console.warn('⚠️ Provider selection failed, defaulting to Firebase:', error);
      return 'firebase';
    }
  }
  
  /**
   * Get fallback provider if primary provider fails
   */
  static async getFallbackProvider(
    primaryProvider: 'firebase' | 'azure',
    serviceName: string
  ): Promise<'firebase' | 'azure' | null> {
    try {
      const configManager = await getConfigManager();
      const serviceConfig = configManager.getServiceConfig(serviceName as any, primaryProvider);
      
      return serviceConfig.fallbackProvider || null;
    } catch (error) {
      console.warn('⚠️ Could not determine fallback provider:', error);
      return primaryProvider === 'azure' ? 'firebase' : null;
    }
  }
}

// ===== CIRCUIT BREAKER PATTERN =====

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailTime?: Date;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private maxFailures: number = 5,
    private resetTimeoutMs: number = 60000 // 1 minute
  ) {}
  
  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailTime = new Date();
    
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
    }
  }
  
  private shouldAttemptReset(): boolean {
    return this.lastFailTime !== undefined && 
           (Date.now() - this.lastFailTime.getTime()) > this.resetTimeoutMs;
  }
  
  getState(): { state: string; failures: number; lastFailTime?: Date } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailTime: this.lastFailTime
    };
  }
}

// ===== RETRY UTILITIES =====

export class RetryUtilities {
  /**
   * Retry operation with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxAttempts) {
          break;
        }
        
        // Exponential backoff delay
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      }
    }
    
    throw lastError || new Error('Retry failed');
  }
}
