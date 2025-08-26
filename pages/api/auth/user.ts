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
    // Check for session cookie (same logic as middleware)
    const sessionCookie = req.cookies.session;
    
    if (!sessionCookie) {
      return res.status(401).json({ error: 'No session cookie found' });
    }

    const sessionValue = sessionCookie.trim();
    
    // Handle mock tokens for development
    if (sessionValue.startsWith('mock-token-')) {
      return res.status(200).json({
        success: true,
        user: {
          uid: 'mock-user',
          id: 'mock-user',
          name: 'Mock User',
          displayName: 'Mock User',
          email: 'mock@example.com',
          picture: null,
          email_verified: true,
          provider: 'mock'
        }
      });
    }
    
    // For Firebase JWT tokens, decode payload (same as middleware)
    if (sessionValue.includes('.')) {
      const parts = sessionValue.split('.');
      if (parts.length >= 3) {
        try {
          // Decode the payload without full verification (lightweight)
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          
          // Check if token is expired
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            return res.status(401).json({ error: 'Session token expired' });
          }
          
          // Return user information from JWT payload
          return res.status(200).json({
            success: true,
            user: {
              uid: payload.uid || payload.sub,
              id: payload.uid || payload.sub,
              name: payload.name || payload.displayName || payload.email?.split('@')[0] || 'User',
              displayName: payload.name || payload.displayName || payload.email?.split('@')[0] || 'User',
              email: payload.email,
              picture: payload.picture || payload.avatar_url,
              email_verified: payload.email_verified || false,
              provider: payload.firebase?.identities ? Object.keys(payload.firebase.identities)[0] : 'unknown'
            }
          });
        } catch (decodeError) {
          console.error('Failed to decode JWT payload:', decodeError);
          return res.status(401).json({ error: 'Invalid token format' });
        }
      }
    }
    
    return res.status(401).json({ error: 'Invalid session format' });
    
  } catch (error) {
    console.error('Error getting current user:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
}
