/**
 * Simplified Firebase Client Configuration
 * 
 * Direct Firebase initialization without complex async patterns
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence, setPersistence, GoogleAuthProvider } from 'firebase/auth';
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

export { auth, db, googleProvider, app };