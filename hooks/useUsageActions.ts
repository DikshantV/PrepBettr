"use client";

import { useState } from "react";
import { useUsage } from "@/contexts/UsageContext";
import { UserUsageCounters } from "@/types/subscription";
import { toast } from "sonner";

interface UseUsageActionsReturn {
  checkUsage: (feature: keyof UserUsageCounters) => Promise<boolean>;
  incrementUsage: (feature: keyof UserUsageCounters) => Promise<boolean>;
  incrementUsageOptimistic: (feature: keyof UserUsageCounters) => void;
  canUseFeature: (feature: keyof UserUsageCounters) => boolean;
  getRemainingCount: (feature: keyof UserUsageCounters) => number;
  isCheckingUsage: boolean;
}

/**
 * Hook that provides both real-time usage data and server-side usage actions
 */
export function useUsageActions(): UseUsageActionsReturn {
  const { 
    usage, 
    canUseFeature, 
    getRemainingCount, 
    incrementUsageOptimistic 
  } = useUsage();
  
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  /**
   * Check if user can use a feature by calling the server
   */
  const checkUsage = async (feature: keyof UserUsageCounters): Promise<boolean> => {
    try {
      setIsCheckingUsage(true);
      
      const response = await fetch('/api/usage/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feature }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to check usage');
        return false;
      }

      return data.canUse;
    } catch (error) {
      console.error('Error checking usage:', error);
      toast.error('Failed to check usage');
      return false;
    } finally {
      setIsCheckingUsage(false);
    }
  };

  /**
   * Increment usage counter on the server
   */
  const incrementUsage = async (feature: keyof UserUsageCounters): Promise<boolean> => {
    try {
      const response = await fetch('/api/usage/increment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feature }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast.error(`You've reached your ${feature} limit. Upgrade your plan for more usage.`);
        } else {
          toast.error(data.error || 'Failed to update usage');
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error incrementing usage:', error);
      toast.error('Failed to update usage');
      return false;
    }
  };

  /**
   * Combined function that checks usage, increments optimistically, and syncs with server
   */
  const useFeatureWithUsageTracking = async (
    feature: keyof UserUsageCounters,
    action: () => Promise<void>
  ): Promise<boolean> => {
    // First check if user can use the feature
    if (!canUseFeature(feature)) {
      toast.error(`You've reached your ${feature} limit. Upgrade your plan for more usage.`);
      return false;
    }

    // Increment optimistically for immediate UI feedback
    incrementUsageOptimistic(feature);

    try {
      // Execute the actual feature action
      await action();

      // Sync with server in the background (no need to wait for this)
      incrementUsage(feature).catch(err => {
        console.error('Failed to sync usage with server:', err);
        // Note: We don't revert the optimistic update here since the action was successful
        // The real-time listener will eventually sync the correct state from Firestore
      });

      return true;
    } catch (error) {
      console.error('Feature action failed:', error);
      
      // Since the action failed, we need to revert the optimistic update
      // This would ideally be handled by the UsageContext, but for now we can show an error
      toast.error('Action failed. Usage counter will be corrected.');
      
      return false;
    }
  };

  return {
    checkUsage,
    incrementUsage,
    incrementUsageOptimistic,
    canUseFeature,
    getRemainingCount,
    isCheckingUsage,
  };
}
