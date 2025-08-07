"use client";

import { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { toast } from 'sonner';

interface SWRProviderProps {
  children: ReactNode;
}

// Global SWR configuration
const swrConfig = {
  // Cache data for 5 minutes by default
  dedupingInterval: 5 * 60 * 1000,
  
  // Revalidate on focus after 30 seconds
  focusThrottleInterval: 30 * 1000,
  
  // Revalidate on reconnect
  revalidateOnReconnect: true,
  
  // Don't revalidate on focus for real-time data (we have listeners)
  revalidateOnFocus: false,
  
  // Retry failed requests up to 3 times
  errorRetryCount: 3,
  
  // Exponential backoff for retries
  errorRetryInterval: 1000,
  
  // Show loading states quickly
  loadingTimeout: 3000,
  
  // Global error handler
  onError: (error: any, key: string) => {
    console.error('SWR Error:', { error, key });
    
    // Don't show toast errors for auth-related issues or expected errors
    if (error?.code === 'permission-denied' || error?.message?.includes('auth')) {
      return;
    }
    
    // Show user-friendly error messages
    if (error?.message) {
      toast.error('Something went wrong', {
        description: 'Please try again in a moment.'
      });
    }
  },
  
  // Global success handler for mutations
  onSuccess: (data: any, key: string) => {
    // You can add global success handling here if needed
    // For now, we'll handle success per component
  },
  
  // Fallback data while loading
  fallback: {},
  
  // Keep data fresh in background
  revalidateIfStale: true,
  
  // Keep previous data while revalidating
  keepPreviousData: true,
  
  // Use suspense for better loading states
  suspense: false, // We'll handle loading states manually for better control
};

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig value={swrConfig}>
      {children}
    </SWRConfig>
  );
}

// Utility function to create optimistic updates
export function createOptimisticUpdate<T>(
  currentData: T[],
  newItem: T,
  getId: (item: T) => string,
  action: 'add' | 'update' | 'delete'
): T[] {
  const id = getId(newItem);
  
  switch (action) {
    case 'add':
      return [newItem, ...currentData];
      
    case 'update':
      return currentData.map(item => 
        getId(item) === id ? { ...item, ...newItem } : item
      );
      
    case 'delete':
      return currentData.filter(item => getId(item) !== id);
      
    default:
      return currentData;
  }
}

// Utility function for cache invalidation patterns
export const cacheKeys = {
  userInterviews: (userId: string) => `user-interviews/${userId}`,
  publicInterviews: (userId: string) => `public-interviews/${userId}`,
  interview: (interviewId: string) => `interviews/${interviewId}`,
  feedback: (interviewId: string, userId: string) => `feedback/${interviewId}/${userId}`,
  userProfile: (userId: string) => `users/${userId}`,
  applicationStatus: (applicationId: string) => `applicationStatuses/${applicationId}`,
};
