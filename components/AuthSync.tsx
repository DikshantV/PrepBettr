"use client";

import { useEffect } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { debugFirebaseAuth } from '@/lib/utils/firebase-auth-debug';

export function AuthSync() {
  const { user } = useAuth();

  useEffect(() => {
    async function syncAuth() {
      // Only run in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('=== Auth Sync Debug ===');
        console.log('User from context:', user);
        console.log('Firebase current user:', auth.currentUser);
        
        debugFirebaseAuth();
      }

      // If we have a user from server context but no Firebase user, 
      // there's an authentication mismatch
      if (user && !auth.currentUser) {
        console.warn('Authentication mismatch detected: Server has user but Firebase client does not');
        console.warn('This may cause Firestore permission errors');
        console.warn('User ID from server:', user.id);
        
        // Try to get a fresh token from the server to sync Firebase auth
        try {
          const response = await fetch('/api/auth/sync-firebase');
          if (response.ok) {
            const { customToken } = await response.json();
            if (customToken) {
              await signInWithCustomToken(auth, customToken);
              console.log('Successfully synced Firebase authentication');
            }
          }
        } catch (error) {
          console.error('Failed to sync Firebase authentication:', error);
        }
      }
    }

    // Run auth sync after a short delay to allow Firebase to initialize
    const timer = setTimeout(syncAuth, 1000);
    
    return () => clearTimeout(timer);
  }, [user]);

  return null; // This component doesn't render anything
}
