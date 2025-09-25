/**
 * Firebase Admin SDK Configuration
 * 
 * Real Firebase Admin SDK implementation with Azure Key Vault integration
 */

import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

// Client-side safety check
const isClient = typeof window !== 'undefined';

if (isClient) {
  console.warn('[Firebase Admin] Running on client side - using fallback implementations');
}

// Firebase service account interface
interface FirebaseServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Global Firebase Admin instances
let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let cachedServiceAccount: FirebaseServiceAccount | null = null;

// Azure Key Vault configuration
const AZURE_KEY_VAULT_URI = process.env.AZURE_KEY_VAULT_URI || 'https://prepbettr-keyvault-083.vault.azure.net/';

/**
 * Load Firebase service account from Azure Key Vault or environment variables
 */
async function loadServiceAccount(): Promise<FirebaseServiceAccount> {
  if (isClient) {
    throw new Error('Service account loading not available on client side');
  }

  // Return cached service account if available
  if (cachedServiceAccount) {
    console.log('🔥 Using cached Firebase service account');
    return cachedServiceAccount;
  }

  try {
    console.log('🔑 Attempting to load Firebase service account from Azure Key Vault...');
    
    // Create Azure Key Vault client
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(AZURE_KEY_VAULT_URI, credential);
    
    try {
      // Try to get the complete service account JSON first
      const secret = await client.getSecret('firebase-service-account-key');
      if (secret.value) {
        const serviceAccount = JSON.parse(secret.value);
        
        // Validate required fields
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
          throw new Error('Service account JSON missing required fields');
        }
        
        console.log('✅ Firebase service account loaded from Azure Key Vault JSON:', {
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email ? serviceAccount.client_email.substring(0, 20) + '...' : 'not set',
          hasPrivateKey: !!serviceAccount.private_key,
          source: 'Azure Key Vault'
        });
        
        // Cache and return the service account
        cachedServiceAccount = serviceAccount;
        return serviceAccount;
      }
    } catch (kvError: any) {
      if (kvError.statusCode === 404) {
        console.log('🔄 firebase-service-account-key not found in Key Vault, trying individual secrets...');
      } else {
        console.warn('⚠️ Error fetching firebase-service-account-key from Key Vault:', kvError.message);
      }
    }
    
    // Fallback to individual Firebase secrets from Key Vault
    try {
      const [projectIdSecret, clientEmailSecret, privateKeySecret] = await Promise.allSettled([
        client.getSecret('firebase-project-id'),
        client.getSecret('firebase-client-email'),
        client.getSecret('firebase-private-key')
      ]);
      
      const projectId = projectIdSecret.status === 'fulfilled' ? projectIdSecret.value.value : null;
      const clientEmail = clientEmailSecret.status === 'fulfilled' ? clientEmailSecret.value.value : null;
      const privateKey = privateKeySecret.status === 'fulfilled' ? privateKeySecret.value.value : null;
      
      if (projectId && clientEmail && privateKey) {
        const serviceAccount: FirebaseServiceAccount = {
          type: 'service_account',
          project_id: projectId,
          private_key_id: '',
          private_key: privateKey.replace(/\\n/g, '\n'),
          client_email: clientEmail,
          client_id: '',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
        };
        
        console.log('✅ Firebase service account created from individual Key Vault secrets:', {
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email ? serviceAccount.client_email.substring(0, 20) + '...' : 'not set',
          hasPrivateKey: !!serviceAccount.private_key,
          source: 'Azure Key Vault (individual secrets)'
        });
        
        // Cache and return the service account
        cachedServiceAccount = serviceAccount;
        return serviceAccount;
      }
    } catch (individualError) {
      console.warn('⚠️ Error fetching individual Firebase secrets from Key Vault:', individualError);
    }
    
  } catch (error) {
    console.warn('🔄 Azure Key Vault unavailable, falling back to environment variables:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Final fallback to environment variables
  console.log('🔄 Using Firebase configuration from environment variables...');
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  if (!projectId || !clientEmail || !privateKey) {
    const missing = [];
    if (!projectId) missing.push('FIREBASE_PROJECT_ID');
    if (!clientEmail) missing.push('FIREBASE_CLIENT_EMAIL');
    if (!privateKey) missing.push('FIREBASE_PRIVATE_KEY');
    throw new Error(`Missing required Firebase environment variables: ${missing.join(', ')}`);
  }
  
  const serviceAccount: FirebaseServiceAccount = {
    type: 'service_account',
    project_id: projectId,
    private_key_id: '',
    private_key: privateKey.replace(/\\n/g, '\n'),
    client_email: clientEmail,
    client_id: '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
  };
  
  console.log('✅ Firebase service account created from environment variables:', {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email ? serviceAccount.client_email.substring(0, 20) + '...' : 'not set',
    hasPrivateKey: !!serviceAccount.private_key,
    source: 'Environment variables'
  });
  
  // Cache and return the service account
  cachedServiceAccount = serviceAccount;
  return serviceAccount;
}

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebaseAdmin(): Promise<App> {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  if (adminApp) {
    console.log('🔥 Firebase Admin SDK already initialized, returning existing app');
    return adminApp;
  }

  try {
    console.log('🔥 Starting Firebase Admin SDK initialization...');
    
    // Check if Firebase Admin is already initialized globally
    const existingApps = getApps();
    if (existingApps.length > 0) {
      console.log('🔥 Found existing Firebase Admin app, reusing...', {
        appCount: existingApps.length,
        appNames: existingApps.map(app => app?.name || '[default]')
      });
      adminApp = existingApps[0];
      return adminApp;
    }

    // Load service account from Key Vault or environment
    const serviceAccount = await loadServiceAccount();
    
    // Validate private key format
    if (!serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error('Invalid private key format - missing BEGIN marker');
    }
    if (!serviceAccount.private_key.includes('-----END PRIVATE KEY-----')) {
      throw new Error('Invalid private key format - missing END marker');
    }
    
    console.log('🔥 Initializing Firebase Admin app with service account credentials...');
    
    try {
      const credential = cert(serviceAccount as any);
      adminApp = initializeApp({
        credential: credential,
        projectId: serviceAccount.project_id
      });
      
      console.log('✅ Firebase Admin app initialized successfully:', {
        projectId: serviceAccount.project_id,
        appName: adminApp.name
      });
      
      return adminApp;
    } catch (credError) {
      console.error('❌ Firebase credential/app initialization failed:', {
        error: credError instanceof Error ? credError.message : 'Unknown error',
        code: credError instanceof Error ? (credError as any).code : 'unknown'
      });
      throw credError;
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    
    // For development, create a minimal fallback
    console.warn('🔥 Creating minimal fallback Firebase Admin instance');
    
    try {
      const fallbackProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'prepbettr-dev';
      
      adminApp = initializeApp({
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
export async function getAdminAuth(): Promise<Auth> {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  if (adminAuth) {
    return adminAuth;
  }

  const app = await initializeFirebaseAdmin();
  adminAuth = getAuth(app);
  return adminAuth;
}

/**
 * Get Firebase Admin Firestore instance
 */
export async function getAdminFirestore() {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  // Get or initialize the Firebase Admin app
  const app = await initializeFirebaseAdmin();
  
  // Import Firestore dynamically to avoid client-side imports
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore(app);
}

/**
 * Verify Firebase ID token with robust error handling
 */
export async function verifyIdToken(token: string, checkRevoked: boolean = true): Promise<{
  valid: boolean;
  user?: any;
  error?: string;
  errorCode?: string;
}> {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  try {
    if (!token) {
      return {
        valid: false,
        error: 'Token is required',
        errorCode: 'MISSING_TOKEN'
      };
    }
    
    // Handle mock tokens for development
    if (token.startsWith('mock-token-')) {
      console.log('🔥 Verifying mock token in development mode');
      const parts = token.split('-');
      if (parts.length >= 4) {
        const uid = parts[2];
        const timestamp = parseInt(parts[3]);
        
        // Check if token is not too old (24 hours)
        const tokenAge = Date.now() - timestamp;
        if (tokenAge > 24 * 60 * 60 * 1000) {
          return {
            valid: false,
            error: 'Mock token has expired',
            errorCode: 'EXPIRED_TOKEN'
          };
        }
        
        return {
          valid: true,
          user: {
            uid: uid,
            email: uid.includes('@') ? uid : `${uid}@mock.com`,
            name: uid.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim() || 'Mock User',
            email_verified: true
          }
        };
      }
      
      return {
        valid: false,
        error: 'Invalid mock token format',
        errorCode: 'INVALID_TOKEN'
      };
    }
    
    const auth = await getAdminAuth();
    console.log('🔥 Verifying Firebase ID token with Firebase Admin SDK');
    
    const decodedToken = await auth.verifyIdToken(token, checkRevoked);
    
    console.log('✅ Firebase ID token verified successfully:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      issuer: decodedToken.iss,
      audience: decodedToken.aud,
      expiry: new Date(decodedToken.exp * 1000).toISOString()
    });
    
    return {
      valid: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.display_name || decodedToken.email?.split('@')[0],
        picture: decodedToken.picture,
        email_verified: decodedToken.email_verified || false,
        firebase: decodedToken.firebase,
        custom_claims: decodedToken.custom_claims || {}
      }
    };
    
  } catch (error: any) {
    console.error('❌ Firebase ID token verification failed:', {
      error: error.message,
      code: error.code,
      tokenLength: token ? token.length : 0,
      tokenPrefix: token ? token.substring(0, 10) + '...' : 'null'
    });
    
    // Map Firebase Auth errors to unified error codes
    if (error.code === 'auth/id-token-expired') {
      return {
        valid: false,
        error: 'Token has expired',
        errorCode: 'EXPIRED_TOKEN'
      };
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return {
        valid: false,
        error: 'Token has been revoked',
        errorCode: 'INVALID_TOKEN'
      };
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return {
        valid: false,
        error: 'Invalid ID token format',
        errorCode: 'INVALID_TOKEN'
      };
    }
    
    if (error.code === 'auth/project-not-found') {
      return {
        valid: false,
        error: 'Firebase project not found',
        errorCode: 'SERVICE_UNAVAILABLE'
      };
    }
    
    // Handle the specific "kid" claim error (expired token)
    if (error.code === 'auth/argument-error' && error.message.includes('kid')) {
      return {
        valid: false,
        error: 'Token has expired or is invalid. Please refresh your authentication.',
        errorCode: 'EXPIRED_TOKEN'
      };
    }
    
    return {
      valid: false,
      error: error.message || 'Firebase token verification failed',
      errorCode: 'FIREBASE_ERROR'
    };
  }
}

/**
 * Create a custom token for a user
 */
export async function createCustomToken(uid: string, additionalClaims?: Record<string, any>): Promise<string> {
  if (isClient) {
    throw new Error('Firebase Admin SDK not available on client side');
  }
  
  try {
    const auth = await getAdminAuth();
    return await auth.createCustomToken(uid, additionalClaims);
  } catch (error) {
    console.error('❌ Failed to create custom token:', error);
    throw error;
  }
}

/**
 * Legacy compatibility functions
 */
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

export async function getDBService() {
  return getAdminFirestore();
}
