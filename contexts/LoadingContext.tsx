'use client';

import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import BanterLoader from '@/components/ui/BanterLoader';

interface LoadingContextType {
  isLoading: boolean;
  loadingText: string;
  showLoader: (text?: string, minDuration?: number) => void;
  hideLoader: (force?: boolean) => void;
  setMinimumDuration: (duration: number) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');
  const [minimumDuration, setMinimumDuration] = useState(500); // Minimum 500ms loading time
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showLoader = (text = 'Loading...', minDuration?: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
    
    setLoadingText(text);
    setIsLoading(true);
    startTimeRef.current = Date.now();
    
    if (minDuration !== undefined) {
      setMinimumDuration(minDuration);
    }

    // Safety timeout: force hide after 5 seconds to prevent infinite loading
    safetyTimeoutRef.current = setTimeout(() => {
      console.warn('Loading timeout reached, force hiding loader');
      setIsLoading(false);
      startTimeRef.current = null;
    }, 5000);
  };

  const hideLoader = (force = false) => {
    // Clear safety timeout
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }

    if (force) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsLoading(false);
      startTimeRef.current = null;
      return;
    }

    const elapsedTime = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    const remainingTime = Math.max(0, minimumDuration - elapsedTime);

    if (remainingTime > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        startTimeRef.current = null;
      }, remainingTime);
    } else {
      setIsLoading(false);
      startTimeRef.current = null;
    }
  };

  const value: LoadingContextType = {
    isLoading,
    loadingText,
    showLoader,
    hideLoader,
    setMinimumDuration: (duration: number) => setMinimumDuration(duration)
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {/* Global Loading Overlay */}
      {isLoading && <BanterLoader overlay text={loadingText} />}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};


