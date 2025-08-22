"use client";

import { useEffect } from 'react';

/**
 * Firebase Client Initialization Component
 * 
 * This component ensures Firebase client environment variables are properly
 * set from Azure Key Vault before Firebase services are used
 */
export default function FirebaseClientInit() {
  useEffect(() => {
    const initializeFirebaseConfig = async () => {
      try {
        // Check if Firebase config is already available
        const hasFirebaseConfig = !!(
          process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY ||
          process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        );

        if (hasFirebaseConfig) {
          console.log('🔥 Firebase client config already available');
          return;
        }

        console.log('🔥 Firebase client config not found, checking Azure Key Vault...');
        
        // Try to fetch from server-side Azure configuration
        const response = await fetch('/api/config/firebase', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const config = await response.json();
          
          // Set client-side environment variables
          if (config.apiKey) {
            (window as any).__NEXT_FIREBASE_API_KEY__ = config.apiKey;
          }
          if (config.projectId) {
            (window as any).__NEXT_FIREBASE_PROJECT_ID__ = config.projectId;
          }
          if (config.authDomain) {
            (window as any).__NEXT_FIREBASE_AUTH_DOMAIN__ = config.authDomain;
          }
          
          console.log('🔥 Firebase client config loaded from server:', {
            hasApiKey: !!config.apiKey,
            projectId: config.projectId,
            authDomain: config.authDomain
          });
        } else {
          console.warn('🔥 Failed to fetch Firebase config from server, using fallback');
        }
      } catch (error) {
        console.error('🔥 Error initializing Firebase client config:', error);
      }
    };

    // Initialize Firebase config on client side only
    if (typeof window !== 'undefined') {
      initializeFirebaseConfig();
    }
  }, []);

  // This component doesn't render anything
  return null;
}
