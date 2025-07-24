// Unused CLOUD_FUNCTION_VERIFY_TOKEN string from cloud-functions-verification

export const CLOUD_FUNCTION_VERIFY_TOKEN = `
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

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
    
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    
    // Additional server-side validation
    const now = Math.floor(Date.now() / 1000);
    if (decodedToken.exp < now) {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    // Return verified token data
    res.json({
      success: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      verified: true,
      claims: decodedToken
    });
    
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ 
      error: 'Invalid token',
      details: error.message 
    });
  }
});

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
    const { requiredPermissions } = req.body;
    
    if (!authHeader) {
      return res.status(400).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    
    // Get user's custom claims (permissions)
    const userRecord = await admin.auth().getUser(decodedToken.uid);
    const userPermissions = userRecord.customClaims?.permissions || [];
    
    // Check if user has all required permissions
    const hasPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );
    
    res.json({
      success: true,
      hasPermissions,
      permissions: userPermissions,
      uid: decodedToken.uid
    });
    
  } catch (error) {
    console.error('Permission verification error:', error);
    res.status(401).json({ 
      error: 'Permission check failed',
      details: error.message 
    });
  }
});
`;
