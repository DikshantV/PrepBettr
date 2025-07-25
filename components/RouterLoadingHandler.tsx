'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLoading } from '@/contexts/LoadingContext';

export const RouterLoadingHandler = () => {
  const { showLoader, hideLoader } = useLoading();

  useEffect(() => {
    let navigationTimer: NodeJS.Timeout | null = null;

    // Listen for browser navigation (back/forward buttons)
    const handlePopState = () => {
      showLoader('Loading page...', 500);
      
      // Auto-hide after a maximum time to prevent infinite loading
      navigationTimer = setTimeout(() => {
        hideLoader(true); // Force hide
      }, 3000); // 3 seconds max
    };

    // Listen for page load completion
    const handleLoad = () => {
      if (navigationTimer) {
        clearTimeout(navigationTimer);
      }
      hideLoader();
    };

    // Listen for DOM content loaded (faster than full load)
    const handleDOMContentLoaded = () => {
      if (navigationTimer) {
        clearTimeout(navigationTimer);
      }
      hideLoader();
    };

    // Only listen to popstate for browser navigation
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('load', handleLoad);
    window.addEventListener('DOMContentLoaded', handleDOMContentLoaded);

    // Clean up on unmount
    return () => {
      if (navigationTimer) {
        clearTimeout(navigationTimer);
      }
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('load', handleLoad);
      window.removeEventListener('DOMContentLoaded', handleDOMContentLoaded);
    };
  }, [showLoader, hideLoader]);

  return null;
};
