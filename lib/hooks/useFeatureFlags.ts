import { useState, useEffect } from 'react';
import { useUnifiedConfig } from '@/lib/hooks/useUnifiedConfig';

// Define types locally to avoid importing server-only modules
export interface FeatureFlags {
  voiceInterview: boolean;
  premiumFeatures: boolean;
  newUI: boolean;
}

export interface EnhancedFeatureFlags extends FeatureFlags {
  rolloutStatus: {
    voiceInterview: boolean;
    premiumFeatures: boolean;
    newUI: boolean;
  };
}

/**
 * Client-safe feature flags hook that uses API calls instead of direct service imports
 * This avoids bundling server-only modules for the client
 */
export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<EnhancedFeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load feature flags on component mount using API instead of direct service import
  useEffect(() => {
    const loadFlags = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch from API endpoint instead of direct service import
        const response = await fetch('/api/feature-flags');
        if (!response.ok) {
          throw new Error('Failed to fetch feature flags');
        }
        
        const enhancedFlags = await response.json();
        setFlags(enhancedFlags);
        setLoading(false);
      } catch (err) {
        console.error('Error loading feature flags:', err);
        setError(err instanceof Error ? err.message : 'Failed to load feature flags');
        setLoading(false);

        // Set default flags if loading fails
        if (!flags) {
          setFlags({
            voiceInterview: false,
            premiumFeatures: false,
            newUI: false,
            rolloutStatus: {
              voiceInterview: false,
              premiumFeatures: false,
              newUI: false,
            },
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
      
      const response = await fetch('/api/feature-flags?refresh=true');
      if (!response.ok) {
        throw new Error('Failed to refresh feature flags');
      }
      
      const newFlags = await response.json();
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
    isVoiceInterviewEnabled: () => getFeatureFlag('voiceInterview'),
    isPremiumFeaturesEnabled: () => getFeatureFlag('premiumFeatures'),
    isNewUIEnabled: () => getFeatureFlag('newUI'),
  };
};

/**
 * Simplified hook for individual feature flags using unified config directly
 * More performant for components that only need specific flags
 */
export const useUnifiedFeatureFlag = (flagName: keyof FeatureFlags) => {
  const configKey = `features.${flagName}`;
  return useUnifiedConfig<boolean>(configKey, false);
};

/**
 * Hook for getting multiple feature flags at once
 */
export const useUnifiedFeatureFlags = (flagNames: Array<keyof FeatureFlags>) => {
  const results = flagNames.reduce((acc, flagName) => {
    const configKey = `features.${flagName}`;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    acc[flagName] = useUnifiedConfig<boolean>(configKey, false);
    return acc;
  }, {} as Record<keyof FeatureFlags, { value: boolean; loading: boolean; error: string | null }>);
  
  return results;
};
