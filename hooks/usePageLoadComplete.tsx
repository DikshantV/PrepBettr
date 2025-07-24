'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to detect when a page has fully loaded
 * Useful for hiding loaders after page navigation
 */
export function usePageLoadComplete() {
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleLoad = () => {
      // Wait a bit more to ensure all components are mounted
      setTimeout(() => {
        setIsPageLoaded(true);
      }, 500);
    };

    const handleBeforeUnload = () => {
      setIsPageLoaded(false);
    };

    // Check if page is already loaded
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
    }

    // Listen for route changes
    const handleRouteChange = () => {
      setIsPageLoaded(false);
      // Set a timeout to mark as loaded after navigation
      setTimeout(() => {
        setIsPageLoaded(true);
      }, 1000);
    };

    // Reset on navigation start
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('load', handleLoad);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [router]);

  return isPageLoaded;
}
