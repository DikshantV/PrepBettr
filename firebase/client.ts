import { getFirestore } from "firebase/firestore";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// State for Firebase instances
let app: any = null;
let auth: any = null;
let db: any = null;
let isInitialized = false;
let isInitializing = false;

// Function to fetch Firebase config from API
async function fetchFirebaseConfig() {
  try {
    const response = await fetch('/api/config/firebase');
    if (!response.ok) {
      throw new Error('Failed to fetch Firebase config');
    }
    const config = await response.json();
    if (!config.hasKey) {
      throw new Error('Firebase client key not available');
    }
    return config;
  } catch (error) {
    console.warn('Failed to fetch Firebase config from API:', error);
    return null;
  }
}

// Function to get Firebase config dynamically
function getStaticFirebaseConfig() {
  // Fall back to build-time environment variable (for development)
  const buildTimeKey = process.env.NEXT_PUBLIC_FIREBASE_CLIENT_KEY;
  
  return {
    apiKey: buildTimeKey || "mock-key-for-build-time",
    authDomain: "prepbettr.firebaseapp.com",
    projectId: "prepbettr",
    storageBucket: "prepbettr.firebasestorage.app",
    messagingSenderId: "660242808945",
    appId: "1:660242808945:web:4edbaac82ed140f4d05bd0",
    measurementId: "G-LF6KN9F2HY"
  };
}

// Initialize Firebase with dynamic configuration
async function initializeFirebase() {
  if (isInitialized) return { app, auth, db };
  if (isInitializing) {
    // Wait for ongoing initialization
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { app, auth, db };
  }
  
  isInitializing = true;
  
  try {
    let firebaseConfig;
    
    // Try to fetch config from API first (for production)
    if (typeof window !== 'undefined') {
      firebaseConfig = await fetchFirebaseConfig();
    }
    
    // Fall back to static config if API fails
    if (!firebaseConfig) {
      firebaseConfig = getStaticFirebaseConfig();
    }
    
    // Check if we have a valid API key (not the build-time mock)
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "mock-key-for-build-time") {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      auth = getAuth(app);
      db = getFirestore(app);
      console.log('✅ Firebase initialized successfully with key:', firebaseConfig.apiKey.substring(0, 10) + '...');
      isInitialized = true;
    } else {
      console.log('Firebase initialization skipped - using mock configuration for build');
      // Create null instances that won't cause runtime errors
      app = null;
      auth = null;
      db = null;
    }
  } catch (error) {
    console.warn('Firebase initialization failed, using fallback configuration:', error);
    app = null;
    auth = null;
    db = null;
  } finally {
    isInitializing = false;
  }
  
  return { app, auth, db };
}

// Try to initialize on import with static config (for SSR compatibility)
const staticConfig = getStaticFirebaseConfig();
if (staticConfig.apiKey && staticConfig.apiKey !== "mock-key-for-build-time") {
  try {
    app = !getApps().length ? initializeApp(staticConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    isInitialized = true;
  } catch (error) {
    console.warn('Static Firebase initialization failed:', error);
  }
}

// Export function to ensure Firebase is initialized
export async function ensureFirebaseInitialized() {
  if (!isInitialized) {
    await initializeFirebase();
  }
  return { app, auth, db };
}

const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, app };
