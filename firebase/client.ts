/**
 * Firebase Client Configuration
 * 
 * Real Firebase client implementation with configuration from Azure Key Vault
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth as getFirebaseAuth, Auth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
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
  // Try to get from client-side environment variables first (prioritize standard Firebase env var)
  const clientApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  
  // Try to get from window globals (set by server-side fetch)
  const windowApiKey = typeof window !== 'undefined' ? (window as any).__NEXT_FIREBASE_API_KEY__ : null;
  const windowProjectId = typeof window !== 'undefined' ? (window as any).__NEXT_FIREBASE_PROJECT_ID__ : null;
  const windowAuthDomain = typeof window !== 'undefined' ? (window as any).__NEXT_FIREBASE_AUTH_DOMAIN__ : null;
  
  console.log('🔥 Firebase config source check:', {
    clientApiKey: clientApiKey ? 'found' : 'missing',
    projectId: projectId || 'missing',
    authDomain: authDomain || 'missing',
    windowApiKey: windowApiKey ? 'found' : 'missing',
    windowProjectId: windowProjectId || 'missing',
    windowAuthDomain: windowAuthDomain || 'missing'
  });
  
  // Determine final values
  const finalApiKey = clientApiKey || windowApiKey || '';
  const finalProjectId = projectId || windowProjectId || 'prepbettr';
  const finalAuthDomain = authDomain || windowAuthDomain || `${finalProjectId}.firebaseapp.com`;
  
  const config = {
    apiKey: finalApiKey,
    authDomain: finalAuthDomain,
    projectId: finalProjectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${finalProjectId}.appspot.com`,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
  };

  // Validate that we have the minimum required config
  const validationErrors = [];
  if (!config.projectId) {
    validationErrors.push('projectId is required');
  }
  if (!config.apiKey) {
    validationErrors.push('apiKey is required');
  }
  if (!config.authDomain) {
    validationErrors.push('authDomain is required');
  }
  
  if (validationErrors.length > 0) {
    console.error('🔥 Firebase configuration missing required fields:', validationErrors);
    console.error('🔥 Current config:', {
      projectId: config.projectId || 'MISSING',
      authDomain: config.authDomain || 'MISSING',
      hasApiKey: !!config.apiKey,
      apiKeyPreview: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : 'MISSING'
    });
    return null;
  }

  console.log('🔥 Firebase config loaded successfully:', {
    projectId: config.projectId,
    authDomain: config.authDomain,
    hasApiKey: !!config.apiKey,
    apiKeyPreview: config.apiKey.substring(0, 10) + '...',
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
    console.log('🔥 Firebase already initialized, skipping duplicate initialization');
    return;
  }
  
  console.log('🔥 Starting Firebase initialization (client-side)...');

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
let initializationInProgress = false;

// Initialize Firebase manually (not on module load)
export async function initializeFirebaseAsync(): Promise<void> {
  if (firebaseReady) {
    console.log('🔥 Firebase already ready, skipping initialization');
    return;
  }
  
  if (initializationInProgress) {
    console.log('🔥 Firebase initialization already in progress, waiting...');
    // Wait for initialization to complete
    while (initializationInProgress && !firebaseReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }
  
  initializationInProgress = true;
  console.log('🔥 Starting Firebase async initialization...');
  
  try {
    // Call the internal initialization without using getters
    await initializeFirebaseInternal();
  } finally {
    initializationInProgress = false;
  }
  
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

// Wait for Firebase initialization with timeout
async function waitForFirebaseReady(timeoutMs = 10000): Promise<void> {
  if (firebaseReady) return;
  
  let elapsed = 0;
  const checkInterval = 100;
  
  return new Promise((resolve, reject) => {
    const checkReady = () => {
      if (firebaseReady) {
        resolve();
      } else if (elapsed >= timeoutMs) {
        reject(new Error('Firebase initialization timeout'));
      } else {
        elapsed += checkInterval;
        setTimeout(checkReady, checkInterval);
      }
    };
    checkReady();
  });
}

// Authentication helper with popup-to-redirect fallback
export async function authenticateWithGoogle(): Promise<{
  user: any;
  idToken: string;
}> {
  // Wait for Firebase to be ready before attempting authentication
  try {
    console.log('🔐 Waiting for Firebase to be ready...');
    await waitForFirebaseReady();
    console.log('🔐 Firebase is ready, proceeding with authentication');
  } catch (error) {
    console.error('🔐 Firebase initialization timeout:', error);
    throw new Error('Firebase services are not available. Please refresh the page and try again.');
  }
  
  const authInstance = getAuth();
  const provider = getGoogleProvider();
  
  if (!authInstance || !provider) {
    throw new Error('Firebase Auth not initialized');
  }

  try {
    console.log('🔐 Starting Firebase Google authentication with popup...');
    console.log('🔐 Auth instance config:', {
      app: authInstance.app?.name,
      config: authInstance.app?.options,
      currentUser: authInstance.currentUser?.uid || 'none'
    });
    console.log('🔐 Provider config:', {
      providerId: provider.providerId,
      scopes: provider.scopes || [],
      customParameters: provider.customParameters || {}
    });
    
    // Skip connectivity test - Firebase SDK will handle network issues internally
    console.log('🔐 Proceeding with Firebase authentication...');
    
    // Try popup sign-in first
    const result = await signInWithPopup(authInstance, provider);
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
    console.error('🔐 Popup sign-in failed with error:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Full error object:', error);
    console.error('Error constructor:', error.constructor.name);
    
    // Handle network request failed specifically
    if (error.code === 'auth/network-request-failed') {
      console.error('🔐 Network request failed - this usually indicates:');
      console.error('  1. Domain not authorized in Firebase console (MOST COMMON)');
      console.error('  2. Firebase project configuration issue');
      console.error('  3. Network connectivity problems');
      console.error('  4. Firewall blocking Firebase servers');
      console.error('');
      console.error('🔧 TO FIX THIS ISSUE:');
      console.error('  1. Go to https://console.firebase.google.com/');
      console.error('  2. Select project: prepbettr');
      console.error('  3. Go to Authentication > Settings > Authorized domains');
      console.error('  4. Add these domains: localhost, localhost:3000, 127.0.0.1:3000');
      console.error('  5. Save and wait 2-3 minutes for changes to propagate');
      console.error('');
      
      throw new Error('Authentication failed: Domain not authorized. Please add localhost:3000 to your Firebase project\'s authorized domains in the Firebase Console. See browser console for detailed instructions.');
    }
    
    // Check if error indicates popup was blocked or other popup-related issues
    if (error.code === 'auth/popup-blocked' || 
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request' ||
        error.code === 'auth/internal-error' ||
        error.message?.includes('popup')) {
      
      console.log('🔐 Popup authentication failed, trying redirect sign-in as fallback...');
      console.log('🔐 Error was:', error.code, error.message);
      
      try {
        // Use redirect as fallback for popup issues
        console.log('🔐 Initiating redirect sign-in...');
        await signInWithRedirect(authInstance, provider);
        // This will redirect the page, so we won't reach this point normally
        // The redirect result will be handled on page load by handleRedirectResult
        console.log('🔐 Redirect initiated successfully');
        return Promise.reject(new Error('REDIRECT_IN_PROGRESS'));
      } catch (redirectError: any) {
        console.error('🔐 Redirect sign-in also failed:', redirectError);
        // If both popup and redirect fail, throw a user-friendly error
        throw new Error('Authentication failed. Please try again or check your browser settings.');
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
  const authInstance = getAuth();
  
  if (!authInstance) {
    throw new Error('Firebase Auth not initialized');
  }

  try {
    console.log('🔐 Checking for redirect result...');
    const result = await getRedirectResult(authInstance);
    
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
  const authInstance = getAuth();
  
  if (!authInstance) {
    throw new Error('Firebase Auth not initialized');
  }

  try {
    await signOut(authInstance);
    console.log('🔐 Firebase sign out successful');
  } catch (error) {
    console.error('🔐 Firebase sign out failed:', error);
    throw error;
  }
}

// Export default for backward compatibility
export default {
  auth,
  db,
  googleProvider,
  app
};
