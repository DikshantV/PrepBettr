/**
 * Firebase Authentication Helper
 * 
 * Provides proper Firebase Google authentication flow
 * Ensures Firebase ID tokens are generated correctly
 */

import { authenticateWithGoogle as simpleAuthenticateWithGoogle, auth, signOutUser } from '@/firebase/client';
import { getIdToken } from 'firebase/auth';

/**
 * Authenticate with Google using Firebase (with popup-to-redirect fallback)
 * Returns Firebase ID token (not Google OAuth token)
 */
export async function authenticateWithGoogle() {
  // Use the new simplified client with fallback
  return simpleAuthenticateWithGoogle();
}

/**
 * Sign out from Firebase
 */
export async function signOutFromFirebase() {
  return signOutUser();
}

/**
 * Get current Firebase user's ID token
 */
export async function getCurrentUserIdToken(forceRefresh = false) {
  try {
    if (!auth.currentUser) {
      throw new Error('No Firebase user signed in');
    }

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
