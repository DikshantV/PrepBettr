import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';
import { logServerError } from '@/lib/errors';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  conditions?: {
    userSegment?: string[];
    percentage?: number;
    timeWindow?: {
      start: string;
      end: string;
    };
  };
}

export interface ConfigValue {
  key: string;
  value: string;
  label?: string;
  contentType?: string;
}

class AzureAppConfigService {
  private client: AppConfigurationClient | null = null;
  private cache: Map<string, { value: any; timestamp: number; ttl: number }> = new Map();
  private initialized = false;
  private connectionString: string;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes cache TTL

  constructor() {
    this.connectionString = process.env.AZURE_APP_CONFIG_CONNECTION_STRING || '';
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!this.connectionString) {
        const endpoint = process.env.AZURE_APP_CONFIG_ENDPOINT;
        if (endpoint) {
          // Use managed identity
          this.client = new AppConfigurationClient(endpoint, new DefaultAzureCredential());
          console.log('✅ Azure App Configuration initialized with managed identity');
        } else {
          console.warn('⚠️ Azure App Configuration not configured - no connection string or endpoint provided');
          return;
        }
      } else {
        // Use connection string
        this.client = new AppConfigurationClient(this.connectionString);
        console.log('✅ Azure App Configuration initialized with connection string');
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Azure App Configuration:', error);
      logServerError(error as Error, { service: 'azure-app-config', action: 'initialize' });
      throw error;
    }
  }

  /**
   * Get a configuration value
   */
  async getConfigValue(key: string, label?: string, useCache: boolean = true): Promise<string | null> {
    await this.initialize();

    if (!this.client) {
      console.warn('Azure App Configuration not available');
      return null;
    }

    const cacheKey = `config_${key}_${label || 'default'}`;

    // Check cache first
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < cached.ttl) {
        return cached.value;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    try {
      const setting = await this.client.getConfigurationSetting({ key, label });
      const value = setting.value || null;

      // Cache the result
      if (useCache) {
        this.cache.set(cacheKey, {
          value,
          timestamp: Date.now(),
          ttl: this.defaultTTL
        });
      }

      return value;
    } catch (error) {
      console.error(`Failed to get config value for key ${key}:`, error);
      logServerError(error as Error, { 
        service: 'azure-app-config', 
        action: 'get-config' 
      }, { key, label });
      return null;
    }
  }

  /**
   * Get a configuration value as a specific type
   */
  async getConfigValueAs<T>(
    key: string, 
    defaultValue: T, 
    parser?: (value: string) => T,
    label?: string
  ): Promise<T> {
    const value = await this.getConfigValue(key, label);
    
    if (value === null) {
      return defaultValue;
    }

    try {
      if (parser) {
        return parser(value);
      }

      // Auto-detect type based on default value
      if (typeof defaultValue === 'boolean') {
        return (value.toLowerCase() === 'true' || value === '1') as unknown as T;
      } else if (typeof defaultValue === 'number') {
        const numValue = parseFloat(value);
        return (isNaN(numValue) ? defaultValue : numValue) as unknown as T;
      } else if (typeof defaultValue === 'object') {
        return JSON.parse(value) as T;
      }

      return value as unknown as T;
    } catch (error) {
      console.error(`Failed to parse config value for key ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get multiple configuration values
   */
  async getMultipleConfigValues(keys: string[], label?: string): Promise<Record<string, string | null>> {
    await this.initialize();

    if (!this.client) {
      console.warn('Azure App Configuration not available');
      return keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});
    }

    try {
      const results: Record<string, string | null> = {};
      
      // Get all values in parallel
      const promises = keys.map(async (key) => {
        const value = await this.getConfigValue(key, label);
        results[key] = value;
      });

      await Promise.all(promises);
      return results;
    } catch (error) {
      console.error('Failed to get multiple config values:', error);
      logServerError(error as Error, { 
        service: 'azure-app-config', 
        action: 'get-multiple-config' 
      }, { keys, label });
      return keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});
    }
  }

  /**
   * Check if a feature flag is enabled
   */
  async isFeatureEnabled(flagName: string, userId?: string, userSegment?: string): Promise<boolean> {
    await this.initialize();

    if (!this.client) {
      console.warn('Azure App Configuration not available');
      return false;
    }

    const cacheKey = `feature_${flagName}_${userId || 'anonymous'}_${userSegment || 'default'}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < cached.ttl) {
        return cached.value;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    try {
      // Get feature flag configuration
      const featureFlagKey = `.appconfig.featureflag/${flagName}`;
      const setting = await this.client.getConfigurationSetting({ key: featureFlagKey });

      if (!setting.value) {
        return false;
      }

      const flagConfig = JSON.parse(setting.value);
      let enabled = flagConfig.enabled || false;

      // Apply conditions if they exist
      if (enabled && flagConfig.conditions) {
        // Check user segment condition
        if (flagConfig.conditions.client_filters) {
          for (const filter of flagConfig.conditions.client_filters) {
            if (filter.name === 'Microsoft.Targeting') {
              const params = filter.parameters;
              
              // Check user segment
              if (userSegment && params.Audience?.Groups) {
                enabled = params.Audience.Groups.includes(userSegment);
              }
              
              // Check percentage rollout
              if (params.Audience?.DefaultRolloutPercentage !== undefined) {
                const percentage = params.Audience.DefaultRolloutPercentage;
                const hash = this.hashUserId(userId || 'anonymous');
                enabled = (hash % 100) < percentage;
              }
            }
          }
        }
      }

      // Cache the result
      this.cache.set(cacheKey, {
        value: enabled,
        timestamp: Date.now(),
        ttl: this.defaultTTL
      });

      return enabled;
    } catch (error) {
      console.error(`Failed to check feature flag ${flagName}:`, error);
      logServerError(error as Error, { 
        service: 'azure-app-config', 
        action: 'check-feature' 
      }, { flagName, userId, userSegment });
      return false;
    }
  }

  /**
   * Get all configuration values with a specific label prefix
   */
  async getConfigsByPrefix(keyPrefix: string, label?: string): Promise<Record<string, string>> {
    await this.initialize();

    if (!this.client) {
      console.warn('Azure App Configuration not available');
      return {};
    }

    try {
      const configs: Record<string, string> = {};
      
      // List all configuration settings with the prefix
      const settingsIterable = this.client.listConfigurationSettings({
        keyFilter: `${keyPrefix}*`,
        labelFilter: label
      });

      for await (const setting of settingsIterable) {
        if (setting.key && setting.value !== undefined) {
          configs[setting.key] = setting.value;
        }
      }

      return configs;
    } catch (error) {
      console.error(`Failed to get configs with prefix ${keyPrefix}:`, error);
      logServerError(error as Error, { 
        service: 'azure-app-config', 
        action: 'get-by-prefix' 
      }, { keyPrefix, label });
      return {};
    }
  }

  /**
   * Set a configuration value (for admin operations)
   */
  async setConfigValue(key: string, value: string, label?: string, contentType?: string): Promise<void> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Azure App Configuration not available');
    }

    try {
      await this.client.setConfigurationSetting({
        key,
        value,
        label,
        contentType
      });

      // Invalidate cache
      const cacheKey = `config_${key}_${label || 'default'}`;
      this.cache.delete(cacheKey);

      console.log(`✅ Set config value for key: ${key}`);
    } catch (error) {
      console.error(`Failed to set config value for key ${key}:`, error);
      logServerError(error as Error, { 
        service: 'azure-app-config', 
        action: 'set-config' 
      }, { key, label });
      throw error;
    }
  }

  /**
   * Delete a configuration value
   */
  async deleteConfigValue(key: string, label?: string): Promise<void> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Azure App Configuration not available');
    }

    try {
      await this.client.deleteConfigurationSetting({ key, label });

      // Invalidate cache
      const cacheKey = `config_${key}_${label || 'default'}`;
      this.cache.delete(cacheKey);

      console.log(`✅ Deleted config value for key: ${key}`);
    } catch (error) {
      console.error(`Failed to delete config value for key ${key}:`, error);
      logServerError(error as Error, { 
        service: 'azure-app-config', 
        action: 'delete-config' 
      }, { key, label });
      throw error;
    }
  }

  /**
   * Get common feature flags for the application
   */
  async getFeatureFlags(): Promise<Record<string, boolean>> {
    const commonFlags = [
      'enableAutoApply',
      'enableVoiceInterview',
      'enablePremiumFeatures',
      'enableAnalytics',
      'maintenanceMode',
      'enableNewUI',
      'enableAIFeedback',
      'enableResumeAnalysis'
    ];

    const flags: Record<string, boolean> = {};
    
    await Promise.all(
      commonFlags.map(async (flag) => {
        flags[flag] = await this.isFeatureEnabled(flag);
      })
    );

    return flags;
  }

  /**
   * Get application configuration
   */
  async getAppConfig(): Promise<Record<string, any>> {
    const configKeys = {
      maxFileSize: '10485760', // 10MB default
      allowedFileTypes: 'pdf,doc,docx,txt',
      sessionTimeout: '3600', // 1 hour
      rateLimitPerHour: '100',
      supportEmail: 'support@prepbettr.com',
      apiBaseUrl: 'https://api.prepbettr.com',
      enableLogging: 'true',
      logLevel: 'info'
    };

    const config: Record<string, any> = {};

    await Promise.all(
      Object.entries(configKeys).map(async ([key, defaultValue]) => {
        const value = await this.getConfigValue(key);
        
        // Parse values appropriately
        if (key.includes('Size') || key.includes('Timeout') || key.includes('Limit')) {
          config[key] = value ? parseInt(value, 10) : parseInt(defaultValue, 10);
        } else if (key.includes('enable') || key.includes('Enable')) {
          config[key] = value ? value.toLowerCase() === 'true' : defaultValue.toLowerCase() === 'true';
        } else if (key === 'allowedFileTypes') {
          config[key] = value ? value.split(',') : defaultValue.split(',');
        } else {
          config[key] = value || defaultValue;
        }
      })
    );

    return config;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('✅ Azure App Configuration cache cleared');
  }

  /**
   * Hash user ID for percentage-based feature flags
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; timestamp: Date }> {
    try {
      await this.initialize();

      if (!this.client) {
        return { status: 'unhealthy', timestamp: new Date() };
      }

      // Try to read a test configuration
      try {
        await this.client.getConfigurationSetting({ key: 'healthCheck' });
      } catch (error: any) {
        // It's OK if the key doesn't exist, we just want to test connectivity
        if (error.statusCode !== 404) {
          throw error;
        }
      }

      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      console.error('Azure App Configuration health check failed:', error);
      return { status: 'unhealthy', timestamp: new Date() };
    }
  }
}

// Export singleton instance
export const azureAppConfigService = new AzureAppConfigService();
export default azureAppConfigService;
