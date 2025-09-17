"use client";

import { useEffect } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, isFirebaseReady } from '@/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugFirebaseAuth } from '@/lib/utils/firebase-auth-debug';
import { useFirebaseReady } from '@/components/FirebaseClientInit';

export function AuthSync() {
  const { user } = useAuth();
  const { ready: firebaseReady, error: firebaseError } = useFirebaseReady();

  useEffect(() => {
    async function syncAuth() {
      // Don't run if Firebase is not ready
      if (!firebaseReady) {
        console.log('AuthSync: Firebase not ready, skipping sync');
        return;
      }
      
      if (firebaseError) {
        console.error('AuthSync: Firebase error, skipping sync:', firebaseError);
        return;
      }
      
      try {
        // Get Firebase auth service safely
        const authService = auth();
        
        // Only run in development for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('=== Auth Sync Debug ===');
          console.log('User from context:', user);
          console.log('Firebase current user:', authService?.currentUser);
          
          debugFirebaseAuth(authService);
        }

        // If we have a user from server context but no Firebase user, 
        // there's an authentication mismatch
        if (user && authService && !authService.currentUser) {
          console.warn('Authentication mismatch detected: Server has user but Firebase client does not');
          console.warn('This may cause Firestore permission errors');
          console.warn('User ID from server:', user.uid);
          
          // Try to get a fresh token from the server to sync Firebase auth
          try {
            const response = await fetch('/api/auth/sync-firebase');
            if (response.ok) {
              const { customToken } = await response.json();
              if (customToken) {
                await signInWithCustomToken(authService, customToken);
                console.log('Successfully synced Firebase authentication');
              }
            }
          } catch (error) {
            console.error('Failed to sync Firebase authentication:', error);
          }
        }
      } catch (error) {
        console.error('AuthSync: Firebase service access error:', error);
      }
    }

    // Run auth sync after a short delay to allow Firebase to initialize
    const timer = setTimeout(syncAuth, 1000);
    
    return () => clearTimeout(timer);
  }, [user, firebaseReady, firebaseError]);

  return null; // This component doesn't render anything
}
