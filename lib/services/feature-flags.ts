import { remoteConfigService, FeatureFlags } from './firebase-remote-config';
import { userTargetingService, UserTargetingService } from './user-targeting';

export interface EnhancedFeatureFlags extends FeatureFlags {
  // Rollout status for each feature
  rolloutStatus: {
    autoApplyAzure: boolean;
    portalIntegration: boolean;
  };
}

class FeatureFlagsService {
  private static instance: FeatureFlagsService;

  static getInstance(): FeatureFlagsService {
    if (!FeatureFlagsService.instance) {
      FeatureFlagsService.instance = new FeatureFlagsService();
    }
    return FeatureFlagsService.instance;
  }

  /**
   * Get feature flag value considering both remote config and user targeting
   */
  async getFeatureFlag(flagName: keyof FeatureFlags): Promise<boolean> {
    try {
      // First check if the feature is enabled globally via Remote Config
      const remoteConfigValue = await remoteConfigService.getFeatureFlag(flagName);
      
      if (!remoteConfigValue) {
        // If disabled globally, return false
        return false;
      }

      // If enabled globally, check if user is in the rollout
      const rolloutConfig = UserTargetingService.ROLLOUT_CONFIGS[flagName];
      if (!rolloutConfig) {
        // If no rollout config, default to global setting
        return remoteConfigValue;
      }

      return userTargetingService.isCurrentUserInRollout(rolloutConfig);
    } catch (error) {
      console.error(`Error getting feature flag ${flagName}:`, error);
      return false; // Default to disabled on error
    }
  }

  /**
   * Get all feature flags with rollout status
   */
  async getAllFeatureFlags(): Promise<EnhancedFeatureFlags> {
    try {
      // Get remote config flags
      const remoteFlags = await remoteConfigService.getAllFeatureFlags();
      
      // Get rollout status for current user
      const rolloutStatus = userTargetingService.getCurrentUserRolloutStatus();
      
      // Combine both: feature must be enabled globally AND user must be in rollout
      const enhancedFlags: EnhancedFeatureFlags = {
        autoApplyAzure: remoteFlags.autoApplyAzure && rolloutStatus.autoApplyAzure,
        portalIntegration: remoteFlags.portalIntegration && rolloutStatus.portalIntegration,
        rolloutStatus: {
          autoApplyAzure: rolloutStatus.autoApplyAzure || false,
          portalIntegration: rolloutStatus.portalIntegration || false,
        },
      };

      return enhancedFlags;
    } catch (error) {
      console.error('Error getting all feature flags:', error);
      return {
        autoApplyAzure: false,
        portalIntegration: false,
        rolloutStatus: {
          autoApplyAzure: false,
          portalIntegration: false,
        },
      };
    }
  }

  /**
   * Check if a specific feature is enabled for the current user
   */
  async isFeatureEnabled(featureName: keyof FeatureFlags): Promise<boolean> {
    return this.getFeatureFlag(featureName);
  }

  /**
   * Convenience methods for specific features
   */
  async isAutoApplyAzureEnabled(): Promise<boolean> {
    return this.getFeatureFlag('autoApplyAzure');
  }

  async isPortalIntegrationEnabled(): Promise<boolean> {
    return this.getFeatureFlag('portalIntegration');
  }

  /**
   * Get debug information about feature flags
   */
  async getDebugInfo(): Promise<{
    remoteConfig: FeatureFlags;
    rolloutStatus: Record<string, boolean>;
    finalFlags: FeatureFlags;
    userId: string | null;
    rolloutConfigs: typeof UserTargetingService.ROLLOUT_CONFIGS;
  }> {
    const remoteConfig = await remoteConfigService.getAllFeatureFlags();
    const rolloutStatus = userTargetingService.getCurrentUserRolloutStatus();
    const finalFlags = await this.getAllFeatureFlags();
    const userId = userTargetingService.getCurrentUserId();

    return {
      remoteConfig,
      rolloutStatus,
      finalFlags: {
        autoApplyAzure: finalFlags.autoApplyAzure,
        portalIntegration: finalFlags.portalIntegration,
      },
      userId,
      rolloutConfigs: UserTargetingService.ROLLOUT_CONFIGS,
    };
  }

  /**
   * Force refresh all feature flags
   */
  async refreshFeatureFlags(): Promise<EnhancedFeatureFlags> {
    await remoteConfigService.refreshFeatureFlags();
    return this.getAllFeatureFlags();
  }
}

// Export singleton instance
export const featureFlagsService = FeatureFlagsService.getInstance();

// Export types
export type { FeatureFlags };
