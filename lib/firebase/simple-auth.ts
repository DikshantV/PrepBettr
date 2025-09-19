/**
 * Redirect-based Firebase Authentication Helper
 * 
 * Uses signInWithRedirect to avoid popup-related auth/internal-error issues
 */

import { signInWithRedirect, getRedirectResult, getIdToken, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/firebase/client';

/**
 * Authenticate with Google using Firebase redirect flow
 * This avoids popup-related auth/internal-error issues
 */
export async function authenticateWithGoogleRedirect() {
  try {
    console.log('🔐 Starting Firebase Google authentication (redirect)...');
    
    const authInstance = auth();
    const providerInstance = googleProvider();
    
    if (!authInstance) {
      throw new Error('Firebase Auth not initialized');
    }
    
    if (!providerInstance) {
      throw new Error('Google Auth Provider not initialized');
    }
    
    console.log('🔐 Firebase Auth instance available:', !!authInstance);
    console.log('🔐 Google Provider instance available:', !!providerInstance);
    
    // Use redirect instead of popup to avoid auth/internal-error
    await signInWithRedirect(authInstance, providerInstance);
    
    // User will be redirected to Google and back
    // The result is handled by handleRedirectResult
    
  } catch (error) {
    console.error('🔐 Firebase Google redirect authentication failed:', error);
    throw error;
  }
}

/**
 * Handle redirect result after user returns from Google OAuth
 */
export async function handleRedirectResult() {
  try {
    console.log('🔐 Checking for redirect result...');
    
    const authInstance = auth();
    if (!authInstance) {
      throw new Error('Firebase Auth not initialized');
    }
    
    const result = await getRedirectResult(authInstance);
    
    if (result) {
      const user = result.user;
      
      console.log('🔐 Redirect authentication successful, getting Firebase ID token...');
      
      // Get Firebase ID token (this is crucial - not Google OAuth token)
      const idToken = await getIdToken(user, true); // Force refresh to ensure fresh token
      
      console.log('🔐 Firebase ID token obtained successfully');
      console.log('🔐 Token preview:', idToken.substring(0, 50) + '...');
      
      // Validate token format (Firebase ID tokens are JWT)
      if (!idToken.includes('.')) {
        throw new Error('Invalid Firebase ID token format - not a JWT');
      }
      
      return {
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        },
        idToken
      };
    } else {
      console.log('🔐 No redirect result found');
      return null;
    }
  } catch (error) {
    console.error('🔐 Redirect result handling failed:', error);
    throw error;
  }
}

/**
 * Fallback: Try popup first, then redirect if popup fails with internal-error
 */
export async function authenticateWithGoogleFallback() {
  try {
    console.log('🔐 Trying popup authentication first...');
    
    const authInstance = auth();
    const providerInstance = googleProvider();
    
    if (!authInstance || !providerInstance) {
      throw new Error('Firebase Auth not initialized');
    }
    
    // Try popup first
    const result = await signInWithPopup(authInstance, providerInstance);
    const user = result.user;
    
    if (!user) {
      throw new Error('No user returned from Google authentication');
    }
    
    console.log('🔐 Popup authentication successful, getting Firebase ID token...');
    
    // Get Firebase ID token
    const idToken = await getIdToken(user, true);
    
    console.log('🔐 Firebase ID token obtained successfully');
    console.log('🔐 Token preview:', idToken.substring(0, 50) + '...');
    
    return {
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified
      },
      idToken
    };
    
  } catch (error: any) {
    console.warn('🔐 Popup authentication failed:', error?.code || error?.message);
    
    // Check if it's the dreaded auth/internal-error or popup issues
    if (error?.code === 'auth/internal-error' || 
        error?.code === 'auth/popup-blocked' || 
        error?.code === 'auth/popup-closed-by-user' ||
        error?.message?.includes('popup')) {
      
      console.log('🔐 Falling back to redirect authentication...');
      
      // Fall back to redirect
      await authenticateWithGoogleRedirect();
      return { redirected: true }; // Signal that user was redirected
    } else {
      // Re-throw other errors
      throw error;
    }
  }
}

/**
 * Sign out from Firebase (simplified)
 */
export async function signOutFromFirebaseSimple() {
  try {
    const authInstance = auth();
    if (!authInstance) {
      throw new Error('Firebase Auth not initialized');
    }
    
    await authInstance.signOut();
    console.log('🔐 Firebase sign out successful');
  } catch (error) {
    console.error('🔐 Firebase sign out failed:', error);
    throw error;
  }
}
