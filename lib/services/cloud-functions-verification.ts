"use server";

/**
 * Cloud Functions verification service
 * Deploy verification logic to Firebase Cloud Functions for additional security
 */
class CloudFunctionsVerificationService {
  private readonly CLOUD_FUNCTIONS_URL = process.env.FIREBASE_FUNCTIONS_URL || 
    `https://us-central1-${process.env.FIREBASE_PROJECT_ID}.cloudfunctions.net`;

  /**
   * Verify token using deployed Cloud Function
   */
  async verifyTokenWithCloudFunction(idToken: string, functionName: string = 'verifyToken'): Promise<CloudFunctionResult> {
    try {
      const response = await fetch(`${this.CLOUD_FUNCTIONS_URL}/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Send token in header
        },
        body: JSON.stringify({
          idToken,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        error: null
      };
    } catch (error) {
      console.error('Cloud Function verification failed:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify user permissions using Cloud Function
   */
  async verifyUserPermissions(idToken: string, requiredPermissions: string[]): Promise<PermissionResult> {
    try {
      const response = await fetch(`${this.CLOUD_FUNCTIONS_URL}/verifyPermissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          requiredPermissions,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Permission check failed: HTTP ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        hasPermissions: result.hasPermissions,
        permissions: result.permissions,
        error: null
      };
    } catch (error) {
      console.error('Permission verification failed:', error);
      return {
        success: false,
        hasPermissions: false,
        permissions: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Sample Cloud Function code (to be deployed to Firebase)
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

// Types
interface CloudFunctionResult {
  success: boolean;
  data: any | null;
  error: string | null;
}

interface PermissionResult {
  success: boolean;
  hasPermissions: boolean;
  permissions: string[];
  error: string | null;
}

// Export singleton instance
export const cloudFunctionsVerification = new CloudFunctionsVerificationService();

// Helper functions
export async function verifyTokenWithCloudFunction(idToken: string): Promise<CloudFunctionResult> {
  return await cloudFunctionsVerification.verifyTokenWithCloudFunction(idToken);
}

export async function verifyUserPermissions(idToken: string, permissions: string[]): Promise<PermissionResult> {
  return await cloudFunctionsVerification.verifyUserPermissions(idToken, permissions);
}
