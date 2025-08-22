import { unifiedConfigService } from './unified-config-service';
import { userTargetingService, UserTargetingService } from './user-targeting';

// Updated interface to match unified config schema
export interface FeatureFlags {
  autoApplyAzure: boolean;
  portalIntegration: boolean;
  voiceInterview: boolean;
  premiumFeatures: boolean;
  newUI: boolean;
}

export interface EnhancedFeatureFlags extends FeatureFlags {
  // Rollout status for each feature
  rolloutStatus: {
    autoApplyAzure: boolean;
    portalIntegration: boolean;
    voiceInterview: boolean;
    premiumFeatures: boolean;
    newUI: boolean;
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
      // Get feature flag from unified config service
      const configKey = `features.${flagName}`;
      const globalValue = await unifiedConfigService.get<boolean>(configKey, false);
      
      if (!globalValue) {
        // If disabled globally, return false
        return false;
      }

      // If enabled globally, check if user is in the rollout
      const rolloutConfig = UserTargetingService.ROLLOUT_CONFIGS[flagName];
      if (!rolloutConfig) {
        // If no rollout config, default to global setting
        return globalValue;
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
      // Get all feature flags from unified config service
      const allConfigs = await unifiedConfigService.getAll('features.');
      
      // Extract flags from config keys
      const globalFlags: FeatureFlags = {
        autoApplyAzure: allConfigs['features.autoApplyAzure'] || false,
        portalIntegration: allConfigs['features.portalIntegration'] || false,
        voiceInterview: allConfigs['features.voiceInterview'] || false,
        premiumFeatures: allConfigs['features.premiumFeatures'] || false,
        newUI: allConfigs['features.newUI'] || false
      };
      
      // Get rollout status for current user
      const rolloutStatus = userTargetingService.getCurrentUserRolloutStatus();
      
      // Combine both: feature must be enabled globally AND user must be in rollout
      const enhancedFlags: EnhancedFeatureFlags = {
        autoApplyAzure: globalFlags.autoApplyAzure && rolloutStatus.autoApplyAzure,
        portalIntegration: globalFlags.portalIntegration && rolloutStatus.portalIntegration,
        voiceInterview: globalFlags.voiceInterview && rolloutStatus.voiceInterview,
        premiumFeatures: globalFlags.premiumFeatures && rolloutStatus.premiumFeatures,
        newUI: globalFlags.newUI && rolloutStatus.newUI,
        rolloutStatus: {
          autoApplyAzure: rolloutStatus.autoApplyAzure || false,
          portalIntegration: rolloutStatus.portalIntegration || false,
          voiceInterview: rolloutStatus.voiceInterview || false,
          premiumFeatures: rolloutStatus.premiumFeatures || false,
          newUI: rolloutStatus.newUI || false
        },
      };

      return enhancedFlags;
    } catch (error) {
      console.error('Error getting all feature flags:', error);
      return {
        autoApplyAzure: false,
        portalIntegration: false,
        voiceInterview: false,
        premiumFeatures: false,
        newUI: false,
        rolloutStatus: {
          autoApplyAzure: false,
          portalIntegration: false,
          voiceInterview: false,
          premiumFeatures: false,
          newUI: false
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
    unifiedConfig: Record<string, any>;
    rolloutStatus: Record<string, boolean>;
    finalFlags: FeatureFlags;
    userId: string | null;
    rolloutConfigs: typeof UserTargetingService.ROLLOUT_CONFIGS;
  }> {
    const unifiedConfig = await unifiedConfigService.getAll('features.');
    const rolloutStatus = userTargetingService.getCurrentUserRolloutStatus();
    const finalFlags = await this.getAllFeatureFlags();
    const userId = userTargetingService.getCurrentUserId();

    return {
      unifiedConfig,
      rolloutStatus,
      finalFlags: {
        autoApplyAzure: finalFlags.autoApplyAzure,
        portalIntegration: finalFlags.portalIntegration,
        voiceInterview: finalFlags.voiceInterview,
        premiumFeatures: finalFlags.premiumFeatures,
        newUI: finalFlags.newUI
      },
      userId,
      rolloutConfigs: UserTargetingService.ROLLOUT_CONFIGS,
    };
  }

  /**
   * Force refresh all feature flags
   */
  async refreshFeatureFlags(): Promise<EnhancedFeatureFlags> {
    await unifiedConfigService.refresh();
    return this.getAllFeatureFlags();
  }
}

// Export singleton instance
export const featureFlagsService = FeatureFlagsService.getInstance();
