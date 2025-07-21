const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Verify Firebase ID Token
 * This function provides server-side token verification as a Cloud Function
 */
exports.verifyToken = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { idToken } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!idToken && !authHeader) {
      return res.status(400).json({ error: 'No token provided' });
    }
    
    const token = idToken || authHeader.split('Bearer ')[1];
    
    if (!token) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    // Verify the token using Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    
    // Additional server-side validation
    const now = Math.floor(Date.now() / 1000);
    if (decodedToken.exp < now) {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    // Log successful verification
    console.log(`Token verified for user: ${decodedToken.uid}`);
    
    // Return verified token data
    res.json({
      success: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      verified: true,
      verificationMethod: 'cloud-function',
      claims: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        name: decodedToken.name,
        picture: decodedToken.picture,
        iss: decodedToken.iss,
        aud: decodedToken.aud,
        auth_time: decodedToken.auth_time,
        iat: decodedToken.iat,
        exp: decodedToken.exp
      }
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    
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
    
    res.status(401).json({ 
      error: errorMessage,
      code: errorCode,
      details: error.message 
    });
  }
});

/**
 * Verify user permissions using custom claims
 */
exports.verifyPermissions = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const { requiredPermissions = [] } = req.body;
    
    if (!authHeader) {
      return res.status(400).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    
    // Get user's custom claims (permissions)
    const userRecord = await admin.auth().getUser(decodedToken.uid);
    const userPermissions = userRecord.customClaims?.permissions || [];
    const userRoles = userRecord.customClaims?.roles || [];
    
    // Check if user has all required permissions
    const hasPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission) || userRoles.includes('admin')
    );
    
    console.log(`Permission check for user ${decodedToken.uid}: ${hasPermissions ? 'GRANTED' : 'DENIED'}`);
    
    res.json({
      success: true,
      hasPermissions,
      permissions: userPermissions,
      roles: userRoles,
      uid: decodedToken.uid,
      requiredPermissions
    });
    
  } catch (error) {
    console.error('Permission verification error:', error);
    res.status(401).json({ 
      error: 'Permission check failed',
      details: error.message 
    });
  }
});

/**
 * Create session cookie
 */
exports.createSessionCookie = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { idToken, expiresIn = 5 * 24 * 60 * 60 * 1000 } = req.body; // 5 days default
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }
    
    // Create session cookie
    const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
    
    console.log('Session cookie created successfully');
    
    res.json({
      success: true,
      sessionCookie,
      expiresIn
    });
    
  } catch (error) {
    console.error('Session cookie creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create session cookie',
      details: error.message 
    });
  }
});

/**
 * Verify session cookie
 */
exports.verifySessionCookie = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { sessionCookie } = req.body;
    
    if (!sessionCookie) {
      return res.status(400).json({ error: 'Session cookie is required' });
    }
    
    // Verify session cookie
    const decodedToken = await admin.auth().verifySessionCookie(sessionCookie, true);
    
    console.log(`Session cookie verified for user: ${decodedToken.uid}`);
    
    res.json({
      success: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      verified: true,
      verificationMethod: 'session-cookie',
      claims: decodedToken
    });
    
  } catch (error) {
    console.error('Session cookie verification error:', error);
    res.status(401).json({ 
      error: 'Invalid session cookie',
      details: error.message 
    });
  }
});

/**
 * Set custom user claims (admin only)
 */
exports.setCustomClaims = functions.https.onCall(async (data, context) => {
  // Check if request is from an authenticated admin user
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admin users can set custom claims'
    );
  }
  
  const { uid, claims } = data;
  
  if (!uid || !claims) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID and claims are required'
    );
  }
  
  try {
    await admin.auth().setCustomUserClaims(uid, claims);
    console.log(`Custom claims set for user: ${uid}`, claims);
    
    return {
      success: true,
      message: 'Custom claims set successfully'
    };
  } catch (error) {
    console.error('Error setting custom claims:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to set custom claims'
    );
  }
});
