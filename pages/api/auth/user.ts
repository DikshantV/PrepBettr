import { NextApiRequest, NextApiResponse } from 'next';
import { verifyAuthHeader } from '@/lib/shared/auth';

/**
 * API endpoint to get current user information
 * Provides client-safe access to user data without bundling server-only modules
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication from Authorization header or cookies
    const authHeader = req.headers.authorization;
    const sessionCookie = req.cookies.session;

    let authResult;
    
    if (authHeader) {
      // Use Authorization header if present
      authResult = await verifyAuthHeader(authHeader);
    } else if (sessionCookie) {
      // Fall back to session cookie
      const { getUnifiedAuth } = await import('@/lib/shared/auth');
      const auth = getUnifiedAuth();
      const verificationResult = await auth.verifySessionCookie(sessionCookie);
      
      authResult = {
        success: verificationResult.valid,
        user: verificationResult.user || null,
        error: verificationResult.error
      };
    } else {
      return res.status(401).json({ error: 'No authentication provided' });
    }

    if (!authResult.success || !authResult.user) {
      return res.status(401).json({ error: authResult.error || 'Authentication failed' });
    }

    // Return user information
    return res.status(200).json({
      success: true,
      user: {
        uid: authResult.user.uid,
        id: authResult.user.uid, // Alias for compatibility
        name: authResult.user.name,
        displayName: authResult.user.name, // Alias for compatibility
        email: authResult.user.email,
        picture: authResult.user.picture,
        email_verified: authResult.user.email_verified,
        provider: authResult.user.provider
      }
    });
    
  } catch (error) {
    console.error('Error getting current user:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
}
