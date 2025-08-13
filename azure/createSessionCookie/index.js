const { createAuthenticatedFunction, initializeFirebase } = require('../shared/authMiddleware');

/**
 * Internal function that handles session cookie creation
 * Requires authentication - user must provide valid Firebase ID token
 */
async function handleCreateSessionCookie(context, req, authenticatedUser) {
  const startTime = Date.now();

  // Set CORS headers
  context.res = {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const auth = await initializeFirebase();

    // Get idToken from request body or use the authenticated token
    const { idToken, expiresIn = 5 * 24 * 60 * 60 * 1000 } = req.body || {}; // 5 days default
    const tokenToUse = idToken || req.headers.authorization?.replace('Bearer ', '');
    
    if (!tokenToUse) {
      context.res.status = 400;
      context.res.body = { 
        error: 'ID token is required in request body or Authorization header',
        code: 'MISSING_TOKEN'
      };
      return;
    }
    
    // Validate expiresIn (max 2 weeks)
    const maxExpiresIn = 14 * 24 * 60 * 60 * 1000; // 2 weeks
    const validExpiresIn = Math.min(expiresIn, maxExpiresIn);
    
    // Create session cookie
    const sessionCookie = await auth.createSessionCookie(tokenToUse, { 
      expiresIn: validExpiresIn 
    });
    
    const duration = Date.now() - startTime;
    context.log(`Session cookie created successfully for user: ${authenticatedUser.uid} (${duration}ms)`);
    
    context.res.status = 200;
    context.res.body = {
      success: true,
      sessionCookie,
      expiresIn: validExpiresIn,
      expiresAt: new Date(Date.now() + validExpiresIn).toISOString(),
      userId: authenticatedUser.uid,
      method: 'azure-function'
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    context.log.error(`Session cookie creation error (${duration}ms):`, error);
    
    let statusCode = 500;
    let errorCode = 'SESSION_CREATION_FAILED';
    
    if (error.code === 'auth/id-token-expired') {
      statusCode = 401;
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.code === 'auth/id-token-revoked') {
      statusCode = 401;
      errorCode = 'TOKEN_REVOKED';
    } else if (error.code === 'auth/argument-error') {
      statusCode = 400;
      errorCode = 'INVALID_ARGUMENT';
    }
    
    context.res.status = statusCode;
    context.res.body = { 
      error: 'Failed to create session cookie',
      code: errorCode,
      details: error.message 
    };
  }
}

// Export authenticated function
module.exports = createAuthenticatedFunction(handleCreateSessionCookie);
