const { verifyFirebaseToken } = require('../shared/authMiddleware');

/**
 * Token verification Azure Function
 * 
 * This function verifies Firebase ID tokens. It can be called in two ways:
 * 1. With a token in the request body (for service-to-service calls)
 * 2. With Authorization Bearer header (for authenticated requests)
 */
module.exports = async function (context, req) {
  const startTime = Date.now();

  // Set CORS headers
  context.res = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    }
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    context.res.status = 204;
    context.res.body = '';
    return;
  }

  try {
    // Get token from request body or header
    let token;
    const { idToken } = req.body || {};
    const authHeader = req.headers.authorization;
    
    if (idToken) {
      token = idToken;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    if (!token) {
      context.res.status = 400;
      context.res.body = { 
        error: 'No token provided in request body or Authorization header',
        code: 'MISSING_TOKEN'
      };
      return;
    }
    
    // Verify the token using shared middleware
    const verificationResult = await verifyFirebaseToken(token);
    
    if (!verificationResult.success) {
      context.res.status = 401;
      context.res.body = { 
        error: 'Token verification failed',
        code: 'INVALID_TOKEN',
        details: verificationResult.error
      };
      return;
    }

    const user = verificationResult.user;
    const duration = Date.now() - startTime;
    context.log(`Token verified for user: ${user.uid} (${duration}ms)`);
    
    // Return verified token data (compatible with existing client expectations)
    context.res.status = 200;
    context.res.body = {
      valid: true,
      success: true,
      uid: user.uid,
      email: user.email,
      verified: true,
      verificationMethod: 'azure-function',
      decoded: {
        uid: user.uid,
        email: user.email,
        email_verified: user.email_verified,
        name: user.name,
        picture: user.picture,
        firebase: user.firebase
      },
      // Legacy format for backward compatibility
      claims: {
        uid: user.uid,
        email: user.email,
        email_verified: user.email_verified,
        name: user.name,
        picture: user.picture
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    context.log.error(`Token verification error (${duration}ms):`, error);
    
    context.res.status = 500;
    context.res.body = { 
      valid: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    };
  }
};
