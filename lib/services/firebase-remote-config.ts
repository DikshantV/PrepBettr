import { getRemoteConfig, fetchAndActivate, getValue, getAll } from 'firebase/remote-config';
import { app } from '@/firebase/client';

export interface FeatureFlags {
  autoApplyAzure: boolean;
  portalIntegration: boolean;
}

class FirebaseRemoteConfigService {
  private remoteConfig: any = null;
  private isInitialized = false;
  private cache: FeatureFlags | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.remoteConfig = getRemoteConfig(app);
      
      // Set config settings
      this.remoteConfig.settings = {
        minimumFetchIntervalMillis: 60000, // 1 minute minimum fetch interval
        fetchTimeoutMillis: 10000, // 10 second fetch timeout
      };

      // Set default values for feature flags
      this.remoteConfig.defaultConfig = {
        autoApplyAzure: false,
        portalIntegration: false,
      };

      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing Firebase Remote Config:', error);
      throw error;
    }
  }

  private isCacheValid(): boolean {
    return this.cache !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  async fetchFeatureFlags(): Promise<FeatureFlags> {
    // Return cached values if still valid
    if (this.isCacheValid()) {
      return this.cache!;
    }

    try {
      await this.initialize();
      
      // Fetch and activate remote config
      await fetchAndActivate(this.remoteConfig);

      // Get all feature flags
      const flags: FeatureFlags = {
        autoApplyAzure: getValue(this.remoteConfig, 'autoApplyAzure').asBoolean(),
        portalIntegration: getValue(this.remoteConfig, 'portalIntegration').asBoolean(),
      };

      // Update cache
      this.cache = flags;
      this.cacheTimestamp = Date.now();

      console.log('Feature flags fetched:', flags);
      return flags;
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      
      // Return default values if fetch fails
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

  async getFeatureFlag(flagName: keyof FeatureFlags): Promise<boolean> {
    const flags = await this.fetchFeatureFlags();
    return flags[flagName];
  }

  async getAllFeatureFlags(): Promise<FeatureFlags> {
    return this.fetchFeatureFlags();
  }

  // Force refresh feature flags (ignoring cache)
  async refreshFeatureFlags(): Promise<FeatureFlags> {
    this.cache = null;
    this.cacheTimestamp = 0;
    return this.fetchFeatureFlags();
  }

  // Get cached flags without making network request
  getCachedFlags(): FeatureFlags | null {
    return this.isCacheValid() ? this.cache : null;
  }
}

// Export singleton instance
export const remoteConfigService = new FirebaseRemoteConfigService();

// Export hook for React components
export const useFeatureFlags = () => {
  return {
    getFeatureFlag: (flagName: keyof FeatureFlags) => remoteConfigService.getFeatureFlag(flagName),
    getAllFeatureFlags: () => remoteConfigService.getAllFeatureFlags(),
    refreshFeatureFlags: () => remoteConfigService.refreshFeatureFlags(),
    getCachedFlags: () => remoteConfigService.getCachedFlags(),
  };
};
