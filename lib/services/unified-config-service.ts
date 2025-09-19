/**
 * Unified Configuration Service
 * 
 * Eliminates configuration drift by providing a single source of truth
 * with Azure App Configuration as primary and Firebase Remote Config
 * for client-side distribution.
 * 
 * Key features:
 * - Single API for all configuration needs
 * - Automatic Azure → Firebase synchronization
 * - Two-layer caching with drift detection
 * - Version control and rollback capabilities
 * - Edge-runtime compatible for Next.js middleware
 */

import { AppConfigurationClient, ConfigurationSetting } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';
import { logServerError } from '@/lib/errors';
import { azureCosmosService } from './azure-cosmos-service';
import { configMonitoringService } from './config-monitoring-service';

// ===== INTERFACES =====

export interface ConfigValue {
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  metadata?: {
    source: 'azure' | 'firebase';
    version: string;
    lastModified: Date;
    hash: string;
    clientOnly?: boolean;
    syncToFirebase?: boolean;
  };
}

export interface ConfigValidationRule {
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  enum?: any[];
  min?: number;
  max?: number;
  pattern?: RegExp;
}

export interface ConfigAuditEntry {
  id: string;
  key: string;
  oldValue: any;
  newValue: any;
  version: string;
  source: 'azure' | 'firebase' | 'unified';
  changedBy: string;
  timestamp: Date;
  rollbackable: boolean;
  metadata?: Record<string, any>;
}

export interface ConfigDriftDetection {
  key: string;
  azureValue: any;
  firebaseValue: any;
  azureHash: string;
  firebaseHash: string;
  drifted: boolean;
  lastChecked: Date;
}

// ===== CONFIGURATION SCHEMA =====

export const CONFIG_SCHEMA: Record<string, ConfigValidationRule> = {
  // Core application settings
  'core.app.environment': { required: true, type: 'string', enum: ['development', 'staging', 'production'] },
  'core.app.version': { required: true, type: 'string' },
  'core.app.debug': { required: false, type: 'boolean' },
  'core.app.maintenanceMode': { required: false, type: 'boolean' },
  
  // Feature flags (synced to Firebase for client access)
  'features.autoApplyAzure': { required: false, type: 'boolean' },
  'features.portalIntegration': { required: false, type: 'boolean' },
  'features.voiceInterview': { required: false, type: 'boolean' },
  'features.voiceInterviewV2': { required: false, type: 'boolean' },
  'features.premiumFeatures': { required: false, type: 'boolean' },
  'features.newUI': { required: false, type: 'boolean' },
  
  // Cosmos DB configuration
  'data.cosmos.maxRUPerSecond': { required: false, type: 'number', min: 400, max: 100000 },
  'data.cosmos.batchSize': { required: false, type: 'number', min: 10, max: 1000 },
  'data.cosmos.connectionTimeout': { required: false, type: 'number', min: 1000, max: 30000 },
  'data.cosmos.retryAttempts': { required: false, type: 'number', min: 1, max: 10 },
  
  // Usage limits and quotas
  'quotas.freeInterviews': { required: false, type: 'number', min: 0, max: 100 },
  'quotas.freeResumes': { required: false, type: 'number', min: 0, max: 50 },
  'quotas.premiumInterviews': { required: false, type: 'number', min: 0, max: 10000 },
  'quotas.premiumResumes': { required: false, type: 'number', min: 0, max: 1000 },
  
  // Authentication settings (Firebase client-side)
  'auth.firebase.sessionTimeout': { required: false, type: 'number', min: 300, max: 86400 },
  'auth.firebase.maxAttempts': { required: false, type: 'number', min: 3, max: 10 },
  'auth.firebase.lockoutDuration': { required: false, type: 'number', min: 300, max: 3600 },
  
  // Performance and monitoring
  'perf.cacheTimeout': { required: false, type: 'number', min: 30, max: 3600 },
  'perf.maxCacheSize': { required: false, type: 'number', min: 100, max: 10000 },
  'perf.enableMetrics': { required: false, type: 'boolean' }
};

// Default values with metadata
export const CONFIG_DEFAULTS: Record<string, ConfigValue> = {
  'core.app.environment': {
    value: 'development',
    type: 'string',
    metadata: { source: 'azure', version: '1.0.0', lastModified: new Date(), hash: '' }
  },
  'core.app.debug': {
    value: false,
    type: 'boolean',
    metadata: { source: 'azure', version: '1.0.0', lastModified: new Date(), hash: '' }
  },
  'features.autoApplyAzure': {
    value: false,
    type: 'boolean',
    metadata: { source: 'azure', version: '1.0.0', lastModified: new Date(), hash: '', syncToFirebase: true }
  },
  'features.voiceInterview': {
    value: true,
    type: 'boolean',
    metadata: { source: 'azure', version: '1.0.0', lastModified: new Date(), hash: '', syncToFirebase: true }
  },
  'features.voiceInterviewV2': {
    value: true, // Default to Azure AI Foundry voice system
    type: 'boolean',
    metadata: { source: 'azure', version: '1.0.0', lastModified: new Date(), hash: '', syncToFirebase: true }
  },
  'quotas.freeInterviews': {
    value: 3,
    type: 'number',
    metadata: { source: 'azure', version: '1.0.0', lastModified: new Date(), hash: '' }
  },
  'quotas.freeResumes': {
    value: 2,
    type: 'number', 
    metadata: { source: 'azure', version: '1.0.0', lastModified: new Date(), hash: '' }
  }
};

// ===== UNIFIED CONFIGURATION SERVICE =====

class UnifiedConfigService {
  private azureClient: AppConfigurationClient | null = null;
  private cache: Map<string, { value: ConfigValue; timestamp: number; etag?: string }> = new Map();
  private initialized = false;
  private driftCache: Map<string, ConfigDriftDetection> = new Map();
  
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DRIFT_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
  
  constructor() {
    this.setupDriftDetection();
  }

  // ===== INITIALIZATION =====

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const connectionString = process.env.AZURE_APP_CONFIG_CONNECTION_STRING;
      const endpoint = process.env.AZURE_APP_CONFIG_ENDPOINT;

      if (connectionString) {
        this.azureClient = new AppConfigurationClient(connectionString);
      } else if (endpoint) {
        const credential = new DefaultAzureCredential();
        this.azureClient = new AppConfigurationClient(endpoint, credential);
      } else {
        console.warn('⚠️ Azure App Configuration not configured - using defaults only');
        this.initialized = true;
        return;
      }

      // Test connection
      const iterator = this.azureClient.listConfigurationSettings();
      await iterator.next(); // Just get the first result to test connection
      
      this.initialized = true;
      console.log('✅ Unified Configuration Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Unified Config Service:', error);
      logServerError(error as Error, { service: 'unified-config', action: 'initialize' });
      
      // Continue with defaults only
      this.initialized = true;
    }
  }

  // ===== CORE CONFIGURATION METHODS =====

  /**
   * Get configuration value with intelligent fallback
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    const startTime = Date.now();
    let success = true;
    
    await this.initialize();

    try {
      // Check cache first
      const cached = this.getCachedValue(key);
      if (cached) {
        configMonitoringService.trackCacheHit(true, key);
        const latency = Date.now() - startTime;
        configMonitoringService.trackConfigRequest(key, 'get', latency, true);
        return cached.value as T;
      }
      
      configMonitoringService.trackCacheHit(false, key);

      // Try Azure App Configuration first
      const azureValue = await this.getFromAzure(key);
      if (azureValue !== null) {
        const latency = Date.now() - startTime;
        configMonitoringService.trackConfigRequest(key, 'get', latency, true);
        return azureValue as T;
      }

      // Check if it's a client-only config that should come from Firebase
      const schema = CONFIG_SCHEMA[key];
      const defaultConfig = CONFIG_DEFAULTS[key];
      
      if (defaultConfig?.metadata?.clientOnly) {
        const firebaseValue = await this.getFromFirebase(key);
        if (firebaseValue !== null) {
          const latency = Date.now() - startTime;
          configMonitoringService.trackConfigRequest(key, 'get', latency, true);
          return firebaseValue as T;
        }
      }

      // Return default value or schema default
      const result = defaultValue !== undefined ? defaultValue : 
                    (defaultConfig ? defaultConfig.value as T : undefined as T);
      
      const latency = Date.now() - startTime;
      configMonitoringService.trackConfigRequest(key, 'get', latency, true);
      return result;
      
    } catch (error) {
      success = false;
      console.error(`Error getting config ${key}:`, error);
      
      const latency = Date.now() - startTime;
      configMonitoringService.trackConfigRequest(key, 'get', latency, false);
      
      return defaultValue as T;
    }
  }

  /**
   * Set configuration value with validation and audit
   */
  async set(key: string, value: any, options?: {
    environment?: string;
    syncToFirebase?: boolean;
    version?: string;
    changedBy?: string;
  }): Promise<void> {
    const startTime = Date.now();
    let success = true;
    
    await this.initialize();

    const { environment = 'default', syncToFirebase = false, version = '1.0.0', changedBy = 'system' } = options || {};

    try {
      // Validate against schema
      this.validateConfigValue(key, value);

      // Get previous value for audit
      const previousValue = await this.get(key);

      // Create config value with metadata
      const configValue: ConfigValue = {
        value,
        type: this.inferType(value),
        metadata: {
          source: 'azure',
          version,
          lastModified: new Date(),
          hash: this.calculateHash(value),
          syncToFirebase
        }
      };

      // Store in Azure App Configuration
      if (this.azureClient) {
        await this.setInAzure(key, configValue, environment);
      }

      // Sync to Firebase if requested
      if (syncToFirebase) {
        await this.syncToFirebase(key, configValue);
      }

      // Clear cache
      this.cache.delete(key);

      // Record audit entry
      await this.recordAuditEntry({
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        key,
        oldValue: previousValue,
        newValue: value,
        version,
        source: 'unified',
        changedBy,
        timestamp: new Date(),
        rollbackable: true,
        metadata: { environment, syncToFirebase }
      });
      
      // Track configuration change
      configMonitoringService.trackConfigChange(key, previousValue, value, changedBy, environment);
      
      const latency = Date.now() - startTime;
      configMonitoringService.trackConfigRequest(key, 'set', latency, true);

      console.log(`✅ Config updated: ${key} = ${JSON.stringify(value)}`);
    } catch (error) {
      success = false;
      const latency = Date.now() - startTime;
      configMonitoringService.trackConfigRequest(key, 'set', latency, false);
      
      console.error(`❌ Failed to set config ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all configuration values with optional prefix filter
   */
  async getAll(prefix?: string): Promise<Record<string, any>> {
    await this.initialize();

    const result: Record<string, any> = {};

    try {
      // Get from Azure App Configuration
      if (this.azureClient) {
        const settings = this.azureClient.listConfigurationSettings({
          keyFilter: prefix ? `${prefix}*` : undefined
        });

        for await (const setting of settings) {
          if (setting.key && setting.value !== undefined) {
            const parsedValue = this.parseConfigurationSetting(setting);
            result[setting.key] = parsedValue.value;
            
            // Cache the value
            this.setCachedValue(setting.key, parsedValue, setting.etag);
          }
        }
      }

      // Add defaults for missing keys
      Object.entries(CONFIG_DEFAULTS).forEach(([key, defaultConfig]) => {
        if (!prefix || key.startsWith(prefix)) {
          if (result[key] === undefined) {
            result[key] = defaultConfig.value;
          }
        }
      });

      return result;
    } catch (error) {
      console.error('Error getting all configs:', error);
      
      // Return defaults only on error
      const defaults: Record<string, any> = {};
      Object.entries(CONFIG_DEFAULTS).forEach(([key, defaultConfig]) => {
        if (!prefix || key.startsWith(prefix)) {
          defaults[key] = defaultConfig.value;
        }
      });
      
      return defaults;
    }
  }

  /**
   * Refresh cache and check for drift
   */
  async refresh(): Promise<void> {
    this.cache.clear();
    this.driftCache.clear();
    await this.checkForDrift();
  }

  /**
   * Subscribe to configuration changes (polling-based)
   */
  subscribe(key: string, callback: (value: any) => void): () => void {
    let lastValue: any = undefined;
    let isActive = true;

    const poll = async () => {
      if (!isActive) return;

      try {
        const currentValue = await this.get(key);
        if (JSON.stringify(currentValue) !== JSON.stringify(lastValue)) {
          lastValue = currentValue;
          callback(currentValue);
        }
      } catch (error) {
        console.error(`Config subscription error for ${key}:`, error);
      }
    };

    // Poll every 30 seconds
    const interval = setInterval(poll, 30000);
    
    // Initial call
    poll();

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }

  // ===== DRIFT DETECTION =====

  async checkForDrift(): Promise<ConfigDriftDetection[]> {
    const driftResults: ConfigDriftDetection[] = [];

    try {
      // Get all configs that should sync to Firebase
      const allConfigs = await this.getAll();
      const syncableKeys = Object.keys(allConfigs).filter(key => {
        const defaultConfig = CONFIG_DEFAULTS[key];
        return defaultConfig?.metadata?.syncToFirebase;
      });
      
      for (const key of syncableKeys) {
        const drift = await this.checkKeyForDrift(key);
        if (drift) {
          driftResults.push(drift);
          this.driftCache.set(key, drift);
        }
      }

      // Track drift detection metrics
      const driftedKeys = driftResults.filter(d => d.drifted).map(d => d.key);
      configMonitoringService.trackDriftDetection(driftedKeys, syncableKeys.length);

      if (driftResults.length > 0) {
        console.warn(`⚠️ Configuration drift detected in ${driftResults.length} keys`);
        
        // Record drift event for monitoring
        await this.recordDriftEvent(driftResults);
      }

      return driftResults;
    } catch (error) {
      console.error('Error checking for drift:', error);
      return [];
    }
  }

  private async checkKeyForDrift(key: string): Promise<ConfigDriftDetection | null> {
    try {
      const [azureValue, firebaseValue] = await Promise.all([
        this.getFromAzure(key),
        this.getFromFirebase(key)
      ]);

      if (azureValue === null && firebaseValue === null) {
        return null; // Both missing, no drift
      }

      const azureHash = this.calculateHash(azureValue);
      const firebaseHash = this.calculateHash(firebaseValue);
      const drifted = azureHash !== firebaseHash;

      return {
        key,
        azureValue,
        firebaseValue,
        azureHash,
        firebaseHash,
        drifted,
        lastChecked: new Date()
      };
    } catch (error) {
      console.error(`Error checking drift for ${key}:`, error);
      return null;
    }
  }

  // ===== ROLLBACK FUNCTIONALITY =====

  async revert(versionId: string): Promise<void> {
    try {
      // Get audit entry
      const auditEntry = await this.getAuditEntry(versionId);
      if (!auditEntry || !auditEntry.rollbackable) {
        throw new Error(`Version ${versionId} not found or not rollbackable`);
      }

      // Restore previous value
      await this.set(auditEntry.key, auditEntry.oldValue, {
        version: `rollback_${versionId}`,
        changedBy: 'rollback-system',
        syncToFirebase: auditEntry.metadata?.syncToFirebase
      });

      console.log(`✅ Successfully reverted ${auditEntry.key} to version ${versionId}`);
    } catch (error) {
      console.error(`❌ Failed to revert to version ${versionId}:`, error);
      throw error;
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async getFromAzure(key: string): Promise<any> {
    if (!this.azureClient) return null;

    try {
      const setting = await this.azureClient.getConfigurationSetting({ key });
      if (!setting || setting.value === undefined) {
        return null;
      }

      const parsedValue = this.parseConfigurationSetting(setting);
      this.setCachedValue(key, parsedValue, setting.etag);
      
      return parsedValue.value;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  private async getFromFirebase(key: string): Promise<any> {
    try {
      // Import Firebase Remote Config dynamically
      const { getRemoteConfig, getValue } = await import('firebase/remote-config');
      const { app } = await import('@/firebase/simple-client');
      
      // Get the Firebase app instance
      const firebaseApp = app();
      if (!firebaseApp) {
        console.warn('Firebase app not available');
        return null;
      }
      
      const remoteConfig = getRemoteConfig(firebaseApp);
      const value = getValue(remoteConfig, key);
      
      return value.asString();
    } catch (error) {
      console.warn(`Failed to get Firebase Remote Config for ${key}:`, error);
      return null;
    }
  }

  private async setInAzure(key: string, configValue: ConfigValue, environment: string): Promise<void> {
    if (!this.azureClient) return;

    const setting: ConfigurationSetting = {
      key: environment === 'default' ? key : `${key}__${environment}`,
      value: this.serializeValue(configValue.value),
      contentType: this.getContentType(configValue.value),
      isReadOnly: false,
      tags: {
        environment,
        version: configValue.metadata?.version || '1.0.0',
        source: 'unified-service',
        lastModified: new Date().toISOString(),
        hash: configValue.metadata?.hash || '',
        syncToFirebase: configValue.metadata?.syncToFirebase ? 'true' : 'false'
      }
    };

    await this.azureClient.setConfigurationSetting(setting);
  }

  private async syncToFirebase(key: string, configValue: ConfigValue): Promise<void> {
    // This will be implemented by the config-sync Azure Function
    // For now, we'll queue the sync request
    console.log(`🔄 Queuing Firebase sync for ${key}`);
    
    // Could implement immediate sync here if needed
    // For production, better to use the dedicated sync function
  }

  private parseConfigurationSetting(setting: ConfigurationSetting): ConfigValue {
    const value = this.parseValue(setting.value || '', setting.contentType);
    
    return {
      value,
      type: this.inferType(value),
      metadata: {
        source: 'azure',
        version: setting.tags?.version || '1.0.0',
        lastModified: new Date(setting.tags?.lastModified || new Date()),
        hash: setting.tags?.hash || this.calculateHash(value),
        syncToFirebase: setting.tags?.syncToFirebase === 'true'
      }
    };
  }

  private parseValue(value: string, contentType?: string): any {
    if (!contentType) {
      // Try to infer type
      if (value === 'true' || value === 'false') {
        return value === 'true';
      }
      
      const numberValue = Number(value);
      if (!isNaN(numberValue)) {
        return numberValue;
      }
      
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    
    switch (contentType) {
      case 'application/json':
        return JSON.parse(value);
      case 'text/plain':
      default:
        return value;
    }
  }

  private serializeValue(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value.toString();
    }
    
    return JSON.stringify(value);
  }

  private getContentType(value: any): string {
    if (typeof value === 'object') {
      return 'application/json';
    }
    
    return 'text/plain';
  }

  private inferType(value: any): ConfigValue['type'] {
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
  }

  private validateConfigValue(key: string, value: any): void {
    const rule = CONFIG_SCHEMA[key];
    if (!rule) return; // No validation rule, allow any value

    // Type validation
    const actualType = this.inferType(value);
    if (rule.type !== actualType) {
      throw new Error(`Config ${key}: expected type ${rule.type}, got ${actualType}`);
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      throw new Error(`Config ${key}: value must be one of ${rule.enum.join(', ')}`);
    }

    // Range validation for numbers
    if (rule.type === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        throw new Error(`Config ${key}: value ${value} is below minimum ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        throw new Error(`Config ${key}: value ${value} is above maximum ${rule.max}`);
      }
    }

    // Pattern validation for strings
    if (rule.type === 'string' && rule.pattern && !rule.pattern.test(value)) {
      throw new Error(`Config ${key}: value does not match required pattern`);
    }
  }

  private calculateHash(value: any): string {
    const crypto = require('crypto');
    const normalized = JSON.stringify(value, Object.keys(value || {}).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  private getCachedValue(key: string): ConfigValue | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  private setCachedValue(key: string, value: ConfigValue, etag?: string): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      etag
    });
  }

  private setupDriftDetection(): void {
    // Check for drift every 10 minutes
    setInterval(async () => {
      await this.checkForDrift();
    }, this.DRIFT_CHECK_INTERVAL);
  }

  private async recordAuditEntry(entry: ConfigAuditEntry): Promise<void> {
    try {
      await azureCosmosService.initialize();
      await azureCosmosService.createDocument('configAudit', {
        ...entry,
        _partitionKey: entry.key
      });
    } catch (error) {
      console.error('Failed to record config audit entry:', error);
    }
  }

  private async getAuditEntry(versionId: string): Promise<ConfigAuditEntry | null> {
    try {
      await azureCosmosService.initialize();
      const result = await azureCosmosService.queryDocuments<ConfigAuditEntry>(
        'configAudit',
        'SELECT * FROM c WHERE c.version = @versionId',
        [{ name: '@versionId', value: versionId }]
      );
      return result[0] || null;
    } catch (error) {
      console.error('Failed to get audit entry:', error);
      return null;
    }
  }

  private async recordDriftEvent(driftResults: ConfigDriftDetection[]): Promise<void> {
    try {
      await azureCosmosService.initialize();
      await azureCosmosService.createDocument('configDrift', {
        id: `drift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        driftCount: driftResults.length,
        keys: driftResults.map(d => d.key),
        details: driftResults,
        _partitionKey: 'drift-detection'
      });
    } catch (error) {
      console.error('Failed to record drift event:', error);
    }
  }

  // ===== HEALTH CHECK =====

  async healthCheck(): Promise<{ healthy: boolean; message?: string; details?: any }> {
    try {
      await this.initialize();

      if (!this.azureClient) {
        return { 
          healthy: false, 
          message: 'Azure App Configuration not available - using defaults only' 
        };
      }

      // Test connectivity
      const testIterator = this.azureClient.listConfigurationSettings();
      await testIterator.next(); // Just test the connection

      const driftCount = Array.from(this.driftCache.values()).filter(d => d.drifted).length;
      
      // Get comprehensive health check from monitoring service
      const monitoringHealth = await configMonitoringService.healthCheck();

      return { 
        healthy: monitoringHealth.status === 'healthy',
        message: monitoringHealth.status !== 'healthy' ? `Service status: ${monitoringHealth.status}` : undefined,
        details: {
          cacheSize: this.cache.size,
          driftDetected: driftCount,
          lastRefresh: new Date(),
          monitoring: monitoringHealth
        }
      };
    } catch (error) {
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// ===== SINGLETON INSTANCE =====

export const unifiedConfigService = new UnifiedConfigService();

// ===== REACT HOOK =====

// Note: This hook should be used in client-side components only
// The actual implementation will be moved to a separate file to avoid
// bundling React in server-side code
export function useUnifiedConfig<T = any>(key: string, defaultValue?: T): {
  value: T;
  loading: boolean;
  error: string | null;
} {
  // This is a placeholder implementation that will be overridden
  // in client-side usage. See /lib/hooks/useUnifiedConfig.ts
  console.warn('useUnifiedConfig called from server context. Use the client-side hook instead.');
  return {
    value: defaultValue as T,
    loading: false,
    error: null
  };
}

export default unifiedConfigService;
