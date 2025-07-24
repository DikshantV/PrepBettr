'use client';

import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  loadingText: string;
  showLoader: (text?: string, minDuration?: number) => void;
  hideLoader: (force?: boolean) => void;
  setMinimumDuration: (duration: number) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// Unused LoadingProvider - moved to trash
export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');
  const minDurationTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number | null>(null);
  const hideRequested = useRef<boolean>(false);

  const showLoader = (text: string = 'Loading...', minDuration: number = 2000) => {
    console.log('🐉 🔄 ShowLoader called:', text, 'minDuration:', minDuration);
    console.log('🐉 🔄 Current state before show:', { isLoading, loadingText });
    console.log('🐉 🔄 Call stack:', new Error().stack);
    
    setLoadingText(text);
    setIsLoading(true);
    startTime.current = Date.now();
    hideRequested.current = false;
    
    console.log('🐉 🔄 Loader state set to true, text:', text);
    
    // Clear any existing timer
    if (minDurationTimer.current) {
      console.log('🐉 🔄 Clearing existing timer');
      clearTimeout(minDurationTimer.current);
    }
    
    // Set minimum duration (reduced default to 2 seconds)
    minDurationTimer.current = setTimeout(() => {
      console.log('🐉 🔄 Minimum duration reached after', minDuration, 'ms');
      minDurationTimer.current = null;
      // If hide was requested during minimum duration, hide now
      if (hideRequested.current) {
        console.log('🐉 🔄 Hide was requested during minimum duration, hiding now');
        setIsLoading(false);
      } else {
        console.log('🐉 🔄 No hide request pending, loader will continue showing');
      }
    }, minDuration);
    
    console.log('🐉 🔄 ShowLoader setup complete');
  };

  const hideLoader = (force: boolean = false) => {
    const elapsed = startTime.current ? Date.now() - startTime.current : 0;
    console.log('🐉 HideLoader called, elapsed:', elapsed, 'force:', force);
    
    hideRequested.current = true;
    
    // If force is true or minimum duration has passed, hide immediately
    if (force || !minDurationTimer.current) {
      console.log('🐉 Hiding loader immediately');
      if (minDurationTimer.current) {
        clearTimeout(minDurationTimer.current);
        minDurationTimer.current = null;
      }
      setIsLoading(false);
    } else {
      console.log('🐉 Hide requested but minimum duration not reached, will hide when timer expires');
    }
  };

  const setMinimumDuration = (duration: number) => {
    console.log('🐉 SetMinimumDuration called:', duration);
    if (minDurationTimer.current) {
      clearTimeout(minDurationTimer.current);
    }
    
    minDurationTimer.current = setTimeout(() => {
      console.log('🐉 SetMinimumDuration timer expired');
      minDurationTimer.current = null;
    }, duration);
  };

  return (
    <LoadingContext.Provider value={{ 
      isLoading, 
      loadingText, 
      showLoader, 
      hideLoader, 
      setMinimumDuration 
    }}>
      {children}
    </LoadingContext.Provider>
  );
}

// Unused useLoading hook - moved to trash
export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
