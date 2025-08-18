/**
 * Azure App Configuration Service for Azure Functions
 * 
 * This module provides access to Azure App Configuration for Azure Functions,
 * including configuration values and feature flags with caching.
 */

import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';

interface CachedConfig {
  values: Record<string, string>;
  featureFlags: Record<string, any>;
  lastFetch: Date;
  ttl: number; // TTL in milliseconds
}

interface FeatureFlag {
  enabled: boolean;
  description: string;
  conditions?: {
    client_filters: Array<{
      name: string;
      parameters: Record<string, any>;
    }>;
  };
}

class AzureAppConfigService {
  private client: AppConfigurationClient | null = null;
  private cache: CachedConfig | null = null;
  private connectionString: string;
  private label: string;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
  
  constructor(connectionString?: string, label: string = 'production') {
    this.connectionString = connectionString || process.env.AZURE_APPCONFIG_CONNECTION_STRING || '';
    this.label = label;
    
    if (!this.connectionString) {
      console.warn('Azure App Configuration connection string not provided. Feature flags and config will be disabled.');
      return;
    }
    
    try {
      // Initialize client
      if (this.connectionString.startsWith('Endpoint=')) {
        this.client = new AppConfigurationClient(this.connectionString);
      } else if (this.connectionString.startsWith('https://')) {
        // Use managed identity with endpoint URL
        this.client = new AppConfigurationClient(this.connectionString, new DefaultAzureCredential());
      } else {
        console.warn('Invalid Azure App Configuration connection string format');
        return;
      }
    } catch (error) {
      console.error('Failed to initialize Azure App Configuration client:', error);
      console.error('💡 Hint: Ensure AZURE_APPCONFIG_CONNECTION_STRING is properly set');
    }
  }
  
  /**
   * Check if configuration is cached and not expired
   */
  private isCacheValid(): boolean {
    if (!this.cache) return false;
    
    const now = new Date().getTime();
    const cacheAge = now - this.cache.lastFetch.getTime();
    
    return cacheAge < this.cacheTTL;
  }
  
  /**
   * Fetch all configuration values and feature flags
   */
  async fetchConfiguration(): Promise<CachedConfig | null> {
    if (!this.client) {
      console.warn('Azure App Configuration client not initialized');
      return null;
    }
    
    // Return cached config if still valid
    if (this.isCacheValid()) {
      return this.cache;
    }
    
    try {
      console.log(`Fetching configuration from Azure App Configuration (label: ${this.label})`);
      
      const values: Record<string, string> = {};
      const featureFlags: Record<string, any> = {};
      
      const settings = this.client.listConfigurationSettings({ 
        labelFilter: this.label 
      });
      
      for await (const setting of settings) {
        if (!setting.key || setting.value === undefined) continue;
        
        if (setting.key.startsWith('.appconfig.featureflag/')) {
          // Handle feature flags
          const flagName = setting.key.replace('.appconfig.featureflag/', '');
          try {
            const flagData = JSON.parse(setting.value);
            featureFlags[flagName] = {
              enabled: flagData.enabled,
              description: flagData.description,
              conditions: flagData.conditions
            };
          } catch (error) {
            console.warn(`Failed to parse feature flag ${flagName}:`, error);
          }
        } else {
          // Handle regular configuration values
          values[setting.key] = setting.value;
        }
      }
      
      // Update cache
      this.cache = {
        values,
        featureFlags,
        lastFetch: new Date(),
        ttl: this.cacheTTL
      };
      
      console.log(`Loaded ${Object.keys(values).length} config values and ${Object.keys(featureFlags).length} feature flags`);
      
      return this.cache;
      
    } catch (error) {
      console.error('Failed to fetch configuration from Azure App Configuration:', error);
      return this.cache; // Return cached data if available
    }
  }
  
  /**
   * Get a configuration value
   */
  async getConfigValue(key: string, defaultValue?: string): Promise<string | undefined> {
    const config = await this.fetchConfiguration();
    
    if (!config) {
      return defaultValue || process.env[key];
    }
    
    return config.values[key] ?? defaultValue ?? process.env[key];
  }
  
  /**
   * Get multiple configuration values
   */
  async getConfigValues(keys: string[]): Promise<Record<string, string | undefined>> {
    const config = await this.fetchConfiguration();
    const result: Record<string, string | undefined> = {};
    
    for (const key of keys) {
      if (config) {
        result[key] = config.values[key] ?? process.env[key];
      } else {
        result[key] = process.env[key];
      }
    }
    
    return result;
  }
  
  /**
   * Check if a feature flag is enabled
   */
  async isFeatureEnabled(flagName: string, userId?: string, defaultValue: boolean = false): Promise<boolean> {
    const config = await this.fetchConfiguration();
    
    if (!config || !config.featureFlags[flagName]) {
      return defaultValue;
    }
    
    const flag: FeatureFlag = config.featureFlags[flagName];
    
    // If no conditions, return the enabled state
    if (!flag.conditions || !flag.conditions.client_filters || flag.conditions.client_filters.length === 0) {
      return flag.enabled;
    }
    
    // Handle percentage rollout filters
    for (const filter of flag.conditions.client_filters) {
      if (filter.name === 'Microsoft.Percentage') {
        const percentage = parseInt(filter.parameters.Value || '0', 10);
        
        // If no userId provided, use random for percentage
        if (!userId) {
          return flag.enabled && (Math.random() * 100) < percentage;
        }
        
        // Use userId hash for consistent percentage calculation
        const hash = this.hashUserId(userId);
        const userPercentage = hash % 100;
        
        return flag.enabled && userPercentage < percentage;
      }
    }
    
    return flag.enabled;
  }
  
  /**
   * Get feature flag details
   */
  async getFeatureFlag(flagName: string): Promise<FeatureFlag | null> {
    const config = await this.fetchConfiguration();
    
    if (!config || !config.featureFlags[flagName]) {
      return null;
    }
    
    return config.featureFlags[flagName];
  }
  
  /**
   * Get all feature flags
   */
  async getFeatureFlags(): Promise<Record<string, FeatureFlag>> {
    const config = await this.fetchConfiguration();
    
    if (!config) {
      return {};
    }
    
    return config.featureFlags;
  }
  
  /**
   * Simple hash function for consistent userId-based percentage calculation
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
   * Get application quotas and limits
   */
  async getQuotas(): Promise<Record<string, number>> {
    const quotaKeys = [
      'FREE_TIER_INTERVIEWS_LIMIT',
      'FREE_TIER_RESUMES_LIMIT', 
      'PREMIUM_TIER_INTERVIEWS_LIMIT',
      'PREMIUM_TIER_RESUMES_LIMIT',
      'VOICE_INTERVIEW_MAX_DURATION_MINUTES',
      'API_RATE_LIMIT_REQUESTS_PER_MINUTE',
      'API_RATE_LIMIT_REQUESTS_PER_HOUR'
    ];
    
    const configValues = await this.getConfigValues(quotaKeys);
    const quotas: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(configValues)) {
      quotas[key] = parseInt(value || '0', 10);
    }
    
    return quotas;
  }
  
  /**
   * Clear cache to force refresh
   */
  clearCache(): void {
    this.cache = null;
  }
  
  /**
   * Set cache TTL
   */
  setCacheTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }
  
  /**
   * Get cache status
   */
  getCacheStatus(): { cached: boolean; age?: number; ttl: number } {
    if (!this.cache) {
      return { cached: false, ttl: this.cacheTTL };
    }
    
    const age = new Date().getTime() - this.cache.lastFetch.getTime();
    
    return {
      cached: true,
      age,
      ttl: this.cacheTTL
    };
  }
}

// Singleton instance for Azure Functions
let appConfigService: AzureAppConfigService | null = null;

/**
 * Get or create the Azure App Configuration service instance
 */
export function getAppConfigService(connectionString?: string, label?: string): AzureAppConfigService {
  if (!appConfigService) {
    const environment = process.env.ENVIRONMENT || 'production';
    const configLabel = label || (environment === 'staging' ? 'staging' : 'production');
    
    appConfigService = new AzureAppConfigService(connectionString, configLabel);
  }
  
  return appConfigService;
}

/**
 * Convenience functions for common operations
 */

// Get configuration value
export async function getConfig(key: string, defaultValue?: string): Promise<string | undefined> {
  const service = getAppConfigService();
  return service.getConfigValue(key, defaultValue);
}

// Check feature flag
export async function isFeatureEnabled(flagName: string, userId?: string, defaultValue: boolean = false): Promise<boolean> {
  const service = getAppConfigService();
  return service.isFeatureEnabled(flagName, userId, defaultValue);
}

// Get quotas
export async function getQuotas(): Promise<Record<string, number>> {
  const service = getAppConfigService();
  return service.getQuotas();
}

// Get environment-specific configuration
export async function getEnvironmentConfig(): Promise<Record<string, string | undefined>> {
  const service = getAppConfigService();
  
  const commonKeys = [
    'ENVIRONMENT',
    'AZURE_REGION',
    'ENABLE_TELEMETRY',
    'LOG_LEVEL',
    'CACHE_TTL_SECONDS',
    'SESSION_TIMEOUT_MINUTES'
  ];
  
  return service.getConfigValues(commonKeys);
}

export { AzureAppConfigService };
export type { FeatureFlag };
