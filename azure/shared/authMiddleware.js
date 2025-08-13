const admin = require('firebase-admin');
const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');

/**
 * Firebase Authentication Middleware for Azure Functions
 * 
 * This middleware validates Firebase ID tokens and ensures only authenticated users
 * can access protected endpoints in Azure Functions.
 */

let firebaseApp = null;
let keyVaultClient = null;

/**
 * Initialize Firebase Admin SDK with Azure Key Vault secrets
 */
async function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp.auth();
  }

  try {
    // Initialize Key Vault client if not already done
    if (!keyVaultClient && process.env.AZURE_KEY_VAULT_URL) {
      keyVaultClient = new SecretClient(
        process.env.AZURE_KEY_VAULT_URL,
        new DefaultAzureCredential()
      );
    }

    // Get Firebase configuration from environment or Key Vault
    let firebaseConfig = {};
    
    if (keyVaultClient) {
      try {
        const projectIdSecret = await keyVaultClient.getSecret('FIREBASE-PROJECT-ID');
        const clientEmailSecret = await keyVaultClient.getSecret('FIREBASE-CLIENT-EMAIL');
        const privateKeySecret = await keyVaultClient.getSecret('FIREBASE-PRIVATE-KEY');

        firebaseConfig = {
          projectId: projectIdSecret.value,
          clientEmail: clientEmailSecret.value,
          privateKey: privateKeySecret.value.replace(/\\n/g, '\n')
        };
      } catch (keyVaultError) {
        console.warn('Key Vault access failed, using environment variables:', keyVaultError.message);
      }
    }

    // Fallback to environment variables
    if (!firebaseConfig.projectId) {
      firebaseConfig = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      };
    }

    // Validate required configuration
    if (!firebaseConfig.projectId || !firebaseConfig.clientEmail || !firebaseConfig.privateKey) {
      throw new Error('Missing Firebase configuration. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.');
    }

    // Initialize Firebase Admin
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseConfig.projectId,
        clientEmail: firebaseConfig.clientEmail,
        privateKey: firebaseConfig.privateKey
      }),
      projectId: firebaseConfig.projectId
    });

    console.log('Firebase Admin SDK initialized successfully');
    return firebaseApp.auth();

  } catch (error) {
    console.error('Firebase initialization failed:', error);
    throw error;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader) {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify Firebase ID token
 */
async function verifyFirebaseToken(idToken) {
  try {
    const auth = await initializeFirebase();
    const decodedToken = await auth.verifyIdToken(idToken, true);
    return {
      success: true,
      user: decodedToken,
      error: null
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return {
      success: false,
      user: null,
      error: error.message || 'Token verification failed'
    };
  }
}

/**
 * Authentication middleware for Azure Functions
 * 
 * Usage:
 * const { authMiddleware } = require('../shared/authMiddleware');
 * 
 * module.exports = async function (context, req) {
 *   const authResult = await authMiddleware(context, req);
 *   if (!authResult.success) {
 *     context.res = authResult.response;
 *     return;
 *   }
 *   
 *   const user = authResult.user;
 *   // Your protected function logic here
 * };
 */
async function authMiddleware(context, req) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = extractBearerToken(authHeader);

    if (!token) {
      return {
        success: false,
        user: null,
        response: {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: 'Missing or invalid Authorization header',
            message: 'Please provide a valid Bearer token in the Authorization header'
          })
        }
      };
    }

    // Verify the Firebase token
    const verificationResult = await verifyFirebaseToken(token);

    if (!verificationResult.success) {
      return {
        success: false,
        user: null,
        response: {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: 'Token verification failed',
            message: verificationResult.error
          })
        }
      };
    }

    // Log successful authentication (for monitoring)
    const user = verificationResult.user;
    context.log(`Authenticated user: ${user.uid} (${user.email})`);

    return {
      success: true,
      user: user,
      response: null
    };

  } catch (error) {
    context.log.error('Authentication middleware error:', error);
    
    return {
      success: false,
      user: null,
      response: {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Authentication system error',
          message: 'Please try again later'
        })
      }
    };
  }
}

/**
 * Optional: Role-based authorization middleware
 * 
 * Checks if user has required permissions/roles
 */
async function roleMiddleware(context, req, requiredRoles = []) {
  const authResult = await authMiddleware(context, req);
  
  if (!authResult.success) {
    return authResult;
  }

  const user = authResult.user;
  
  // Check roles if specified
  if (requiredRoles.length > 0) {
    const userRoles = user.custom_claims?.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return {
        success: false,
        user: null,
        response: {
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: 'Insufficient permissions',
            message: `Required roles: ${requiredRoles.join(', ')}`
          })
        }
      };
    }
  }

  return authResult;
}

/**
 * Utility to create authenticated Azure Function wrapper
 * 
 * Usage:
 * const { createAuthenticatedFunction } = require('../shared/authMiddleware');
 * 
 * module.exports = createAuthenticatedFunction(async function (context, req, user) {
 *   // Your protected function logic here
 *   // 'user' contains the authenticated Firebase user
 * });
 */
function createAuthenticatedFunction(handlerFunction, options = {}) {
  return async function (context, req) {
    const { requiredRoles = [], skipAuth = false } = options;
    
    if (skipAuth) {
      return await handlerFunction(context, req, null);
    }

    const authResult = requiredRoles.length > 0 
      ? await roleMiddleware(context, req, requiredRoles)
      : await authMiddleware(context, req);

    if (!authResult.success) {
      context.res = authResult.response;
      return;
    }

    // Call the actual handler with the authenticated user
    return await handlerFunction(context, req, authResult.user);
  };
}

/**
 * Middleware for admin-only endpoints
 */
function adminMiddleware(context, req) {
  return roleMiddleware(context, req, ['admin']);
}

/**
 * Health check endpoint (no auth required)
 */
function createHealthCheckResponse() {
  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Azure Functions Auth Middleware'
    })
  };
}

module.exports = {
  authMiddleware,
  roleMiddleware,
  adminMiddleware,
  createAuthenticatedFunction,
  createHealthCheckResponse,
  initializeFirebase,
  verifyFirebaseToken
};
