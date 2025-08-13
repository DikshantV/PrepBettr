/**
 * Azure App Configuration Service
 * 
 * Replaces Firebase Remote Config with Azure App Configuration for feature flags
 * and configuration management.
 */

import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';
import { fetchAzureSecrets } from '@/lib/azure-config-browser';

export interface FeatureFlags {
  autoApplyAzure: boolean;
  portalIntegration: boolean;
}

interface ConfigValue {
  key: string;
  value: string;
  isFeatureFlag: boolean;
  enabled?: boolean;
  label?: string;
}

class AzureAppConfigService {
  private client: AppConfigurationClient | null = null;
  private isInitialized = false;
  private cache: FeatureFlags | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private secrets: any = null;

  /**
   * Initialize the Azure App Configuration client
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized && this.client) return;

    try {
      // Fetch Azure secrets
      this.secrets = await fetchAzureSecrets();
      
      if (!this.secrets.azureAppConfigConnectionString && !this.secrets.azureAppConfigEndpoint) {
        throw new Error('Azure App Configuration connection string or endpoint not found');
      }

      // Initialize client with connection string (preferred) or endpoint + credentials
      if (this.secrets.azureAppConfigConnectionString) {
        this.client = new AppConfigurationClient(this.secrets.azureAppConfigConnectionString);
      } else if (this.secrets.azureAppConfigEndpoint) {
        const credential = new DefaultAzureCredential();
        this.client = new AppConfigurationClient(this.secrets.azureAppConfigEndpoint, credential);
      } else {
        throw new Error('No valid Azure App Configuration credentials found');
      }

      this.isInitialized = true;
      console.log('✅ Azure App Configuration service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Azure App Configuration:', error);
      throw error;
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return this.cache !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  /**
   * Parse feature flag value from Azure App Configuration
   */
  private parseFeatureFlagValue(value: string, enabled?: boolean): boolean {
    if (enabled !== undefined) {
      return enabled;
    }
    
    // Try to parse as boolean
    const lowerValue = value.toLowerCase();
    return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'enabled';
  }

  /**
   * Fetch feature flags from Azure App Configuration
   */
  async fetchFeatureFlags(): Promise<FeatureFlags> {
    // Return cached values if still valid
    if (this.isCacheValid()) {
      return this.cache!;
    }

    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('Azure App Configuration client not initialized');
      }

      const flags: FeatureFlags = {
        autoApplyAzure: false,
        portalIntegration: false,
      };

      // Define feature flag keys with their Azure App Config counterparts
      const flagKeys = [
        { local: 'autoApplyAzure', azure: '.appconfig.featureflag/autoApplyAzure' },
        { local: 'portalIntegration', azure: '.appconfig.featureflag/portalIntegration' }
      ];

      // Fetch feature flags
      for (const flagKey of flagKeys) {
        try {
          // Try to get as feature flag first
          const configSetting = await this.client.getConfigurationSetting({
            key: flagKey.azure
          });

          if (configSetting && configSetting.value) {
            const featureFlagData = JSON.parse(configSetting.value);
            flags[flagKey.local as keyof FeatureFlags] = featureFlagData.enabled === true;
          }
        } catch (featureFlagError) {
          // Fallback: try to get as regular configuration setting
          try {
            const configSetting = await this.client.getConfigurationSetting({
              key: flagKey.local
            });

            if (configSetting && configSetting.value !== undefined) {
              flags[flagKey.local as keyof FeatureFlags] = this.parseFeatureFlagValue(configSetting.value);
            }
          } catch (regularError) {
            console.warn(`Failed to fetch flag ${flagKey.local}, using default value:`, regularError);
            // Keep default value (false)
          }
        }
      }

      // Update cache
      this.cache = flags;
      this.cacheTimestamp = Date.now();

      console.log('📊 Feature flags fetched from Azure App Configuration:', flags);
      return flags;

    } catch (error) {
      console.error('❌ Error fetching feature flags from Azure App Configuration:', error);

      // Return cached values if available, otherwise default values
      const defaultFlags: FeatureFlags = {
        autoApplyAzure: false,
        portalIntegration: false,
      };

      if (!this.cache) {
        this.cache = defaultFlags;
        this.cacheTimestamp = Date.now();
      }

      return this.cache;
    }
  }

  /**
   * Get a specific feature flag value
   */
  async getFeatureFlag(flagName: keyof FeatureFlags): Promise<boolean> {
    const flags = await this.fetchFeatureFlags();
    return flags[flagName];
  }

  /**
   * Get all feature flags
   */
  async getAllFeatureFlags(): Promise<FeatureFlags> {
    return this.fetchFeatureFlags();
  }

  /**
   * Force refresh feature flags (ignoring cache)
   */
  async refreshFeatureFlags(): Promise<FeatureFlags> {
    this.cache = null;
    this.cacheTimestamp = 0;
    return this.fetchFeatureFlags();
  }

  /**
   * Get cached flags without making network request
   */
  getCachedFlags(): FeatureFlags | null {
    return this.isCacheValid() ? this.cache : null;
  }

  /**
   * Set a feature flag value (for testing or admin purposes)
   */
  async setFeatureFlag(flagName: keyof FeatureFlags, value: boolean, label?: string): Promise<void> {
    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('Azure App Configuration client not initialized');
      }

      // Create feature flag format for Azure App Configuration
      const featureFlagValue = {
        id: flagName,
        description: `Feature flag for ${flagName}`,
        enabled: value,
        conditions: {
          client_filters: []
        }
      };

      await this.client.setConfigurationSetting({
        key: `.appconfig.featureflag/${flagName}`,
        value: JSON.stringify(featureFlagValue),
        contentType: 'application/vnd.microsoft.appconfig.ff+json;charset=utf-8',
        label: label
      });

      // Invalidate cache
      this.cache = null;
      this.cacheTimestamp = 0;

      console.log(`✅ Feature flag ${flagName} set to ${value}`);
    } catch (error) {
      console.error(`❌ Failed to set feature flag ${flagName}:`, error);
      throw error;
    }
  }

  /**
   * Get configuration value (non-feature flag)
   */
  async getConfigValue(key: string, label?: string): Promise<string | undefined> {
    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('Azure App Configuration client not initialized');
      }

      const configSetting = await this.client.getConfigurationSetting({
        key,
        label
      });

      return configSetting?.value;
    } catch (error) {
      console.error(`❌ Failed to get config value ${key}:`, error);
      return undefined;
    }
  }

  /**
   * Set configuration value (non-feature flag)
   */
  async setConfigValue(key: string, value: string, label?: string): Promise<void> {
    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('Azure App Configuration client not initialized');
      }

      await this.client.setConfigurationSetting({
        key,
        value,
        label
      });

      console.log(`✅ Config value ${key} set successfully`);
    } catch (error) {
      console.error(`❌ Failed to set config value ${key}:`, error);
      throw error;
    }
  }

  /**
   * List all configuration settings
   */
  async listAllSettings(keyFilter?: string, labelFilter?: string): Promise<Array<{key: string, value: string, label?: string}>> {
    try {
      await this.initialize();

      if (!this.client) {
        throw new Error('Azure App Configuration client not initialized');
      }

      const settings: Array<{key: string, value: string, label?: string}> = [];
      
      for await (const configSetting of this.client.listConfigurationSettings({
        keyFilter,
        labelFilter
      })) {
        if (configSetting.key && configSetting.value !== undefined) {
          settings.push({
            key: configSetting.key,
            value: configSetting.value,
            label: configSetting.label
          });
        }
      }

      return settings;
    } catch (error) {
      console.error('❌ Failed to list configuration settings:', error);
      return [];
    }
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    initialized: boolean;
    lastFetch: number | null;
    cacheValid: boolean;
    error?: string;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Test connection by fetching a simple config
      await this.client?.getConfigurationSetting({ key: 'health-check' }).catch(() => {
        // Ignore error for health check key that might not exist
      });

      return {
        healthy: true,
        initialized: this.isInitialized,
        lastFetch: this.cacheTimestamp || null,
        cacheValid: this.isCacheValid()
      };
    } catch (error) {
      return {
        healthy: false,
        initialized: this.isInitialized,
        lastFetch: this.cacheTimestamp || null,
        cacheValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const azureAppConfigService = new AzureAppConfigService();

// Export hook for React components (maintains compatibility)
export const useFeatureFlags = () => {
  return {
    getFeatureFlag: (flagName: keyof FeatureFlags) => azureAppConfigService.getFeatureFlag(flagName),
    getAllFeatureFlags: () => azureAppConfigService.getAllFeatureFlags(),
    refreshFeatureFlags: () => azureAppConfigService.refreshFeatureFlags(),
    getCachedFlags: () => azureAppConfigService.getCachedFlags(),
  };
};

// Export types
export type { ConfigValue };
