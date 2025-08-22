/**
 * Unified Authentication Azure Function
 * 
 * Consolidates all Firebase authentication endpoints into a single HTTP trigger.
 * Replaces: verifyToken, verifyPermissions, verifySessionCookie, createSessionCookie
 * 
 * Routes:
 * - POST /api/unifiedAuth?action=verify         → Token verification
 * - POST /api/unifiedAuth?action=session        → Session cookie creation/validation  
 * - POST /api/unifiedAuth?action=permissions    → Permission checking
 * - POST /api/unifiedAuth?action=claims         → Custom claims management (admin)
 * - GET  /api/unifiedAuth?action=status         → Health check
 * 
 * @version 2.0.0
 * @author PrepBettr Platform Team
 */

const coreAuth = require('../shared/core-auth');
const { withTelemetry } = require('../shared/core-auth/telemetry');

// ===== CORS CONFIGURATION =====

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Functions-Key',
  'Content-Type': 'application/json'
};

// ===== REQUEST HANDLERS =====

/**
 * Handle token verification requests
 */
async function handleVerifyToken(context, req) {
  context.log('Processing token verification request');
  
  try {
    const { idToken } = req.body || {};
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    // Get token from body or Authorization header
    const token = idToken || (authHeader ? authHeader.replace('Bearer ', '') : null);
    
    if (!token) {
      return createErrorResponse(400, 'No token provided', 'MISSING_TOKEN');
    }
    
    const result = await coreAuth.verifyIdToken(token);
    
    if (result.success) {
      context.log(`Token verified successfully for user: ${result.user.uid}`);
      
      // Return format matching Firebase Cloud Function response
      return {
        status: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          uid: result.user.uid,
          email: result.user.email,
          verified: true,
          verificationMethod: result.verificationMethod,
          claims: {
            uid: result.user.uid,
            email: result.user.email,
            email_verified: result.user.email_verified,
            name: result.user.name,
            picture: result.user.picture,
            iss: `https://securetoken.google.com/${result.user.custom_claims?.aud || 'unknown'}`,
            aud: result.user.custom_claims?.aud || 'unknown',
            auth_time: result.user.auth_time,
            iat: result.user.iat,
            exp: result.user.exp
          }
        })
      };
    } else {
      context.log(`Token verification failed: ${result.error}`);
      return createErrorResponse(401, result.error, result.errorCode);
    }
    
  } catch (error) {
    context.log.error('Token verification error:', error);
    return createErrorResponse(500, 'Token verification failed', 'VERIFICATION_ERROR');
  }
}

/**
 * Handle session cookie operations (creation and validation)
 */
async function handleSessionCookie(context, req) {
  const method = req.method.toUpperCase();
  context.log(`Processing session cookie ${method} request`);
  
  try {
    if (method === 'POST') {
      // Create session cookie
      const { idToken, expiresIn } = req.body || {};
      
      if (!idToken) {
        return createErrorResponse(400, 'ID token is required', 'MISSING_TOKEN');
      }
      
      const result = await coreAuth.createSessionCookie(idToken, { expiresIn });
      
      if (result.success) {
        context.log('Session cookie created successfully');
        
        return {
          status: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: true,
            sessionCookie: result.sessionCookie,
            expiresIn: result.expiresIn,
            expiresAt: new Date(Date.now() + result.expiresIn).toISOString(),
            method: 'azure-unified-auth'
          })
        };
      } else {
        context.log(`Session cookie creation failed: ${result.error}`);
        return createErrorResponse(400, result.error, 'SESSION_CREATION_FAILED');
      }
      
    } else if (method === 'GET') {
      // Verify session cookie
      const sessionCookie = req.query.sessionCookie || req.headers['x-session-cookie'];
      
      if (!sessionCookie) {
        return createErrorResponse(400, 'Session cookie is required', 'MISSING_COOKIE');
      }
      
      const result = await coreAuth.verifySessionCookie(sessionCookie);
      
      if (result.success) {
        context.log(`Session cookie verified for user: ${result.user.uid}`);
        
        return {
          status: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: true,
            uid: result.user.uid,
            email: result.user.email,
            verified: true,
            verificationMethod: result.verificationMethod,
            claims: result.user
          })
        };
      } else {
        context.log(`Session cookie verification failed: ${result.error}`);
        return createErrorResponse(401, result.error, result.errorCode);
      }
    }
    
    return createErrorResponse(405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
    
  } catch (error) {
    context.log.error('Session cookie operation error:', error);
    return createErrorResponse(500, 'Session operation failed', 'SESSION_ERROR');
  }
}

/**
 * Handle permission checking requests
 */
async function handlePermissions(context, req) {
  context.log('Processing permissions check request');
  
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const { requiredPermissions = [] } = req.body || {};
    
    if (!authHeader) {
      return createErrorResponse(400, 'Authorization header is required', 'MISSING_AUTH');
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // First verify the token
    const authResult = await coreAuth.verifyIdToken(token);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(401, authResult.error, authResult.errorCode);
    }
    
    // Check permissions
    const permissionsResult = await coreAuth.checkPermissions(authResult.user, requiredPermissions);
    
    context.log(`Permission check for user ${authResult.user.uid}: ${permissionsResult.hasPermissions ? 'GRANTED' : 'DENIED'}`);
    
    return {
      status: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        hasPermissions: permissionsResult.hasPermissions,
        permissions: permissionsResult.userPermissions,
        roles: permissionsResult.userRoles,
        uid: authResult.user.uid,
        requiredPermissions: permissionsResult.requiredPermissions
      })
    };
    
  } catch (error) {
    context.log.error('Permission check error:', error);
    return createErrorResponse(500, 'Permission check failed', 'PERMISSION_ERROR');
  }
}

/**
 * Handle custom claims management (admin only)
 */
async function handleCustomClaims(context, req) {
  context.log('Processing custom claims request');
  
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const { uid, claims } = req.body || {};
    
    if (!authHeader) {
      return createErrorResponse(400, 'Authorization header is required', 'MISSING_AUTH');
    }
    
    if (!uid || !claims) {
      return createErrorResponse(400, 'UID and claims are required', 'MISSING_PARAMETERS');
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify admin token
    const authResult = await coreAuth.verifyIdToken(token);
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(401, authResult.error, authResult.errorCode);
    }
    
    // Set custom claims (includes admin permission check)
    const result = await coreAuth.setCustomUserClaims(authResult.user, uid, claims);
    
    if (result.success) {
      context.log(`Custom claims set successfully for user: ${uid}`);
      
      return {
        status: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          message: 'Custom claims set successfully',
          targetUserId: uid,
          claimsSet: Object.keys(claims)
        })
      };
    } else {
      context.log(`Custom claims failed: ${result.error}`);
      return createErrorResponse(403, result.error, 'CLAIMS_UPDATE_FAILED');
    }
    
  } catch (error) {
    context.log.error('Custom claims error:', error);
    return createErrorResponse(500, 'Custom claims operation failed', 'CLAIMS_ERROR');
  }
}

/**
 * Handle health check requests
 */
async function handleHealthCheck(context, req) {
  context.log('Processing health check request');
  
  try {
    const health = await coreAuth.healthCheck();
    const status = coreAuth.getAuthStatus();
    
    const healthData = {
      status: health.status,
      timestamp: new Date().toISOString(),
      services: health.services,
      authentication: {
        firebaseInitialized: status.firebaseInitialized,
        adminAppsCount: status.adminAppsCount,
        telemetryEnabled: status.telemetryEnabled
      },
      version: '2.0.0',
      consolidatedEndpoints: ['verify', 'session', 'permissions', 'claims']
    };
    
    if (health.error) {
      healthData.error = health.error;
    }
    
    return {
      status: health.status === 'healthy' ? 200 : 503,
      headers: CORS_HEADERS,
      body: JSON.stringify(healthData)
    };
    
  } catch (error) {
    context.log.error('Health check error:', error);
    return createErrorResponse(500, 'Health check failed', 'HEALTH_CHECK_ERROR');
  }
}

// ===== MAIN FUNCTION =====

/**
 * Main Azure Function handler with route-based switching
 */
async function unifiedAuthHandler(context, req) {
  const startTime = Date.now();
  context.log(`Unified Auth Function - ${req.method} ${req.url}`);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    context.res = {
      status: 204,
      headers: CORS_HEADERS,
      body: ''
    };
    return;
  }
  
  try {
    const action = req.query.action || 'status';
    let response;
    
    context.log(`Processing action: ${action}`);
    
    switch (action.toLowerCase()) {
      case 'verify':
        response = await handleVerifyToken(context, req);
        break;
        
      case 'session':
        response = await handleSessionCookie(context, req);
        break;
        
      case 'permissions':
        response = await handlePermissions(context, req);
        break;
        
      case 'claims':
        response = await handleCustomClaims(context, req);
        break;
        
      case 'status':
      case 'health':
        response = await handleHealthCheck(context, req);
        break;
        
      default:
        response = createErrorResponse(400, `Unknown action: ${action}`, 'UNKNOWN_ACTION');
    }
    
    const duration = Date.now() - startTime;
    context.log(`Request completed in ${duration}ms - Status: ${response.status}`);
    
    context.res = response;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    context.log.error(`Unified Auth Function error (${duration}ms):`, error);
    
    context.res = createErrorResponse(500, 'Internal server error', 'INTERNAL_ERROR');
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Create standardized error response
 */
function createErrorResponse(status, message, code) {
  return {
    status,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString(),
      service: 'azure-unified-auth'
    })
  };
}

// ===== TELEMETRY WRAPPER =====

// Wrap main handler with telemetry
const telemetryWrappedHandler = withTelemetry('unified-auth', unifiedAuthHandler);

// ===== EXPORTS =====

module.exports = telemetryWrappedHandler;

// ===== BACKWARD COMPATIBILITY =====

// For testing and development
module.exports.handlers = {
  handleVerifyToken,
  handleSessionCookie,
  handlePermissions,
  handleCustomClaims,
  handleHealthCheck
};

module.exports.utils = {
  createErrorResponse,
  CORS_HEADERS
};
