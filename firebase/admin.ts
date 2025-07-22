import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

// Validate required environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
  }
}

// Define types for our Firebase admin services
interface FirebaseAdmin {
  app: App;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
  storage: Storage;
}

// Helper function to properly format private key
const formatPrivateKey = (privateKey: string | undefined): string => {
  if (!privateKey) {
    throw new Error('Private key is missing');
  }
  
  // Handle different private key formats
  let formattedKey = privateKey;
  
  // Replace literal \n with actual newlines
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  
  // Remove any quotes that might wrap the key
  formattedKey = formattedKey.replace(/^["']|["']$/g, '');
  
  // Clean up any extra whitespace but preserve internal structure
  formattedKey = formattedKey.trim();
  
  // Ensure the key has proper PEM formatting
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Private key must be in PEM format starting with -----BEGIN PRIVATE KEY-----');
  }
  
  // Ensure proper line endings for PEM format
  if (!formattedKey.endsWith('\n')) {
    formattedKey += '\n';
  }
  
  // Additional validation - check for proper END marker
  if (!formattedKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Private key must end with -----END PRIVATE KEY-----');
  }
  
  // Ensure proper structure by splitting and rejoining
  const lines = formattedKey.split('\n').filter(line => line.trim());
  if (lines.length < 3) {
    throw new Error('Private key appears to be malformed - insufficient lines');
  }
  
  // Reconstruct with proper line endings
  return lines.join('\n') + '\n';
};

// Initialize Firebase Admin
const initFirebaseAdmin = (): FirebaseAdmin => {
  try {
    // Validate all required environment variables first
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Get existing app if it exists
    const existingApp = getApps().find(app => app.name === 'server');
    
    if (existingApp) {
      // Reduce logging noise - only log once
      if (!process.env.FIREBASE_ADMIN_LOGGED) {
        console.log('Using existing Firebase Admin app');
        process.env.FIREBASE_ADMIN_LOGGED = 'true';
      }
      return {
        app: existingApp,
        auth: getAuth(existingApp),
        db: getFirestore(existingApp),
        storage: getStorage(existingApp)
      };
    }
    
    // Format the private key properly
    const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
    
    // Configure environment to avoid OpenSSL/gRPC issues
    process.env.FIRESTORE_EMULATOR_HOST = '';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
    process.env.GRPC_VERBOSITY = 'ERROR';
    process.env.GRPC_TRACE = '';
    
    // Force Firestore to use REST instead of gRPC to avoid SSL issues
    process.env.GOOGLE_CLOUD_FIRESTORE_EMULATOR_HOST = '';
    process.env.FIRESTORE_PREFER_REST = 'true';
    
    // Set SSL cipher suites for compatibility
    if (!process.env.GRPC_SSL_CIPHER_SUITES) {
      process.env.GRPC_SSL_CIPHER_SUITES = 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384';
    }
    
    // Initialize the app with SSL configuration
    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: privateKey,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    }, 'server');

    // Initialize services
    const auth = getAuth(app);
    
    // Initialize Firestore 
    let db;
    try {
      // Initialize Firestore
      db = getFirestore(app);
      
      // Note: We rely on environment variables and settings rather than private property access
      // for configuring Firestore transport settings
    } catch (error) {
      console.warn('Failed to initialize Firestore, falling back to basic initialization:', error);
      // Fallback to basic Firestore initialization
      db = getFirestore(app);
    }
    
    const storage = getStorage(app);
    
    console.log(`Firebase Admin initialized successfully with bucket: ${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`);
    
    return { app, auth, db, storage };
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw new Error(`Failed to initialize Firebase Admin: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Lazy initialization to avoid errors during build
let firebaseAdmin: FirebaseAdmin | null = null;

const getFirebaseAdmin = (): FirebaseAdmin => {
  if (!firebaseAdmin) {
    firebaseAdmin = initFirebaseAdmin();
  }
  return firebaseAdmin;
};

// Export lazy-loaded services
export const getAuthService = () => getFirebaseAdmin().auth;
export const getDBService = () => getFirebaseAdmin().db;
export const getStorageService = () => getFirebaseAdmin().storage;

// Export direct access to services for backward compatibility
// Note: These will be initialized lazily when first accessed
let _firebaseAdmin: FirebaseAdmin | null = null;

const ensureInitialized = () => {
  if (!_firebaseAdmin) {
    _firebaseAdmin = initFirebaseAdmin();
  }
  return _firebaseAdmin;
};

// Direct exports for backward compatibility
export const auth = new Proxy({} as any, {
  get: (target, prop) => {
    const admin = ensureInitialized();
    return (admin.auth as any)[prop];
  }
});

export const db = new Proxy({} as any, {
  get: (target, prop) => {
    const admin = ensureInitialized();
    return (admin.db as any)[prop];
  }
});

export const storage = new Proxy({} as any, {
  get: (target, prop) => {
    const admin = ensureInitialized();
    return (admin.storage as any)[prop];
  }
});
