'use client';

/**
 * Client-side React hook for unified configuration service
 * 
 * This provides a clean React interface to the unified config service
 * with proper state management, caching, and error handling.
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseUnifiedConfigResult<T> {
  value: T;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get a single configuration value with reactivity using API calls
 * This avoids bundling server-only modules for the client
 */
export function useUnifiedConfig<T = any>(
  key: string,
  defaultValue?: T
): UseUnifiedConfigResult<T> {
  const [value, setValue] = useState<T>(defaultValue as T);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchValue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use API endpoint instead of direct service import
      const response = await fetch(`/api/config/${encodeURIComponent(key)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }
      
      const data = await response.json();
      setValue(data.value !== undefined ? data.value : defaultValue as T);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setValue(defaultValue as T);
    } finally {
      setLoading(false);
    }
  }, [key, defaultValue]);

  const refresh = async () => {
    await fetchValue();
  };

  useEffect(() => {
    fetchValue();
  }, [fetchValue]);

  return { value, loading, error, refresh };
}

/**
 * Hook to get multiple configuration values at once
 */
export function useUnifiedConfigs<T extends Record<string, any>>(
  keys: Array<keyof T>,
  defaultValues?: Partial<T>
): {
  values: T;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [values, setValues] = useState<T>({} as T);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchValues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use API endpoints for each config key
      const configPromises = keys.map(async (key) => {
        const response = await fetch(`/api/config/${encodeURIComponent(String(key))}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch config for ${String(key)}: ${response.statusText}`);
        }
        const data = await response.json();
        return {
          key,
          value: data.value !== undefined ? data.value : defaultValues?.[key]
        };
      });
      
      const configResults = await Promise.all(configPromises);
      
      const result = {} as T;
      configResults.forEach(({ key, value }) => {
        result[key] = value;
      });

      setValues(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setValues({ ...defaultValues } as T);
    } finally {
      setLoading(false);
    }
  }, [keys, defaultValues]);

  const refresh = async () => {
    await fetchValues();
  };

  useEffect(() => {
    fetchValues();
  }, [fetchValues]);

  return { values, loading, error, refresh };
}

/**
 * Hook for feature flags specifically
 */
export function useFeatureFlag(flagName: string): {
  enabled: boolean;
  loading: boolean;
  error: string | null;
} {
  const configKey = `features.${flagName}`;
  const { value, loading, error } = useUnifiedConfig<boolean>(configKey, false);

  return {
    enabled: value,
    loading,
    error
  };
}

/**
 * Hook for multiple feature flags
 */
export function useFeatureFlags<T extends Record<string, boolean>>(
  flagNames: Array<keyof T>
): {
  flags: T;
  loading: boolean;
  error: string | null;
} {
  const configKeys = flagNames.map(name => `features.${String(name)}`);
  const defaultFlags = flagNames.reduce((acc, name) => {
    acc[name] = false as T[keyof T];
    return acc;
  }, {} as T);

  const { values, loading, error } = useUnifiedConfigs(configKeys, defaultFlags);

  // Transform config keys back to flag names
  const flags = {} as T;
  flagNames.forEach((flagName, index) => {
    const configKey = configKeys[index];
    flags[flagName] = (values[configKey] || false) as T[keyof T];
  });

  return { flags, loading, error };
}

/**
 * Hook for application configuration
 */
export function useAppConfig() {
  const configKeys = [
    'core.app.environment',
    'core.app.version',
    'core.app.debug',
    'core.app.maintenanceMode'
  ] as const;

  type ConfigKeys = typeof configKeys[number];
  type ConfigValues = {
    [K in ConfigKeys]: K extends 'core.app.environment' | 'core.app.version' 
      ? string 
      : boolean
  };

  const { values, loading, error } = useUnifiedConfigs<ConfigValues>([...configKeys], {
    'core.app.environment': 'development',
    'core.app.version': '1.0.0',
    'core.app.debug': false,
    'core.app.maintenanceMode': false
  } as ConfigValues);

  return {
    environment: values['core.app.environment'] as 'development' | 'staging' | 'production',
    version: values['core.app.version'] as string,
    debug: values['core.app.debug'] as boolean,
    maintenanceMode: values['core.app.maintenanceMode'] as boolean,
    loading,
    error
  };
}

/**
 * Hook for quotas and limits
 */
export function useQuotaConfig() {
  const configKeys = [
    'quotas.freeInterviews',
    'quotas.freeResumes',
    'quotas.premiumInterviews',
    'quotas.premiumResumes'
  ] as const;

  type QuotaKeys = typeof configKeys[number];
  type QuotaValues = Record<QuotaKeys, number>;

  const { values, loading, error } = useUnifiedConfigs<QuotaValues>([...configKeys], {
    'quotas.freeInterviews': 3,
    'quotas.freeResumes': 2,
    'quotas.premiumInterviews': 100,
    'quotas.premiumResumes': 20
  } as QuotaValues);

  return {
    freeInterviews: values['quotas.freeInterviews'] as number,
    freeResumes: values['quotas.freeResumes'] as number,
    premiumInterviews: values['quotas.premiumInterviews'] as number,
    premiumResumes: values['quotas.premiumResumes'] as number,
    loading,
    error
  };
}

export default useUnifiedConfig;
