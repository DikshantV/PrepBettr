/**
 * Simplified Firebase Client Configuration
 * 
 * Direct Firebase initialization without complex async patterns
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence, setPersistence, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

console.log('🔥 Firebase config debug:', {
  hasApiKey: !!firebaseConfig.apiKey,
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKeyPreview: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'MISSING',
  nodeEnv: process.env.NODE_ENV,
  allEnvKeys: typeof window !== 'undefined' ? 'client-side' : 'server-side'
});

// Validate required config
const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingKeys.length > 0) {
  const error = `Missing Firebase config: ${missingKeys.join(', ')}`;
  console.error('🔥 Firebase config error:', error);
  throw new Error(error);
}

// Expose config to window for debugging (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__FIREBASE_CONFIG__ = firebaseConfig;
  console.log('🔥 Firebase config exposed to window.__FIREBASE_CONFIG__ for debugging');
}

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('🔥 Firebase app initialized');
} else {
  app = getApps()[0];
  console.log('🔥 Using existing Firebase app');
}

// Initialize Auth with robust persistence fallback (handles Safari Private Mode / IndexedDB issues)
let auth;
try {
  // Try to use initializeAuth with persistence fallback
  const existingAuth = getApps().length > 0 ? getAuth(app) : null;
  if (existingAuth) {
    auth = existingAuth;
    console.log('🔥 Using existing Firebase Auth instance');
  } else {
    // Initialize with persistence fallback
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    });
    console.log('🔥 Initialized Firebase Auth with persistence fallback');
  }
} catch (e) {
  console.warn('🔥 Auth initializeAuth failed, using default getAuth():', e);
  auth = getAuth(app);
}

// Initialize Firestore
const db = getFirestore(app);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
googleProvider.addScope('profile');
googleProvider.addScope('email');

console.log('🔥 Firebase services ready:', {
  auth: !!auth,
  firestore: !!db,
  googleProvider: !!googleProvider
});

// Authentication helper with popup-to-redirect fallback
export async function authenticateWithGoogle(): Promise<{
  user: any;
  idToken: string;
}> {
  try {
    console.log('🔐 Starting Firebase Google authentication with popup...');
    
    // Try popup sign-in first
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    if (!user) {
      throw new Error('No user returned from Google authentication');
    }

    console.log('🔐 Popup authentication successful, getting Firebase ID token...');
    
    // Get Firebase ID token
    const idToken = await user.getIdToken(true); // Force refresh to ensure fresh token
    
    console.log('🔐 Firebase ID token obtained successfully');
    
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
    console.warn('🔐 Popup sign-in failed:', error.message);
    
    // Check if error indicates popup was blocked or other popup-related issues
    if (error.code === 'auth/popup-blocked' || 
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request' ||
        error.code === 'auth/internal-error' ||
        error.message?.includes('popup')) {
      
      console.log('🔐 Falling back to redirect sign-in...');
      
      try {
        // Use redirect as fallback
        await signInWithRedirect(auth, googleProvider);
        // This will redirect the page, so we won't reach this point
        // The redirect result will be handled on page load
        return Promise.reject(new Error('REDIRECT_IN_PROGRESS'));
      } catch (redirectError: any) {
        console.error('🔐 Redirect sign-in also failed:', redirectError);
        throw redirectError;
      }
    }
    
    // Re-throw non-popup-related errors
    throw error;
  }
}

// Handle redirect result on page load
export async function handleRedirectResult(): Promise<{
  user: any;
  idToken: string;
} | null> {
  try {
    console.log('🔐 Checking for redirect result...');
    const result = await getRedirectResult(auth);
    
    if (!result || !result.user) {
      console.log('🔐 No redirect result found');
      return null;
    }

    console.log('🔐 Redirect authentication successful, getting Firebase ID token...');
    
    const user = result.user;
    const idToken = await user.getIdToken(true);
    
    console.log('🔐 Firebase ID token obtained from redirect result');
    
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
    console.error('🔐 Error handling redirect result:', error);
    return null;
  }
}

// Sign out helper
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
    console.log('🔐 Firebase sign out successful');
  } catch (error) {
    console.error('🔐 Firebase sign out failed:', error);
    throw error;
  }
}

// Check if Firebase is ready
export function isFirebaseReady(): boolean {
  return !!(auth && db && googleProvider);
}

// Initialize Firebase asynchronously (for compatibility with existing code)
export async function initializeFirebaseAsync(): Promise<void> {
  // Firebase is already initialized synchronously above
  // This function exists for compatibility with existing FirebaseClientInit component
  if (!isFirebaseReady()) {
    throw new Error('Firebase failed to initialize');
  }
  
  // Mark as ready in window for debugging
  if (typeof window !== 'undefined') {
    (window as any).__FIREBASE_READY__ = true;
  }
  
  console.log('🔥 Firebase async initialization complete');
}

export { auth, db, googleProvider, app };
