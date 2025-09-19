/**
 * Firebase Client Configuration
 * 
 * Real Firebase client implementation with configuration from Azure Key Vault
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth as getFirebaseAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

// Get Firebase configuration from various sources
function getFirebaseConfig(): FirebaseConfig | null {
  // Try to get from client-side environment variables first
  const clientApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  
  // Try to get from window globals (set by server-side fetch)
  const windowApiKey = typeof window !== 'undefined' ? (window as any).__NEXT_FIREBASE_API_KEY__ : null;
  const windowProjectId = typeof window !== 'undefined' ? (window as any).__NEXT_FIREBASE_PROJECT_ID__ : null;
  const windowAuthDomain = typeof window !== 'undefined' ? (window as any).__NEXT_FIREBASE_AUTH_DOMAIN__ : null;
  
  // Determine final values
  const finalApiKey = clientApiKey || windowApiKey || '';
  const finalProjectId = projectId || windowProjectId || 'prepbettr';
  const finalAuthDomain = windowAuthDomain || `${finalProjectId}.firebaseapp.com`;
  
  const config = {
    apiKey: finalApiKey,
    authDomain: finalAuthDomain,
    projectId: finalProjectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${finalProjectId}.appspot.com`,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
  };

  // Validate that we have the minimum required config
  if (!config.projectId) {
    console.error('Firebase configuration missing: projectId is required');
    return null;
  }

  console.log('🔥 Firebase config loaded:', {
    projectId: config.projectId,
    authDomain: config.authDomain,
    hasApiKey: !!config.apiKey,
    storageBucket: config.storageBucket,
    source: {
      apiKey: clientApiKey ? 'env' : (windowApiKey ? 'server' : 'none'),
      projectId: projectId ? 'env' : (windowProjectId ? 'server' : 'fallback')
    }
  });

  return config;
}

// Initialize Firebase app
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

async function initializeFirebaseInternal() {
  // Only initialize on client side
  if (typeof window === 'undefined') {
    console.log('🔥 Firebase initialization skipped on server side');
    return;
  }

  // Don't initialize if already done
  if (app) {
    return;
  }

  try {
    const firebaseConfig = getFirebaseConfig();
    
    if (!firebaseConfig) {
      console.error('🔥 Firebase initialization failed: missing configuration');
      return;
    }

    // Check if Firebase app is already initialized
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
      console.log('🔥 Using existing Firebase app');
    } else {
      // Initialize Firebase app
      app = initializeApp(firebaseConfig);
      console.log('🔥 Firebase app initialized successfully');
    }

    // Initialize Firebase services directly (not through getters)
    auth = getFirebaseAuth(app);
    db = getFirestore(app);
    
    // Initialize Google Auth Provider
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    googleProvider.addScope('profile');
    googleProvider.addScope('email');

    console.log('🔥 Firebase services initialized:', {
      auth: !!auth,
      firestore: !!db,
      googleProvider: !!googleProvider
    });

  } catch (error) {
    console.error('🔥 Firebase initialization error:', error);
    throw error; // Don't create fallback mocks, let the error propagate
  }
}

// Firebase readiness state
let firebaseReady = false;

// Initialize Firebase manually (not on module load)
export async function initializeFirebaseAsync(): Promise<void> {
  if (firebaseReady) {
    return;
  }
  
  // Call the internal initialization without using getters
  await initializeFirebaseInternal();
  
  if (auth && googleProvider) {
    firebaseReady = true;
    // Dispatch ready event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firebase-ready'));
      (window as any).__FIREBASE_READY__ = true;
    }
    console.log('🔥 Firebase services are now ready');
  }
}

// Getters that check readiness
function getAuth() {
  if (!firebaseReady) {
    throw new Error('Firebase Auth not ready. Please wait for initialization to complete.');
  }
  return auth;
}

function getGoogleProvider() {
  if (!firebaseReady) {
    throw new Error('Google Auth Provider not ready. Please wait for initialization to complete.');
  }
  return googleProvider;
}

function getDb() {
  if (!firebaseReady) {
    throw new Error('Firestore not ready. Please wait for initialization to complete.');
  }
  return db;
}

function getApp() {
  if (!firebaseReady) {
    throw new Error('Firebase App not ready. Please wait for initialization to complete.');
  }
  return app;
}

// Export getters and readiness checker
export { getAuth as auth, getDb as db, getGoogleProvider as googleProvider, getApp as app };
export const isFirebaseReady = () => firebaseReady;

// Export default for backward compatibility
export default {
  auth,
  db,
  googleProvider,
  app
};
