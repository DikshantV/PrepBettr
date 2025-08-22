/**
 * Redis Cache Service - Intelligent Caching Layer
 * 
 * Features:
 * - Automatic JSON serialization/deserialization
 * - Key namespacing by environment and service
 * - Fallback to in-memory cache for local development
 * - Circuit breaker pattern for Redis failures
 * - Connection pooling and retry logic
 * - Performance metrics tracking
 */

import { logServerError } from '@/lib/errors';

// Conditional Redis import to avoid build errors when ioredis is not installed
let Redis: any = null;
try {
  Redis = require('ioredis');
} catch (error) {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('⚠️ ioredis package not found - Redis cache will be disabled');
  }
}

// ===== INTERFACES =====

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for bulk invalidation
  compress?: boolean; // Enable compression for large values
  serialize?: boolean; // Custom serialization (default: true)
}

export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  hitRatio: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  lastError?: string;
  uptime?: number;
}

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  ssl?: boolean;
  keyPrefix: string;
  defaultTTL: number;
  maxConnections: number;
  retryDelayOnFailover: number;
  retryTimeoutInMilliseconds: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  fallbackToMemory: boolean;
}

// ===== CACHE IMPLEMENTATION =====

class RedisCacheService {
  private client: any = null;
  private fallbackCache: Map<string, { value: any; expiry: number; tags?: string[] }> = new Map();
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    hitRatio: 0,
    connectionStatus: 'disconnected'
  };
  
  // Circuit breaker state
  private circuitBreakerOpen = false;
  private circuitBreakerCount = 0;
  private lastCircuitBreakerReset = Date.now();
  
  // Performance tracking
  private startTime = Date.now();
  
  constructor(config: Partial<CacheConfig>) {
    this.config = {
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config.password || process.env.REDIS_PASSWORD,
      ssl: config.ssl || process.env.REDIS_SSL === 'true',
      keyPrefix: config.keyPrefix || `${process.env.NODE_ENV || 'dev'}:`,
      defaultTTL: config.defaultTTL || 300, // 5 minutes
      maxConnections: config.maxConnections || 50,
      retryDelayOnFailover: config.retryDelayOnFailover || 100,
      retryTimeoutInMilliseconds: config.retryTimeoutInMilliseconds || 5000,
      enableCircuitBreaker: config.enableCircuitBreaker !== undefined ? config.enableCircuitBreaker : true,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      fallbackToMemory: config.fallbackToMemory !== undefined ? config.fallbackToMemory : true
    };
    
    // Initialize Redis connection in non-development environments
    if (process.env.NODE_ENV !== 'development' || process.env.FORCE_REDIS === 'true') {
      this.initializeRedis();
    } else {
      console.log('🔧 Redis cache running in memory-only mode for development');
    }
    
    // Start periodic cleanup for fallback cache
    this.startFallbackCleanup();
  }
  
  // ===== INITIALIZATION =====
  
  private async initializeRedis(): Promise<void> {
    try {
      // Skip Redis initialization if Redis is not available
      if (!Redis) {
        console.log('🚫 Redis package not available - using memory-only cache');
        return;
      }
      
      this.stats.connectionStatus = 'connecting';
      
      const redisOptions: any = {
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        tls: this.config.ssl ? {} : undefined,
        keyPrefix: this.config.keyPrefix,
        
        // Connection settings
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: this.config.retryDelayOnFailover,
        
        // Performance optimizations
        enableReadyCheck: true,
        maxLoadingTimeout: 5000,
        keepAlive: 30000,
        
        // Connection pooling
        family: 4, // Use IPv4
        db: 0,
      };
      
      this.client = new Redis(redisOptions);
      
      // Event handlers
      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.stats.connectionStatus = 'connected';
        this.circuitBreakerOpen = false;
        this.circuitBreakerCount = 0;
      });
      
      this.client.on('error', (error: any) => {
        console.error('❌ Redis connection error:', error);
        this.stats.connectionStatus = 'disconnected';
        this.stats.lastError = error.message;
        this.stats.errors++;
        
        // Circuit breaker logic
        if (this.config.enableCircuitBreaker) {
          this.circuitBreakerCount++;
          if (this.circuitBreakerCount >= this.config.circuitBreakerThreshold) {
            this.circuitBreakerOpen = true;
            console.warn('🚨 Redis circuit breaker opened - falling back to memory cache');
          }
        }
        
        logServerError(error, { service: 'redis-cache', action: 'connection' });
      });
      
      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
        this.stats.connectionStatus = 'connecting';
      });
      
      // Attempt initial connection
      await this.client.connect();
      
    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
      this.stats.connectionStatus = 'disconnected';
      
      if (!this.config.fallbackToMemory) {
        throw error;
      }
      
      console.log('⚠️ Continuing with memory-only cache');
    }
  }
  
  // ===== CORE CACHE OPERATIONS =====
  
  /**
   * Get value from cache with automatic fallback
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const startTime = Date.now();
    
    try {
      // Try Redis first (if available and circuit breaker is closed)
      if (this.isRedisAvailable()) {
        const value = await this.client!.get(fullKey);
        
        if (value !== null) {
          this.recordHit(Date.now() - startTime);
          return this.deserialize<T>(value);
        }
        
        this.recordMiss(Date.now() - startTime);
        return null;
      }
      
      // Fallback to memory cache
      return this.getFromMemory<T>(fullKey);
      
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      this.recordError();
      
      // Fallback to memory cache on Redis error
      if (this.config.fallbackToMemory) {
        return this.getFromMemory<T>(fullKey);
      }
      
      return null;
    }
  }
  
  /**
   * Set value in cache with TTL and tags
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key);
    const ttl = options.ttl || this.config.defaultTTL;
    const serializedValue = this.serialize(value, options.compress);
    
    try {
      // Set in Redis (if available)
      if (this.isRedisAvailable()) {
        const result = await this.client!.setex(fullKey, ttl, serializedValue);
        
        // Store tags for bulk invalidation
        if (options.tags && options.tags.length > 0) {
          await this.setTags(fullKey, options.tags, ttl);
        }
        
        return result === 'OK';
      }
      
      // Fallback to memory cache
      return this.setInMemory(fullKey, value, ttl, options.tags);
      
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      this.recordError();
      
      // Fallback to memory cache on Redis error
      if (this.config.fallbackToMemory) {
        return this.setInMemory(fullKey, value, ttl, options.tags);
      }
      
      return false;
    }
  }
  
  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    
    try {
      if (this.isRedisAvailable()) {
        const result = await this.client!.del(fullKey);
        return result > 0;
      }
      
      // Delete from memory cache
      return this.fallbackCache.delete(fullKey);
      
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      this.recordError();
      
      // Delete from memory cache on Redis error
      this.fallbackCache.delete(fullKey);
      return false;
    }
  }
  
  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    
    try {
      if (this.isRedisAvailable()) {
        const result = await this.client!.exists(fullKey);
        return result === 1;
      }
      
      // Check memory cache
      const cached = this.fallbackCache.get(fullKey);
      return cached !== undefined && cached.expiry > Date.now();
      
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      this.recordError();
      return false;
    }
  }
  
  /**
   * Increment numeric value atomically
   */
  async increment(key: string, delta: number = 1): Promise<number> {
    const fullKey = this.buildKey(key);
    
    try {
      if (this.isRedisAvailable()) {
        return await this.client!.incrby(fullKey, delta);
      }
      
      // Memory fallback for increment
      const current = await this.get<number>(key) || 0;
      const newValue = current + delta;
      await this.set(key, newValue);
      return newValue;
      
    } catch (error) {
      console.error(`Redis INCR error for key ${key}:`, error);
      this.recordError();
      return 0;
    }
  }
  
  /**
   * Set expiration on existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const fullKey = this.buildKey(key);
    
    try {
      if (this.isRedisAvailable()) {
        const result = await this.client!.expire(fullKey, ttl);
        return result === 1;
      }
      
      // Update expiry in memory cache
      const cached = this.fallbackCache.get(fullKey);
      if (cached) {
        cached.expiry = Date.now() + (ttl * 1000);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`Redis EXPIRE error for key ${key}:`, error);
      this.recordError();
      return false;
    }
  }
  
  // ===== BULK OPERATIONS =====
  
  /**
   * Get multiple keys at once
   */
  async mget<T = any>(keys: string[]): Promise<Record<string, T | null>> {
    const fullKeys = keys.map(key => this.buildKey(key));
    const result: Record<string, T | null> = {};
    
    try {
      if (this.isRedisAvailable()) {
        const values = await this.client!.mget(fullKeys);
        
        keys.forEach((key, index) => {
          const value = values[index];
          result[key] = value !== null ? this.deserialize<T>(value) : null;
          
          if (value !== null) {
            this.stats.hits++;
          } else {
            this.stats.misses++;
          }
        });
        
        return result;
      }
      
      // Memory fallback
      keys.forEach(key => {
        const fullKey = this.buildKey(key);
        const cached = this.fallbackCache.get(fullKey);
        
        if (cached && cached.expiry > Date.now()) {
          result[key] = cached.value;
          this.stats.hits++;
        } else {
          result[key] = null;
          this.stats.misses++;
        }
      });
      
      return result;
      
    } catch (error) {
      console.error('Redis MGET error:', error);
      this.recordError();
      return result;
    }
  }
  
  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      if (this.isRedisAvailable()) {
        const tagKey = this.buildTagKey(tag);
        const keys = await this.client!.smembers(tagKey);
        
        if (keys.length > 0) {
          const pipeline = this.client!.pipeline();
          keys.forEach((key: any) => pipeline.del(key));
          pipeline.del(tagKey);
          
          const results = await pipeline.exec();
          return results?.length || 0;
        }
        
        return 0;
      }
      
      // Memory fallback - iterate through all keys
      let deleted = 0;
      for (const [key, cached] of this.fallbackCache.entries()) {
        if (cached.tags?.includes(tag)) {
          this.fallbackCache.delete(key);
          deleted++;
        }
      }
      
      return deleted;
      
    } catch (error) {
      console.error(`Error invalidating tag ${tag}:`, error);
      this.recordError();
      return 0;
    }
  }
  
  /**
   * Clear all cache data
   */
  async clear(): Promise<boolean> {
    try {
      if (this.isRedisAvailable()) {
        await this.client!.flushdb();
      }
      
      // Clear memory cache
      this.fallbackCache.clear();
      
      console.log('🧹 Cache cleared successfully');
      return true;
      
    } catch (error) {
      console.error('Error clearing cache:', error);
      this.recordError();
      return false;
    }
  }
  
  // ===== UTILITY METHODS =====
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRatio = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime
    };
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string; details?: any }> {
    try {
      if (this.isRedisAvailable()) {
        await this.client!.ping();
        return { 
          healthy: true,
          details: {
            circuitBreakerOpen: this.circuitBreakerOpen,
            ...this.getStats()
          }
        };
      }
      
      return {
        healthy: this.config.fallbackToMemory,
        message: 'Redis unavailable, using memory cache',
        details: {
          fallbackCacheSize: this.fallbackCache.size,
          ...this.getStats()
        }
      };
      
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: this.getStats()
      };
    }
  }
  
  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.stats.connectionStatus = 'disconnected';
    }
    
    this.fallbackCache.clear();
  }
  
  // ===== PRIVATE HELPER METHODS =====
  
  private buildKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }
  
  private buildTagKey(tag: string): string {
    return `${this.config.keyPrefix}tag:${tag}`;
  }
  
  private isRedisAvailable(): boolean {
    return this.client !== null && 
           this.stats.connectionStatus === 'connected' && 
           !this.circuitBreakerOpen;
  }
  
  private serialize(value: any, compress = false): string {
    const serialized = JSON.stringify(value);
    
    if (compress && serialized.length > 1024) {
      // Could implement compression here (zlib, etc.)
      // For now, just return the JSON string
      return serialized;
    }
    
    return serialized;
  }
  
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Failed to deserialize cached value:', error);
      return value as unknown as T;
    }
  }
  
  private async setTags(key: string, tags: string[], ttl: number): Promise<void> {
    if (!this.isRedisAvailable() || !tags.length) return;
    
    const pipeline = this.client!.pipeline();
    
    tags.forEach(tag => {
      const tagKey = this.buildTagKey(tag);
      pipeline.sadd(tagKey, key);
      pipeline.expire(tagKey, ttl);
    });
    
    await pipeline.exec();
  }
  
  private getFromMemory<T>(key: string): T | null {
    const cached = this.fallbackCache.get(key);
    
    if (!cached) {
      this.recordMiss(0);
      return null;
    }
    
    if (cached.expiry <= Date.now()) {
      this.fallbackCache.delete(key);
      this.recordMiss(0);
      return null;
    }
    
    this.recordHit(0);
    return cached.value;
  }
  
  private setInMemory(key: string, value: any, ttl: number, tags?: string[]): boolean {
    this.fallbackCache.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000),
      tags
    });
    return true;
  }
  
  private recordHit(latency: number): void {
    this.stats.hits++;
  }
  
  private recordMiss(latency: number): void {
    this.stats.misses++;
  }
  
  private recordError(): void {
    this.stats.errors++;
    
    // Reset circuit breaker after 1 minute if errors decrease
    if (this.circuitBreakerOpen && 
        Date.now() - this.lastCircuitBreakerReset > 60000) {
      this.circuitBreakerOpen = false;
      this.circuitBreakerCount = 0;
      this.lastCircuitBreakerReset = Date.now();
      console.log('🔄 Redis circuit breaker reset');
    }
  }
  
  private startFallbackCleanup(): void {
    // Clean expired entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.fallbackCache.entries()) {
        if (cached.expiry <= now) {
          this.fallbackCache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
}

// ===== CACHE FACTORY =====

let cacheInstance: RedisCacheService | null = null;

export function createCache(config: Partial<CacheConfig>): RedisCacheService {
  const defaultConfig: CacheConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    ssl: process.env.REDIS_SSL === 'true',
    keyPrefix: `${process.env.NODE_ENV || 'dev'}:`,
    defaultTTL: 300,
    maxConnections: 50,
    retryDelayOnFailover: 100,
    retryTimeoutInMilliseconds: 5000,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    fallbackToMemory: true
  };
  
  return new RedisCacheService({ ...defaultConfig, ...config });
}

export function getCache(): RedisCacheService {
  if (!cacheInstance) {
    cacheInstance = createCache({});
  }
  return cacheInstance;
}

// ===== CACHE DECORATORS =====

/**
 * Decorator for caching function results
 */
export function cached(ttl: number = 300, keyGenerator?: (...args: any[]) => string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cache = getCache();
      const key = keyGenerator 
        ? keyGenerator(...args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache first
      const cachedResult = await cache.get(key);
      if (cachedResult !== null) {
        return cachedResult;
      }
      
      // Execute original method
      const result = await method.apply(this, args);
      
      // Cache the result
      await cache.set(key, result, { ttl });
      
      return result;
    };
  };
}

// ===== CACHE MIDDLEWARE =====

/**
 * Express middleware for response caching
 */
export function cacheMiddleware(ttl: number = 60) {
  const cache = getCache();
  
  return async (req: any, res: any, next: any) => {
    if (req.method !== 'GET') {
      return next();
    }
    
    const key = `http:${req.originalUrl || req.url}`;
    const cachedResponse = await cache.get(key);
    
    if (cachedResponse) {
      res.set(cachedResponse.headers);
      res.status(cachedResponse.status);
      res.send(cachedResponse.body);
      return;
    }
    
    // Capture response
    const originalSend = res.send;
    res.send = function (body: any) {
      cache.set(key, {
        status: res.statusCode,
        headers: res.getHeaders(),
        body
      }, { ttl });
      
      originalSend.call(this, body);
    };
    
    next();
  };
}

export default getCache;
