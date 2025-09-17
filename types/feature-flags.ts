// Auto-generated feature flags types
// Generated at: 2025-08-18T14:49:26.286Z

export type FeatureFlagName = 'voiceInterviews' | 'premiumFeatures' | 'maintenanceMode';

export interface FeatureFlag {
  enabled: boolean;
  description: string;
  conditions?: {
    client_filters: Array<{
      name: string;
      parameters: Record<string, any>;
    }>;
  };
}

export interface FeatureFlagsConfig {
  generated: string;
  label: string;
  flags: Record<FeatureFlagName, FeatureFlag>;
}

// Feature flag constants
export const FEATURE_FLAGS = {
  VOICEINTERVIEWS: 'voiceInterviews' as const,
  PREMIUMFEATURES: 'premiumFeatures' as const,
  MAINTENANCEMODE: 'maintenanceMode' as const
} as const;
