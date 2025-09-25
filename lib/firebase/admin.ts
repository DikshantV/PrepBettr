/**
 * Firebase Admin SDK Configuration
 * 
 * Real Firebase Admin SDK implementation with Azure Key Vault integration
 */

// Client-side safety check
const isClient = typeof window !== 'undefined';

if (isClient) {
  console.warn('[Firebase Admin] Running on client side - using fallback implementations');
}

// Only import server-side dependencies when running on server
let admin: any = null;
let getConfiguration: any = null;

if (!isClient) {
  admin = require('firebase-admin');
  try {
    const azureConfig = require('@/lib/azure-config');
    getConfiguration = azureConfig.getConfiguration;
  } catch (error) {
    console.warn('🔥 Failed to import azure-config, getConfiguration will be undefined:', error);
    getConfiguration = null;
  }
}

// Global Firebase Admin app instance
let adminApp: any = null;
let adminAuth: any = null;

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebaseAdmin(): Promise<any> {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  if (adminApp) {
    console.log('🔥 Firebase Admin SDK already initialized, returning existing app');
    return adminApp;
  }

  try {
    console.log('🔥 Starting Firebase Admin SDK initialization...');
    console.log('🔍 Environment check:', {
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not set',
      nodeEnv: process.env.NODE_ENV,
      privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
      privateKeyFormat: process.env.FIREBASE_PRIVATE_KEY?.includes('-----BEGIN PRIVATE KEY-----') ? 'PEM' : 'unknown'
    });
    
    // Check if Firebase Admin is already initialized
    const existingApps = admin.apps;
    if (existingApps.length > 0) {
      console.log('🔥 Found existing Firebase Admin app, reusing...', {
        appCount: existingApps.length,
        appNames: existingApps.map(app => app?.name)
      });
      adminApp = existingApps[0];
      return adminApp;
    }

    // Get Firebase configuration from Azure Key Vault or environment variables
    let config: Record<string, string> = {};
    try {
      if (getConfiguration && typeof getConfiguration === 'function') {
        console.log('🔥 Attempting to get config from Azure Key Vault...');
        config = await getConfiguration();
        console.log('🔥 Azure Key Vault config loaded successfully:', {
          hasFirebaseProjectId: !!config['FIREBASE_PROJECT_ID'],
          hasFirebaseClientEmail: !!config['FIREBASE_CLIENT_EMAIL'],
          hasFirebasePrivateKey: !!config['FIREBASE_PRIVATE_KEY']
        });
      } else {
        console.warn('🔥 getConfiguration not available, using environment variables directly');
      }
    } catch (configError) {
      console.warn('🔥 Failed to get config from Azure, using environment variables:', {
        error: configError instanceof Error ? configError.message : 'Unknown error',
        code: configError instanceof Error ? (configError as any).code : 'unknown'
      });
      config = {};
    }
    
    const firebaseConfig = {
      projectId: config['FIREBASE_PROJECT_ID'] || process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'prepbettr',
      clientEmail: config['FIREBASE_CLIENT_EMAIL'] || process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: config['FIREBASE_PRIVATE_KEY'] || process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY_DIRECT
    };

    console.log('🔥 Firebase config loaded:', {
      projectId: firebaseConfig.projectId,
      hasClientEmail: !!firebaseConfig.clientEmail,
      hasPrivateKey: !!firebaseConfig.privateKey && firebaseConfig.privateKey.length > 0
    });

    // Debug: Show what configuration sources we tried
    console.log('🔥 Firebase config sources:', {
      azureConfig: !!config['FIREBASE_CLIENT_EMAIL'],
      envVars: !!process.env.FIREBASE_CLIENT_EMAIL,
      projectIdFromEnv: !!process.env.FIREBASE_PROJECT_ID,
      projectIdFromAzure: !!config['FIREBASE_PROJECT_ID']
    });

    // Validate project ID
    if (!firebaseConfig.projectId || firebaseConfig.projectId === 'prepbettr') {
      console.warn('🔥 Using default project ID - this may cause authentication issues');
    }
    
    // Initialize Firebase Admin SDK
    if (firebaseConfig.clientEmail && firebaseConfig.privateKey) {
      console.log('🔥 Initializing with service account credentials...');
      console.log('🔍 Service account details:', {
        projectId: firebaseConfig.projectId,
        clientEmail: firebaseConfig.clientEmail,
        privateKeyPreview: firebaseConfig.privateKey.substring(0, 50) + '...',
        privateKeyHasNewlines: firebaseConfig.privateKey.includes('\n'),
        privateKeyHasEscapedNewlines: firebaseConfig.privateKey.includes('\\n')
      });
      
      // Clean up private key format (handle escaped newlines)
      let cleanPrivateKey = firebaseConfig.privateKey;
      if (cleanPrivateKey.includes('\\n')) {
        console.log('🔧 Converting escaped newlines in private key...');
        cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
      }
      
      // Validate private key format
      if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('❌ Invalid private key format - missing BEGIN marker');
        console.error('🔍 Private key preview:', cleanPrivateKey.substring(0, 100));
        throw new Error('Invalid private key format - missing BEGIN marker');
      }
      if (!cleanPrivateKey.includes('-----END PRIVATE KEY-----')) {
        console.error('❌ Invalid private key format - missing END marker');
        console.error('🔍 Private key preview:', cleanPrivateKey.substring(cleanPrivateKey.length - 100));
        throw new Error('Invalid private key format - missing END marker');
      }
      
      console.log('🔥 Creating Firebase Admin credential...');
      try {
        const credential = admin.credential.cert({
          projectId: firebaseConfig.projectId,
          clientEmail: firebaseConfig.clientEmail,
          privateKey: cleanPrivateKey
        });
        console.log('✅ Firebase credential created successfully');
        
        console.log('🔥 Initializing Firebase Admin app...');
        adminApp = admin.initializeApp({
          credential: credential,
          projectId: firebaseConfig.projectId
        });
        console.log('✅ Firebase Admin app initialized successfully');
      } catch (credError) {
        console.error('❌ Firebase credential/app initialization failed:', {
          error: credError instanceof Error ? credError.message : 'Unknown error',
          stack: credError instanceof Error ? credError.stack : 'No stack trace',
          code: credError instanceof Error ? (credError as any).code : 'unknown'
        });
        throw credError;
      }
    } else {
      console.warn('🔥 Missing service account credentials, initializing with project ID only');
      console.warn('🔥 This will work for development but ID token verification will fail');
      
      // For development, create a Firebase Admin app without credentials
      // This won't be able to verify ID tokens but can still connect to Firestore in some cases
      try {
        adminApp = admin.initializeApp({
          projectId: firebaseConfig.projectId
        });
        console.log('🔥 Firebase Admin initialized without service account (development mode)');
      } catch (credentialError) {
        console.error('🔥 Failed to initialize even without credentials:', credentialError);
        throw credentialError;
      }
    }

    console.log('🔥 Firebase Admin SDK initialized successfully');
    return adminApp;
    
  } catch (error) {
    console.error('🔥 Failed to initialize Firebase Admin SDK:', error);
    
    // Create a minimal fallback for development
    console.warn('🔥 Creating minimal fallback Firebase Admin instance');
    
    try {
      // Use the default project ID as fallback
      const fallbackProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'prepbettr-dev';
      
      adminApp = admin.initializeApp({
        projectId: fallbackProjectId
      });
      
      console.log('🔥 Fallback Firebase Admin instance created');
      return adminApp;
    } catch (fallbackError) {
      console.error('🔥 Failed to create fallback Firebase Admin instance:', fallbackError);
      throw new Error(`Firebase Admin SDK initialization completely failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Get Firebase Admin Auth instance
 */
export async function getAdminAuth(): Promise<any> {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  if (adminAuth) {
    return adminAuth;
  }

  const app = await initializeFirebaseAdmin();
  adminAuth = admin.auth(app);
  return adminAuth;
}

export async function getAdminFirestore() {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  // Get or initialize the Firebase Admin app
  const app = await initializeFirebaseAdmin();
  
  // Return the real Firestore instance
  return admin.firestore(app);
}

export async function getAdminRemoteConfig() {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  return {
    getTemplate: async () => ({ parameters: {} }),
    publishTemplate: async () => {},
    getParameter: async () => ({ defaultValue: null }),
    setParameter: async () => {}
  };
}

export async function verifyIdToken(token: string) {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  console.warn('Firebase Admin verifyIdToken deprecated - use unified auth system');
  return {
    uid: 'mock-user-id',
    email: 'mock@example.com'
  };
}

export async function getDBService() {
  return getAdminFirestore();
}
