"use client";

import { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { initializeFirebaseAsync } from '@/firebase/client';
import { toast } from 'sonner';

// Firebase Context for readiness state
interface FirebaseContextType {
  ready: boolean;
  error: string | null;
}

const FirebaseContext = createContext<FirebaseContextType>({
  ready: false,
  error: null
});

export const useFirebaseReady = () => useContext(FirebaseContext);

/**
 * Firebase Client Initialization Component
 * 
 * This component ensures Firebase client environment variables are properly
 * set from Azure Key Vault before Firebase services are used
 */
export default function FirebaseClientInit({ children }: { children?: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeFirebaseConfig = async () => {
      try {
        console.log('🔥 Starting Firebase initialization process...');
        
        // Check if Firebase config is already available
        const hasFirebaseConfig = !!(
          process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        );
        
        console.log('🔥 Firebase config availability check:', {
          hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          overallAvailable: hasFirebaseConfig
        });

        if (!hasFirebaseConfig) {
          console.log('🔥 Firebase client config not found, fetching from Azure Key Vault...');
          
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firebase config fetch timeout')), 10000)
          );
          
          // Try to fetch from server-side Azure configuration
          const fetchPromise = fetch('/api/config/firebase', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

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
            throw new Error(`Failed to fetch Firebase config: ${response.status}`);
          }
        } else {
          console.log('🔥 Firebase client config already available from environment');
        }
        
        // Initialize Firebase with the available config
        await initializeFirebaseAsync();
        
        // Mark as ready
        setReady(true);
        setError(null);
        console.log('🔥 Firebase initialization completed successfully');
        
      } catch (error) {
        console.error('🔥 Error initializing Firebase:', error);
        const errorMessage = error instanceof Error ? error.message : 'Firebase initialization failed';
        setError(errorMessage);
        setReady(false);
        
        // Show user-friendly error message
        toast.error('Authentication service unavailable. Please refresh the page or try again later.');
      }
    };

    // Initialize Firebase config on client side only
    if (typeof window !== 'undefined') {
      initializeFirebaseConfig();
    }
  }, []);

  // Provide context to children
  return (
    <FirebaseContext.Provider value={{ ready, error }}>
      {children}
    </FirebaseContext.Provider>
  );
}
