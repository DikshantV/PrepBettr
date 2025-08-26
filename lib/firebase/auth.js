/**
 * Firebase Authentication Helper
 * 
 * Provides proper Firebase Google authentication flow
 * Ensures Firebase ID tokens are generated correctly
 */

import { auth, googleProvider } from '@/firebase/client';
import { signInWithPopup, getIdToken } from 'firebase/auth';

/**
 * Authenticate with Google using Firebase
 * Returns Firebase ID token (not Google OAuth token)
 */
export async function authenticateWithGoogle() {
  if (!auth || !googleProvider) {
    throw new Error('Firebase Auth not initialized');
  }

  try {
    console.log('🔐 Starting Firebase Google authentication...');
    
    // Sign in with Google using Firebase
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    if (!user) {
      throw new Error('No user returned from Google authentication');
    }

    console.log('🔐 Google authentication successful, getting Firebase ID token...');
    
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
  } catch (error) {
    console.error('🔐 Firebase Google authentication failed:', error);
    throw error;
  }
}

/**
 * Sign out from Firebase
 */
export async function signOutFromFirebase() {
  if (!auth) {
    throw new Error('Firebase Auth not initialized');
  }

  try {
    await auth.signOut();
    console.log('🔐 Firebase sign out successful');
  } catch (error) {
    console.error('🔐 Firebase sign out failed:', error);
    throw error;
  }
}

/**
 * Get current Firebase user's ID token
 */
export async function getCurrentUserIdToken(forceRefresh = false) {
  if (!auth?.currentUser) {
    throw new Error('No Firebase user signed in');
  }

  try {
    const idToken = await getIdToken(auth.currentUser, forceRefresh);
    console.log('🔐 Current user ID token obtained');
    return idToken;
  } catch (error) {
    console.error('🔐 Failed to get current user ID token:', error);
    throw error;
  }
}

/**
 * Validate Firebase ID token format
 */
export function validateFirebaseIdToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Firebase ID tokens are JWTs with 3 parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  try {
    // Try to decode the payload (second part)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Firebase ID tokens should have these claims
    return (
      payload.iss && 
      payload.aud && 
      payload.exp && 
      payload.iat &&
      payload.sub &&
      payload.iss.includes('securetoken.google.com')
    );
  } catch {
    return false;
  }
}
