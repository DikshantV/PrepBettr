import { useState, useEffect } from 'react';
import { featureFlagsService, EnhancedFeatureFlags, FeatureFlags } from '@/lib/services/feature-flags';

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<EnhancedFeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load feature flags on component mount
  useEffect(() => {
    const loadFlags = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch enhanced feature flags (includes rollout logic)
        const enhancedFlags = await featureFlagsService.getAllFeatureFlags();
        setFlags(enhancedFlags);
        setLoading(false);
      } catch (err) {
        console.error('Error loading feature flags:', err);
        setError(err instanceof Error ? err.message : 'Failed to load feature flags');
        setLoading(false);

        // Set default flags if loading fails
        if (!flags) {
          setFlags({
            autoApplyAzure: false,
            portalIntegration: false,
          });
        }
      }
    };

    loadFlags();
  }, []);

  const getFeatureFlag = (flagName: keyof FeatureFlags): boolean => {
    return flags?.[flagName] || false;
  };

  const refreshFlags = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const newFlags = await featureFlagsService.refreshFeatureFlags();
      setFlags(newFlags);
      setLoading(false);
    } catch (err) {
      console.error('Error refreshing feature flags:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh feature flags');
      setLoading(false);
    }
  };

  return {
    flags,
    loading,
    error,
    getFeatureFlag,
    refreshFlags,
    // Convenience methods for specific flags
    isAutoApplyAzureEnabled: () => getFeatureFlag('autoApplyAzure'),
    isPortalIntegrationEnabled: () => getFeatureFlag('portalIntegration'),
  };
};
