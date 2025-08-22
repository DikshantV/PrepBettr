/**
 * Auth Middleware Compatibility Layer
 * 
 * Provides backward compatibility for existing middleware usage
 * Routes to the unified auth system
 */

import {
  verifyToken,
  AuthResult,
  AuthenticatedUser
} from '@/lib/shared/auth';

/**
 * Verify Firebase token (legacy compatibility function)
 * @param token - Firebase ID token to verify
 * @returns Promise<AuthResult>
 */
export async function verifyFirebaseToken(token: string): Promise<AuthResult> {
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
      error: error instanceof Error ? error.message : 'Token verification failed'
    };
  }
}

/**
 * Extract user from token
 * @param token - Auth token
 * @returns Promise<AuthenticatedUser | null>
 */
export async function extractUserFromToken(token: string): Promise<AuthenticatedUser | null> {
  const result = await verifyFirebaseToken(token);
  return result.success ? result.user : null;
}

// Re-export types
export type { AuthResult, AuthenticatedUser };
