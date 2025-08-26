/**
 * Authentication Actions
 * 
 * Compatibility layer that bridges components with the unified auth system
 */

import {
  getUnifiedAuth,
  verifyToken,
  AuthenticatedUser,
  AuthResult
} from '@/lib/shared/auth';
import { cookies } from 'next/headers';

/**
 * Check if the current user is authenticated
 * @param token - Optional token to verify
 * @returns Promise<boolean>
 */
export async function isAuthenticated(token?: string): Promise<boolean> {
  try {
    const auth = getUnifiedAuth();
    
    if (token) {
      const result = await verifyToken(token);
      return result.valid;
    }
    
    // For server-side checks, read session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) {
      console.log('🔒 Server auth check: No session cookie found');
      return false;
    }
    
    const sessionValue = sessionCookie.value.trim();
    
    // Accept mock tokens for development
    if (sessionValue.startsWith('mock-token-')) {
      console.log('🔒 Server auth check: Found mock token');
      return true;
    }
    
    // For Firebase session cookies/tokens, validate structure
    if (sessionValue.includes('.')) {
      const parts = sessionValue.split('.');
      if (parts.length >= 3) {
        try {
          // Try to decode the payload without verification (for performance)
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          
          // Check if token is not obviously expired
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            console.log('🔒 Server auth check: Token expired');
            return false;
          }
          
          console.log('🔒 Server auth check: Valid JWT structure found');
          return true;
        } catch (decodeError) {
          console.error('🔒 Server auth check: Failed to decode token payload:', decodeError);
          return false;
        }
      }
    }
    
    // Fallback for non-JWT tokens
    const hasValidLength = sessionValue.length > 0;
    console.log('🔒 Server auth check: Non-JWT token validation:', hasValidLength);
    
    return hasValidLength;
  } catch (error) {
    console.error('🔒 Server auth check error:', error);
    return false;
  }
}

/**
 * Get the current authenticated user
 * @param token - Auth token
 * @returns Promise<AuthenticatedUser | null>
 */
export async function getCurrentUser(token?: string): Promise<AuthenticatedUser | null> {
  try {
    if (token) {
      const result = await verifyToken(token);
      return result.valid ? result.user || null : null;
    }
    
    // For server-side, try to extract user from session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    
    if (!sessionCookie?.value) {
      console.log('🔒 Server getCurrentUser: No session cookie found');
      return null;
    }
    
    const sessionValue = sessionCookie.value.trim();
    
    // Handle mock tokens for development
    if (sessionValue.startsWith('mock-token-')) {
      console.log('🔒 Server getCurrentUser: Using mock user');
      return { uid: 'mock-user', email: 'mock@example.com', email_verified: true };
    }
    
    // For Firebase session cookies/tokens, extract user from payload
    if (sessionValue.includes('.')) {
      const parts = sessionValue.split('.');
      if (parts.length >= 3) {
        try {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          
          // Check if token is expired
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            console.log('🔒 Server getCurrentUser: Token expired');
            return null;
          }
          
          console.log('🔒 Server getCurrentUser: Extracted user from session cookie');
          return {
            uid: payload.uid || payload.sub || 'unknown',
            email: payload.email || 'unknown@session.com',
            email_verified: payload.email_verified || false,
            name: payload.name || payload.display_name
          };
        } catch (decodeError) {
          console.error('🔒 Server getCurrentUser: Failed to decode session payload:', decodeError);
          return null;
        }
      }
    }
    
    // Fallback for non-JWT tokens - return minimal user info
    if (sessionValue.length > 0) {
      console.log('🔒 Server getCurrentUser: Using fallback session user');
      return { uid: 'session-user', email: 'unknown@session.com', email_verified: false };
    }
    
    return null;
  } catch (error) {
    console.error('🔒 Server getCurrentUser error:', error);
    return null;
  }
}

/**
 * Sign out the current user (client-side)
 * This is a compatibility function - actual sign out happens on client
 */
export async function signOut(): Promise<void> {
  // In a real implementation, this would handle server-side logout
  // For now, this is a placeholder for client-side logout
  if (typeof window !== 'undefined') {
    // Clear any client-side auth state
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
  }
}

/**
 * Sign in with credentials (server-side validation)
 * @param token - Firebase ID token
 * @returns Promise<AuthResult>
 */
export async function signIn(token: string): Promise<AuthResult> {
  try {
    const result = await verifyToken(token);
    return {
      success: result.valid,
      user: result.user || null,
      error: result.error
    };
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
}

/**
 * Verify Firebase token (legacy compatibility)
 * @param token - Firebase ID token
 * @returns Promise<AuthResult>
 */
export async function verifyFirebaseToken(token: string): Promise<AuthResult> {
  return signIn(token);
}

// Re-export types for convenience
export type { AuthenticatedUser, AuthResult };
