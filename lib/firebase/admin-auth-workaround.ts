/**
 * Temporary Firebase Admin Auth Workaround
 * 
 * Uses Firebase Admin SDK to bypass client-side auth issues
 */

import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/firebase/simple-client';

export async function createCustomAuthToken() {
  try {
    // Call your API to create a custom token
    const response = await fetch('/api/auth/create-custom-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: `google-${Date.now()}`, // Temporary UID
        email: 'temp@example.com', // This will be replaced by proper flow
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create custom token');
    }

    const { customToken } = await response.json();
    return customToken;
  } catch (error) {
    console.error('Failed to create custom token:', error);
    throw error;
  }
}

export async function signInWithCustomTokenWorkaround() {
  try {
    if (!auth) {
      throw new Error('Firebase Auth not initialized');
    }

    console.log('🔐 Using custom token workaround...');
    
    const customToken = await createCustomAuthToken();
    const userCredential = await signInWithCustomToken(auth, customToken);
    
    const idToken = await userCredential.user.getIdToken();
    
    return {
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: userCredential.user.displayName,
        photoURL: userCredential.user.photoURL,
        emailVerified: userCredential.user.emailVerified,
      },
      idToken,
    };
  } catch (error) {
    console.error('Custom token auth failed:', error);
    throw error;
  }
}