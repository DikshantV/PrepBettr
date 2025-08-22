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
    
    // For server-side checks without explicit token
    return false;
  } catch {
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
    if (!token) {
      return null;
    }
    
    const result = await verifyToken(token);
    return result.valid ? result.user || null : null;
  } catch {
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
