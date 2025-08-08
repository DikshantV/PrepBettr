import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

// Validate required environment variables (skip during build)
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
];

// Only validate during runtime, not build time
if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`Missing environment variable during build: ${envVar}`);
    }
  }
}

// Define types for our Firebase admin services
interface FirebaseAdmin {
  app: App;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
  storage: Storage;
}

// Manual environment loader to handle long multiline variables properly
const loadFirebasePrivateKey = (): string => {
  // Try to load from process.env first
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  // If the key seems truncated or too short, try to read from .env.local manually
  if (!privateKey || privateKey.length < 100) {
    console.log('🔍 Private key seems truncated, attempting manual load from .env.local...');
    
    try {
      const fs = require('fs');
      const path = require('path');
      
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        
        // Find the FIREBASE_PRIVATE_KEY line and extract the full value
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('FIREBASE_PRIVATE_KEY=')) {
            // Extract everything after the = sign
            const keyValue = line.substring('FIREBASE_PRIVATE_KEY='.length);
            privateKey = keyValue;
            console.log('✅ Successfully loaded private key manually from .env.local');
            break;
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not manually load .env.local:', error);
    }
  }
  
  return privateKey || '';
};

// Helper function to properly format private key
const formatPrivateKey = (privateKey: string | undefined): string => {
  if (!privateKey) {
    throw new Error('Private key is missing');
  }
  
  console.log('🔧 Formatting Firebase private key...');
  
  // Handle different private key formats
  let formattedKey = privateKey;
  
  // Remove wrapping quotes first
  formattedKey = formattedKey.replace(/^["'`]|["'`]$/g, '');
  
  // Replace literal \\n with actual newlines (handle double escaping)
  formattedKey = formattedKey.replace(/\\\\n/g, '\n');
  
  // Replace literal \n with actual newlines
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  
  // Clean up any extra whitespace but preserve internal structure
  formattedKey = formattedKey.trim();
  
  // Debug information
  console.log('📋 Key processing debug info:');
  console.log('  - Raw length:', privateKey.length);
  console.log('  - Processed length:', formattedKey.length);
  console.log('  - First 50 chars:', JSON.stringify(formattedKey.substring(0, 50)));
  console.log('  - Contains BEGIN marker:', formattedKey.includes('-----BEGIN PRIVATE KEY-----'));
  console.log('  - Contains END marker:', formattedKey.includes('-----END PRIVATE KEY-----'));
  
  // Basic validation - check for BEGIN marker with more flexible approach
  if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
    // Try a more permissive check
    if (formattedKey.includes('-----BEGIN') && formattedKey.includes('PRIVATE KEY')) {
      console.log('🔧 Key contains BEGIN and PRIVATE KEY but not the exact format. Attempting repair...');
      // This might be a formatting issue, try to continue
    } else {
      console.error('❌ Private key format error: Missing required markers');
      console.error('Key preview:', JSON.stringify(formattedKey.substring(0, 100)));
      throw new Error('Private key must contain -----BEGIN PRIVATE KEY----- marker');
    }
  }
  
  // Basic validation - check for END marker
  if (!formattedKey.includes('-----END PRIVATE KEY-----')) {
    if (formattedKey.includes('-----END') && formattedKey.includes('PRIVATE KEY')) {
      console.log('🔧 Key contains END and PRIVATE KEY but not exact format. Attempting repair...');
      // This might be a formatting issue, try to continue
    } else {
      console.error('❌ Private key format error: Missing END marker');
      throw new Error('Private key must contain -----END PRIVATE KEY----- marker');
    }
  }
  
  // If we made it this far, ensure proper newline endings
  if (!formattedKey.endsWith('\n')) {
    formattedKey += '\n';
  }
  
  console.log('✅ Firebase private key formatted successfully');
  return formattedKey;
};

// Initialize Firebase Admin
const initFirebaseAdmin = (): FirebaseAdmin => {
  try {
    // During build time, return mock services
    if (!process.env.FIREBASE_PROJECT_ID && (process.env.NODE_ENV === 'production' || process.env.NEXT_PHASE === 'phase-production-build')) {
      console.log('Skipping Firebase Admin initialization during build');
      return {
        app: {} as any,
        auth: {} as any,
        db: {} as any,
        storage: {} as any
      };
    }

    // Validate all required environment variables first
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missingVars.length > 0) {
      console.warn(`Missing required environment variables: ${missingVars.join(', ')}. Creating mock services.`);
      return {
        app: {} as any,
        auth: {} as any,
        db: {} as any,
        storage: {} as any
      };
    }

    // Get existing app if it exists
    const existingApp = getApps().find(app => app.name === 'server');
    
    if (existingApp) {
      // Reduce logging noise - only log once
      if (!process.env.FIREBASE_ADMIN_LOGGED) {
        console.log('🔄 Using existing Firebase Admin app');
        process.env.FIREBASE_ADMIN_LOGGED = 'true';
      }
      return {
        app: existingApp,
        auth: getAuth(existingApp),
        db: getFirestore(existingApp),
        storage: getStorage(existingApp)
      };
    }
    
    console.log('🚀 Initializing new Firebase Admin app...');
    
    // Load and format the private key properly with enhanced error handling
    let privateKey: string;
    try {
      // First try to load the private key (with manual fallback if needed)
      const rawPrivateKey = loadFirebasePrivateKey();
      privateKey = formatPrivateKey(rawPrivateKey);
    } catch (keyError) {
      console.error('❌ Private key loading/formatting failed:', keyError);
      // Try a simpler approach if the complex formatting fails
      const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
      privateKey = rawKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
      
      // Basic validation
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
        throw new Error('Private key is missing or malformed after fallback processing');
      }
      console.log('⚠️ Using fallback private key processing');
    }
    
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
let initializationError: Error | null = null;

const getFirebaseAdmin = (): FirebaseAdmin => {
  if (initializationError) {
    throw initializationError;
  }
  
  if (!firebaseAdmin) {
    try {
      firebaseAdmin = initFirebaseAdmin();
    } catch (error) {
      initializationError = error instanceof Error ? error : new Error('Unknown Firebase initialization error');
      throw initializationError;
    }
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
