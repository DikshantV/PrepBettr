import useSWR from 'swr';
import { toast } from 'sonner';

// SWR Configuration for subscription data
const subscriptionSWRConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 15 * 60 * 1000, // 15 minutes
  errorRetryCount: 2,
  errorRetryInterval: 5000,
  onError: (error: Error) => {
    console.error('Subscription data error:', error);
    toast.error('Data Loading Error', {
      description: 'Failed to load subscription information. Please try again.',
      duration: 5000
    });
  }
};

// Fetcher function for subscription data
const fetcher = async (url: string) => {
  const response = await Promise.race([
    fetch(url),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    )
  ]) as Response;

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Batch fetcher for multiple subscription endpoints
const batchFetcher = async (urls: string[]) => {
  const promises = urls.map(url => 
    fetch(url)
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .catch(error => ({ error: error.message || 'Failed to fetch', url }))
  );

  return Promise.allSettled(promises);
};

// Hook for subscription plans data
export const useSubscriptionPlans = () => {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/subscriptions/plans',
    fetcher,
    subscriptionSWRConfig
  );

  return {
    plans: data?.plans || null,
    isLoading,
    isError: error,
    refresh: mutate,
    // Precomputed plan data for better performance
    planKeys: data?.plans ? Object.keys(data.plans) : [],
    hasPlans: data?.plans && Object.keys(data.plans).length > 0
  };
};

// Hook for subscription analytics (batched request)
export const useSubscriptionAnalytics = (userId?: string) => {
  const { data, error, isLoading } = useSWR(
    userId ? [
      '/api/subscriptions/analytics',
      `/api/subscriptions/user/${userId}/stats`,
      '/api/subscriptions/pricing/trends'
    ] : null,
    batchFetcher,
    subscriptionSWRConfig
  );

  const processedData = data ? {
    analytics: data[0]?.status === 'fulfilled' ? data[0].value : null,
    userStats: data[1]?.status === 'fulfilled' ? data[1].value : null,
    pricingTrends: data[2]?.status === 'fulfilled' ? data[2].value : null,
    errors: data.filter(result => result.status === 'rejected')
  } : null;

  return {
    data: processedData,
    isLoading,
    isError: error,
    hasErrors: (processedData?.errors?.length || 0) > 0
  };
};

// Hook for PayPal configuration with caching
export const usePayPalConfig = () => {
  const { data, error, isLoading } = useSWR(
    '/api/paypal/config',
    fetcher,
    {
      ...subscriptionSWRConfig,
      // PayPal config rarely changes, cache longer
      dedupingInterval: 60 * 60 * 1000, // 1 hour
      revalidateOnMount: false
    }
  );

  return {
    config: data,
    isLoading,
    isError: error,
    isConfigured: data?.hasClientId && data?.hasClientSecret
  };
};

// Hook for subscription status with real-time updates
export const useSubscriptionStatus = (subscriptionId?: string) => {
  const { data, error, isLoading, mutate } = useSWR(
    subscriptionId ? `/api/subscriptions/${subscriptionId}/status` : null,
    fetcher,
    {
      ...subscriptionSWRConfig,
      // Subscription status needs more frequent updates
      dedupingInterval: 2 * 60 * 1000, // 2 minutes
      refreshInterval: 30 * 1000, // 30 seconds when focused
      refreshWhenHidden: false
    }
  );

  const refreshStatus = async () => {
    try {
      await mutate();
    } catch (error) {
      console.error('Failed to refresh subscription status:', error);
    }
  };

  return {
    status: data?.status || 'unknown',
    subscription: data,
    isLoading,
    isError: error,
    refreshStatus,
    isActive: data?.status === 'ACTIVE',
    isPending: data?.status === 'PENDING' || data?.status === 'APPROVAL_PENDING'
  };
};

// Preload subscription data for better UX
export const preloadSubscriptionData = () => {
  // Preload common subscription endpoints
  const endpoints = [
    '/api/subscriptions/plans',
    '/api/paypal/config'
  ];

  endpoints.forEach(endpoint => {
    fetch(endpoint).catch(() => {
      // Silent fail for preloading
    });
  });
};

// Clear all subscription caches
export const clearSubscriptionCache = () => {
  // This would clear all SWR caches related to subscriptions
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

export default {
  useSubscriptionPlans,
  useSubscriptionAnalytics,
  usePayPalConfig,
  useSubscriptionStatus,
  preloadSubscriptionData,
  clearSubscriptionCache
};