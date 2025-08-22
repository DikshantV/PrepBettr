/**
 * Core Authentication Library for Azure Functions
 * 
 * Consolidates all Firebase Auth operations with Azure Key Vault integration.
 * Supports token verification, session cookies, permissions, and custom claims.
 * 
 * @version 2.0.0
 * @author PrepBettr Platform Team
 */

import * as admin from 'firebase-admin';
import { fetchAzureSecrets } from '../../lib/azure-config';
import { ApplicationInsights } from './telemetry';

// ===== TYPES & INTERFACES =====

export interface AuthenticatedUser {
  uid: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  custom_claims?: Record<string, any>;
  auth_time: number;
  iat: number;
  exp: number;
}

export interface TokenVerificationResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
  errorCode?: string;
  verificationMethod: 'id-token' | 'session-cookie';
}

export interface SessionCookieOptions {
  expiresIn: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export interface PermissionCheckResult {
  hasPermissions: boolean;
  userPermissions: string[];
  userRoles: string[];
  requiredPermissions: string[];
}

// ===== CONFIGURATION & INITIALIZATION =====

let firebaseInitialized = false;
let telemetryClient: ApplicationInsights;

/**
 * Initialize Firebase Admin SDK with Azure Key Vault secrets
 */
async function initializeFirebaseAdmin(): Promise<admin.app.App> {
  if (firebaseInitialized && admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  try {
    const secrets = await fetchAzureSecrets();
    
    // Try to get Firebase service account from Key Vault first
    let serviceAccount;
    try {
      const { SecretClient } = await import('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = await import('@azure/identity');
      
      const credential = new DefaultAzureCredential();
      const vaultUri = process.env.AZURE_KEY_VAULT_URI;
      
      if (vaultUri) {
        const secretClient = new SecretClient(vaultUri, credential);
        const serviceAccountSecret = await secretClient.getSecret('firebase-service-account-key');
        serviceAccount = JSON.parse(serviceAccountSecret.value);
      }
    } catch (keyVaultError) {
      console.warn('Key Vault unavailable, falling back to environment variables');
    }

    // Fallback to environment variables
    if (!serviceAccount) {
      serviceAccount = {
        type: 'service_account',
        project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };
    }

    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      throw new Error('Firebase service account configuration is incomplete');
    }

    // Initialize Firebase Admin
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com/`
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
    
    return app;

  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
}

/**
 * Initialize telemetry client
 */
function initializeTelemetry(): ApplicationInsights {
  if (!telemetryClient) {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (connectionString) {
      telemetryClient = new ApplicationInsights(connectionString);
    }
  }
  return telemetryClient;
}

// ===== CORE AUTHENTICATION FUNCTIONS =====

/**
 * Verify Firebase ID Token
 */
export async function verifyIdToken(idToken: string): Promise<TokenVerificationResult> {
  const startTime = Date.now();
  const telemetry = initializeTelemetry();
  
  try {
    if (!idToken) {
      return {
        success: false,
        error: 'ID token is required',
        errorCode: 'MISSING_TOKEN',
        verificationMethod: 'id-token'
      };
    }

    await initializeFirebaseAdmin();
    
    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken, true);
    
    // Additional server-side validation
    const now = Math.floor(Date.now() / 1000);
    if (decodedToken.exp < now) {
      telemetry?.trackEvent('auth.token.expired', {
        uid: decodedToken.uid,
        exp: decodedToken.exp,
        now: now
      });

      return {
        success: false,
        error: 'Token expired',
        errorCode: 'TOKEN_EXPIRED',
        verificationMethod: 'id-token'
      };
    }

    const user: AuthenticatedUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified || false,
      name: decodedToken.name,
      picture: decodedToken.picture,
      custom_claims: decodedToken,
      auth_time: decodedToken.auth_time,
      iat: decodedToken.iat,
      exp: decodedToken.exp
    };

    const duration = Date.now() - startTime;
    telemetry?.trackDependency('auth.verify_id_token', 'firebase', duration, true);
    telemetry?.trackEvent('auth.verification.success', {
      uid: user.uid,
      email: user.email,
      duration: duration
    });

    return {
      success: true,
      user,
      verificationMethod: 'id-token'
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    telemetry?.trackDependency('auth.verify_id_token', 'firebase', duration, false);
    telemetry?.trackException(error);

    let errorMessage = 'Invalid token';
    let errorCode = 'INVALID_TOKEN';

    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Token expired';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.code === 'auth/id-token-revoked') {
      errorMessage = 'Token revoked';
      errorCode = 'TOKEN_REVOKED';
    } else if (error.code === 'auth/argument-error') {
      errorMessage = 'Invalid token format';
      errorCode = 'INVALID_FORMAT';
    }

    return {
      success: false,
      error: errorMessage,
      errorCode,
      verificationMethod: 'id-token'
    };
  }
}

/**
 * Create Firebase session cookie
 */
export async function createSessionCookie(
  idToken: string, 
  options: Partial<SessionCookieOptions> = {}
): Promise<{ success: boolean; sessionCookie?: string; error?: string; expiresIn?: number }> {
  const startTime = Date.now();
  const telemetry = initializeTelemetry();

  try {
    if (!idToken) {
      return {
        success: false,
        error: 'ID token is required'
      };
    }

    await initializeFirebaseAdmin();

    const defaultExpiresIn = 5 * 24 * 60 * 60 * 1000; // 5 days
    const maxExpiresIn = 14 * 24 * 60 * 60 * 1000; // 14 days max
    const expiresIn = Math.min(options.expiresIn || defaultExpiresIn, maxExpiresIn);

    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });

    const duration = Date.now() - startTime;
    telemetry?.trackDependency('auth.create_session_cookie', 'firebase', duration, true);
    telemetry?.trackEvent('auth.session.created', {
      expiresIn,
      duration
    });

    return {
      success: true,
      sessionCookie,
      expiresIn
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    telemetry?.trackDependency('auth.create_session_cookie', 'firebase', duration, false);
    telemetry?.trackException(error);

    let errorMessage = 'Failed to create session cookie';
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'ID token expired';
    } else if (error.code === 'auth/id-token-revoked') {
      errorMessage = 'ID token revoked';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Verify Firebase session cookie
 */
export async function verifySessionCookie(sessionCookie: string): Promise<TokenVerificationResult> {
  const startTime = Date.now();
  const telemetry = initializeTelemetry();

  try {
    if (!sessionCookie) {
      return {
        success: false,
        error: 'Session cookie is required',
        errorCode: 'MISSING_COOKIE',
        verificationMethod: 'session-cookie'
      };
    }

    await initializeFirebaseAdmin();

    const decodedToken = await admin.auth().verifySessionCookie(sessionCookie, true);

    const user: AuthenticatedUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified || false,
      name: decodedToken.name,
      picture: decodedToken.picture,
      custom_claims: decodedToken,
      auth_time: decodedToken.auth_time,
      iat: decodedToken.iat,
      exp: decodedToken.exp
    };

    const duration = Date.now() - startTime;
    telemetry?.trackDependency('auth.verify_session_cookie', 'firebase', duration, true);
    telemetry?.trackEvent('auth.session.verified', {
      uid: user.uid,
      duration
    });

    return {
      success: true,
      user,
      verificationMethod: 'session-cookie'
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    telemetry?.trackDependency('auth.verify_session_cookie', 'firebase', duration, false);
    telemetry?.trackException(error);

    return {
      success: false,
      error: 'Invalid session cookie',
      errorCode: 'INVALID_COOKIE',
      verificationMethod: 'session-cookie'
    };
  }
}

/**
 * Check user permissions and roles
 */
export async function checkPermissions(
  user: AuthenticatedUser, 
  requiredPermissions: string[] = []
): Promise<PermissionCheckResult> {
  const telemetry = initializeTelemetry();

  try {
    await initializeFirebaseAdmin();

    // Get user's custom claims
    const userRecord = await admin.auth().getUser(user.uid);
    const customClaims = userRecord.customClaims || {};
    
    const userPermissions = customClaims.permissions || [];
    const userRoles = customClaims.roles || [];

    // Check if user has all required permissions or is admin
    const hasPermissions = requiredPermissions.length === 0 || 
      requiredPermissions.every(permission => 
        userPermissions.includes(permission) || userRoles.includes('admin')
      );

    telemetry?.trackEvent('auth.permissions.checked', {
      uid: user.uid,
      hasPermissions,
      requiredPermissions: requiredPermissions.join(','),
      userRoles: userRoles.join(',')
    });

    return {
      hasPermissions,
      userPermissions,
      userRoles,
      requiredPermissions
    };

  } catch (error: any) {
    telemetry?.trackException(error);

    return {
      hasPermissions: false,
      userPermissions: [],
      userRoles: [],
      requiredPermissions
    };
  }
}

/**
 * Set custom user claims (admin only)
 */
export async function setCustomUserClaims(
  adminUser: AuthenticatedUser,
  targetUserId: string,
  claims: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const telemetry = initializeTelemetry();

  try {
    await initializeFirebaseAdmin();

    // Verify admin permissions
    const adminCheck = await checkPermissions(adminUser, ['admin']);
    if (!adminCheck.hasPermissions) {
      return {
        success: false,
        error: 'Insufficient permissions - admin role required'
      };
    }

    await admin.auth().setCustomUserClaims(targetUserId, claims);

    telemetry?.trackEvent('auth.claims.updated', {
      adminUid: adminUser.uid,
      targetUserId,
      claimsSet: Object.keys(claims).join(',')
    });

    return { success: true };

  } catch (error: any) {
    telemetry?.trackException(error);
    return {
      success: false,
      error: `Failed to set custom claims: ${error.message}`
    };
  }
}

/**
 * Unified authentication function that tries both ID token and session cookie
 */
export async function authenticateRequest(
  authHeader?: string,
  sessionCookie?: string
): Promise<TokenVerificationResult> {
  // Try ID token first
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const result = await verifyIdToken(token);
    if (result.success) {
      return result;
    }
  }

  // Try session cookie as fallback
  if (sessionCookie) {
    const result = await verifySessionCookie(sessionCookie);
    if (result.success) {
      return result;
    }
  }

  return {
    success: false,
    error: 'No valid authentication found',
    errorCode: 'NO_AUTH',
    verificationMethod: 'id-token'
  };
}

/**
 * Delete user authentication record
 */
export async function deleteUserAuth(userId: string): Promise<{ success: boolean; error?: string }> {
  const telemetry = initializeTelemetry();

  try {
    await initializeFirebaseAdmin();
    await admin.auth().deleteUser(userId);

    telemetry?.trackEvent('auth.user.deleted', {
      userId
    });

    return { success: true };

  } catch (error: any) {
    telemetry?.trackException(error);
    return {
      success: false,
      error: `Failed to delete user auth: ${error.message}`
    };
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get authentication status and configuration
 */
export function getAuthStatus() {
  return {
    firebaseInitialized,
    adminAppsCount: admin.apps.length,
    telemetryEnabled: !!telemetryClient,
    timestamp: new Date().toISOString()
  };
}

/**
 * Health check for authentication services
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  services: Record<string, boolean>;
  error?: string;
}> {
  try {
    // Test Firebase connection
    await initializeFirebaseAdmin();
    
    // Test token verification with a minimal check
    const services = {
      firebase_admin: !!admin.apps.length,
      azure_config: true, // Already tested during initialization
      telemetry: !!telemetryClient
    };

    const allHealthy = Object.values(services).every(status => status);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      services
    };

  } catch (error: any) {
    return {
      status: 'unhealthy',
      services: {
        firebase_admin: false,
        azure_config: false,
        telemetry: false
      },
      error: error.message
    };
  }
}

// ===== EXPORTS =====

export default {
  verifyIdToken,
  createSessionCookie,
  verifySessionCookie,
  checkPermissions,
  setCustomUserClaims,
  authenticateRequest,
  deleteUserAuth,
  getAuthStatus,
  healthCheck
};
