/**
 * Simplified Firebase Authentication Helper
 * 
 * Direct Firebase integration without complex initialization patterns
 */

import { signInWithPopup, getIdToken } from 'firebase/auth';
import { auth, googleProvider } from '@/firebase/simple-client';

/**
 * Authenticate with Google using Firebase (simplified approach)
 * Returns Firebase ID token (not Google OAuth token)
 */
export async function authenticateWithGoogleSimple() {
  try {
    console.log('🔐 Starting simplified Firebase Google authentication...');
    
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }
    
    if (!googleProvider) {
      throw new Error('Google Auth Provider not initialized');
    }
    
    console.log('🔐 Firebase Auth instance available:', !!auth);
    console.log('🔐 Google Provider instance available:', !!googleProvider);
    
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
    console.error('🔐 Simplified Firebase Google authentication failed:', error);
    throw error;
  }
}

/**
 * Sign out from Firebase (simplified)
 */
export async function signOutFromFirebaseSimple() {
  try {
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }
    
    await auth.signOut();
    console.log('🔐 Firebase sign out successful');
  } catch (error) {
    console.error('🔐 Firebase sign out failed:', error);
    throw error;
  }
}