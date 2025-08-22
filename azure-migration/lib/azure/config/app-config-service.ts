/**
 * Azure App Configuration Service Implementation
 * 
 * Replaces Firebase Remote Config with Azure App Configuration
 * Implements IConfigService interface for provider-agnostic usage
 */

import { AppConfigurationClient, ConfigurationSetting } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';
import { IConfigService } from '../../shared/interfaces';
import { BaseConfigService } from '../../shared/interfaces/base-services';
import { getConfigManager } from '../../config/unified-config';

export class AzureAppConfigService extends BaseConfigService {
  private client?: AppConfigurationClient;
  private subscribers: Map<string, Array<(value: any) => void>> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    super('azure');
  }
  
  /**
   * Initialize Azure App Configuration client
   */
  protected async initialize(): Promise<void> {
    try {
      const configManager = await getConfigManager();
      const appConfigConfig = configManager.getServiceConfig('appConfiguration', 'azure');
      
      if (!appConfigConfig.enabled) {
        throw new Error('Azure App Configuration service is not enabled');
      }
      
      const { endpoint, connectionString } = appConfigConfig.config;
      
      if (connectionString) {
        // Use connection string
        this.client = new AppConfigurationClient(connectionString);
      } else if (endpoint) {
        // Use managed identity
        const credential = new DefaultAzureCredential();
        this.client = new AppConfigurationClient(endpoint, credential);
      } else {
        throw new Error('Azure App Configuration endpoint or connection string required');
      }
      
      // Test connection
      await this.client.listConfigurationSettings({ keyFilter: '__test__' }).next();
      
      this.logSuccess('initialize', { endpoint: endpoint || '***' });
    } catch (error) {
      this.handleError(error, 'initialize');
    }
  }
  
  /**
   * Get configuration value
   */
  async get(key: string, defaultValue?: any): Promise<any> {
    try {
      await this.ensureInitialized();
      
      // Check cache first
      const cachedValue = this.getCachedValue(key);
      if (cachedValue !== null) {
        return cachedValue;
      }
      
      if (!this.client) {
        throw new Error('App Configuration client not initialized');
      }
      
      const setting = await this.client.getConfigurationSetting({ key });
      
      if (!setting || setting.value === undefined) {
        return defaultValue;
      }
      
      // Parse value based on content type or inferred type
      const parsedValue = this.parseValue(setting.value, setting.contentType);
      
      // Cache the value
      this.setCachedValue(key, parsedValue);
      
      return parsedValue;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return defaultValue;
      }
      this.handleError(error, 'get', { key });
    }
  }
  
  /**
   * Set configuration value
   */
  async set(key: string, value: any, environment?: string, userId?: string): Promise<void> {
    try {
      await this.ensureInitialized();
      
      if (!this.client) {
        throw new Error('App Configuration client not initialized');
      }
      
      const settingValue = this.serializeValue(value);
      const contentType = this.getContentType(value);
      
      const setting: ConfigurationSetting = {
        key: environment ? `${key}__${environment}` : key,
        value: settingValue,
        contentType,
        isReadOnly: false,
        tags: {
          environment: environment || 'default',
          updatedBy: userId || 'system',
          updatedAt: new Date().toISOString(),
        },
      };
      
      await this.client.setConfigurationSetting(setting);
      
      // Clear cache for this key
      this.cache.delete(key);
      
      this.logSuccess('set', { key, environment });
    } catch (error) {
      this.handleError(error, 'set', { key, environment });
    }
  }
  
  /**
   * Get all configuration values with optional prefix filter
   */
  async getAll(prefix?: string): Promise<Record<string, any>> {
    try {
      await this.ensureInitialized();
      
      if (!this.client) {
        throw new Error('App Configuration client not initialized');
      }
      
      const settings: Record<string, any> = {};
      
      const settingsIterable = this.client.listConfigurationSettings({
        keyFilter: prefix ? `${prefix}*` : undefined
      });
      
      for await (const setting of settingsIterable) {
        if (setting.key && setting.value !== undefined) {
          const parsedValue = this.parseValue(setting.value, setting.contentType);
          settings[setting.key] = parsedValue;
          
          // Cache individual values
          this.setCachedValue(setting.key, parsedValue);
        }
      }
      
      this.logSuccess('getAll', { prefix, count: Object.keys(settings).length });
      return settings;
    } catch (error) {
      this.handleError(error, 'getAll', { prefix });
    }
  }
  
  /**
   * Refresh configuration cache
   */
  async refresh(): Promise<void> {
    try {
      this.clearCache();
      
      // Pre-load common configuration values
      await this.getAll();
      
      this.logSuccess('refresh');
    } catch (error) {
      this.handleError(error, 'refresh');
    }
  }
  
  /**
   * Subscribe to configuration changes (using polling)
   */
  subscribe(key: string, callback: (value: any) => void): () => void {
    // Add callback to subscribers
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key)!.push(callback);
    
    // Start polling if not already polling for this key
    if (!this.pollingIntervals.has(key)) {
      this.startPolling(key);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
        
        // Stop polling if no more subscribers
        if (callbacks.length === 0) {
          this.stopPolling(key);
        }
      }
    };
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.ensureInitialized();
      
      if (!this.client) {
        return { healthy: false, message: 'App Configuration client not initialized' };
      }
      
      // Test connectivity by listing a single setting
      const iterator = this.client.listConfigurationSettings();
      await iterator.next();
      
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  // ===== PRIVATE HELPER METHODS =====
  
  /**
   * Parse configuration value based on content type
   */
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
      
      // Try to parse as JSON
      try {
        return JSON.parse(value);
      } catch {
        return value; // Return as string
      }
    }
    
    switch (contentType) {
      case 'application/json':
        try {
          return JSON.parse(value);
        } catch {
          throw new Error(`Invalid JSON value: ${value}`);
        }
      case 'text/plain':
      default:
        return value;
    }
  }
  
  /**
   * Serialize value for storage
   */
  private serializeValue(value: any): string {
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value.toString();
    }
    
    return JSON.stringify(value);
  }
  
  /**
   * Get appropriate content type for value
   */
  private getContentType(value: any): string {
    if (typeof value === 'object') {
      return 'application/json';
    }
    
    return 'text/plain';
  }
  
  /**
   * Start polling for configuration changes
   */
  private startPolling(key: string): void {
    let lastValue: any = undefined;
    let lastEtag: string | undefined;
    
    const poll = async () => {
      try {
        if (!this.client) return;
        
        const setting = await this.client.getConfigurationSetting({ key });
        
        // Check if setting changed (using etag)
        if (setting.etag !== lastEtag) {
          lastEtag = setting.etag;
          const currentValue = setting.value ? this.parseValue(setting.value, setting.contentType) : undefined;
          
          if (JSON.stringify(currentValue) !== JSON.stringify(lastValue)) {
            lastValue = currentValue;
            
            // Notify all subscribers
            const callbacks = this.subscribers.get(key);
            if (callbacks) {
              callbacks.forEach(callback => {
                try {
                  callback(currentValue);
                } catch (error) {
                  console.error(`Error in config subscription callback for ${key}:`, error);
                }
              });
            }
          }
        }
      } catch (error) {
        console.error(`Config polling error for ${key}:`, error);
      }
    };
    
    // Poll every 30 seconds
    const interval = setInterval(poll, 30000);
    this.pollingIntervals.set(key, interval);
    
    // Initial poll
    poll();
  }
  
  /**
   * Stop polling for configuration changes
   */
  private stopPolling(key: string): void {
    const interval = this.pollingIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(key);
    }
    this.subscribers.delete(key);
  }
}

// ===== APP CONFIG MIGRATION UTILITIES =====

export class AppConfigMigrationUtils {
  /**
   * Migrate Firebase Remote Config to Azure App Configuration
   */
  static async migrateRemoteConfig(
    firebaseConfig: IConfigService,
    azureAppConfig: AzureAppConfigService,
    options: {
      keyPrefix?: string;
      environment?: string;
      dryRun?: boolean;
    } = {}
  ): Promise<{ success: boolean; migrated: number; errors: string[] }> {
    const { keyPrefix, environment = 'production', dryRun = false } = options;
    
    try {
      console.log(`📦 Starting Remote Config migration (dryRun: ${dryRun})`);
      
      // Get all configuration from Firebase Remote Config
      const firebaseConfigs = await firebaseConfig.getAll(keyPrefix);
      const configKeys = Object.keys(firebaseConfigs);
      let processed = 0;
      const errors: string[] = [];
      
      console.log(`📊 Found ${configKeys.length} configuration keys to migrate`);
      
      if (dryRun) {
        console.log(`🧪 DRY RUN: Would migrate ${configKeys.length} configuration keys`);
        return { success: true, migrated: 0, errors: [] };
      }
      
      // Migrate each configuration key
      for (const key of configKeys) {
        try {
          const value = firebaseConfigs[key];
          await azureAppConfig.set(key, value, environment);
          processed++;
          
          if (processed % 10 === 0) {
            console.log(`📈 Progress: ${processed}/${configKeys.length} configs migrated`);
          }
        } catch (error) {
          const errorMsg = `Config ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ Config migration error:`, errorMsg);
        }
      }
      
      const success = errors.length === 0;
      console.log(`${success ? '✅' : '⚠️'} Config migration completed: ${processed}/${configKeys.length} configs migrated, ${errors.length} errors`);
      
      return { success, migrated: processed, errors };
    } catch (error) {
      console.error(`❌ Remote Config migration failed:`, error);
      return { 
        success: false, 
        migrated: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }
  
  /**
   * Validate configuration migration
   */
  static async validateMigration(
    firebaseConfig: IConfigService,
    azureAppConfig: AzureAppConfigService,
    sampleKeys: string[] = []
  ): Promise<{ valid: boolean; details: Record<string, any> }> {
    try {
      const [firebaseConfigs, azureConfigs] = await Promise.all([
        firebaseConfig.getAll(),
        azureAppConfig.getAll()
      ]);
      
      const firebaseKeyCount = Object.keys(firebaseConfigs).length;
      const azureKeyCount = Object.keys(azureConfigs).length;
      
      // Sample key comparison
      const keysToCheck = sampleKeys.length > 0 ? sampleKeys : Object.keys(firebaseConfigs).slice(0, 10);
      const keyComparisons: any[] = [];
      
      for (const key of keysToCheck) {
        const firebaseValue = firebaseConfigs[key];
        const azureValue = azureConfigs[key];
        
        if (firebaseValue === undefined && azureValue === undefined) {
          keyComparisons.push({ key, status: 'both_missing' });
        } else if (firebaseValue === undefined) {
          keyComparisons.push({ key, status: 'only_in_azure' });
        } else if (azureValue === undefined) {
          keyComparisons.push({ key, status: 'missing_in_azure' });
        } else {
          const valuesMatch = JSON.stringify(firebaseValue) === JSON.stringify(azureValue);
          keyComparisons.push({
            key,
            status: valuesMatch ? 'match' : 'value_mismatch',
            firebase_type: typeof firebaseValue,
            azure_type: typeof azureValue
          });
        }
      }
      
      const allSamplesMatch = keyComparisons.every(c => c.status === 'match');
      
      return {
        valid: allSamplesMatch,
        details: {
          counts: { firebase: firebaseKeyCount, azure: azureKeyCount },
          keyComparisons,
          sampleSize: keyComparisons.length
        }
      };
    } catch (error) {
      return {
        valid: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// ===== FIREBASE REMOTE CONFIG ADAPTER =====

/**
 * Adapter to wrap existing Firebase Remote Config as IConfigService
 * This enables gradual migration without changing existing code
 */
export class FirebaseRemoteConfigAdapter extends BaseConfigService {
  private remoteConfigValues: Map<string, any> = new Map();
  
  constructor() {
    super('firebase');
  }
  
  /**
   * Initialize Firebase Remote Config
   */
  protected async initialize(): Promise<void> {
    try {
      // Import Firebase Remote Config dynamically to avoid issues if not available
      const { getRemoteConfig, fetchAndActivate, getAll } = await import('firebase/remote-config');
      const { app } = await import('@/firebase/client');
      
      if (!app) {
        throw new Error('Firebase app not initialized');
      }
      
      const remoteConfig = getRemoteConfig(app);
      remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour
      
      // Fetch and activate
      await fetchAndActivate(remoteConfig);
      
      // Load all values into cache
      const allValues = getAll(remoteConfig);
      Object.entries(allValues).forEach(([key, configValue]) => {
        this.remoteConfigValues.set(key, configValue.asString());
      });
      
      this.logSuccess('initialize', { valueCount: this.remoteConfigValues.size });
    } catch (error) {
      this.handleError(error, 'initialize');
    }
  }
  
  /**
   * Get configuration value from Firebase Remote Config
   */
  async get(key: string, defaultValue?: any): Promise<any> {
    try {
      await this.ensureInitialized();
      
      const value = this.remoteConfigValues.get(key);
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      console.warn(`Failed to get Remote Config value for ${key}, using default:`, error);
      return defaultValue;
    }
  }
  
  /**
   * Set not supported in Firebase Remote Config (read-only)
   */
  async set(key: string, value: any, environment?: string): Promise<void> {
    throw new Error('Firebase Remote Config is read-only. Use Firebase Console to update values.');
  }
  
  /**
   * Get all configuration values
   */
  async getAll(prefix?: string): Promise<Record<string, any>> {
    await this.ensureInitialized();
    
    const result: Record<string, any> = {};
    
    this.remoteConfigValues.forEach((value, key) => {
      if (!prefix || key.startsWith(prefix)) {
        result[key] = value;
      }
    });
    
    return result;
  }
  
  /**
   * Refresh configuration from Firebase
   */
  async refresh(): Promise<void> {
    try {
      await this.initialize();
    } catch (error) {
      this.handleError(error, 'refresh');
    }
  }
  
  /**
   * Subscribe to changes (Firebase Remote Config doesn't support real-time)
   */
  subscribe(key: string, callback: (value: any) => void): () => void {
    console.warn('Firebase Remote Config does not support real-time subscriptions');
    
    // Return a no-op unsubscribe function
    return () => {};
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.ensureInitialized();
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
