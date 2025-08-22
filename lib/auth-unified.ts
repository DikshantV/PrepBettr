/**
 * Unified Basic Authentication Utility
 * 
 * Replacement for lib/auth.ts using the unified auth library
 * Provides simplified authentication functions for basic use cases
 */

import { NextRequest } from 'next/server';
import { 
  verifyAuthHeader,
  getUserFromSessionCookie,
  extractUserFromRequest,
  AuthenticatedUser,
  UserSession,
  AuthResult,
  createNextHealthResponse
} from '@/lib/shared/auth';

// ===== SIMPLIFIED AUTH INTERFACE =====

/**
 * Verify session from NextRequest
 * 
 * Replaces the old verifySession function with unified implementation
 */
export async function verifySession(request: NextRequest): Promise<UserSession | null> {
  try {
    const user = await extractUserFromRequest(request);
    
    if (!user) {
      return null;
    }

    return {
      userId: user.uid,
      email: user.email,
      verified: user.email_verified
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

/**
 * Require authentication and return user session
 * 
 * Replaces the old requireAuth function
 */
export async function requireAuth(request: NextRequest): Promise<UserSession> {
  const session = await verifySession(request);
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}

/**
 * Get authenticated user from request
 * 
 * Enhanced version that returns full user details
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  return extractUserFromRequest(request);
}

/**
 * Check if request is authenticated
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const user = await getAuthenticatedUser(request);
  return !!user;
}

/**
 * Verify token directly (for custom implementations)
 */
export async function verifyToken(token: string): Promise<AuthResult> {
  const { verifyToken: coreVerifyToken } = await import('@/lib/shared/auth');
  const result = await coreVerifyToken(token);
  
  return {
    success: result.valid,
    user: result.user || null,
    error: result.error
  };
}

// ===== SESSION MANAGEMENT =====

/**
 * Get user from session cookie (for server components)
 * 
 * Unified implementation replacing the old function
 */
export async function getUserFromSession(sessionCookie: string): Promise<AuthResult> {
  try {
    const user = await getUserFromSessionCookie(sessionCookie);
    
    return {
      success: !!user,
      user: user,
      error: user ? undefined : 'Session verification failed'
    };
  } catch (error) {
    return {
      success: false,
      user: null,
      error: error instanceof Error ? error.message : 'Session verification failed'
    };
  }
}

/**
 * Extract user session from various sources
 */
export async function extractSession(request: NextRequest): Promise<UserSession | null> {
  try {
    // Try authorization header first
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const authResult = await verifyAuthHeader(authHeader);
      if (authResult.success && authResult.user) {
        return {
          userId: authResult.user.uid,
          email: authResult.user.email,
          verified: authResult.user.email_verified
        };
      }
    }

    // Try session cookie as fallback
    const sessionCookie = request.cookies.get('session')?.value;
    if (sessionCookie) {
      const user = await getUserFromSessionCookie(sessionCookie);
      if (user) {
        return {
          userId: user.uid,
          email: user.email,
          verified: user.email_verified
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Session extraction error:', error);
    return null;
  }
}

// ===== ROLE AND PERMISSION HELPERS =====

/**
 * Check if user has specific role
 */
export async function userHasRole(request: NextRequest, role: string): Promise<boolean> {
  const user = await getAuthenticatedUser(request);
  if (!user) return false;
  
  const roles = user.custom_claims?.roles || [];
  return roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export async function userHasAnyRole(request: NextRequest, requiredRoles: string[]): Promise<boolean> {
  const user = await getAuthenticatedUser(request);
  if (!user) return false;
  
  const userRoles = user.custom_claims?.roles || [];
  return requiredRoles.some(role => userRoles.includes(role));
}

/**
 * Check if user is admin
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  return userHasRole(request, 'admin');
}

/**
 * Get user roles
 */
export async function getUserRoles(request: NextRequest): Promise<string[]> {
  const user = await getAuthenticatedUser(request);
  return user?.custom_claims?.roles || [];
}

// ===== UTILITY FUNCTIONS =====

/**
 * Health check utility (no auth required)
 * 
 * Replaces the old createHealthCheckResponse
 */
export function createHealthCheckResponse() {
  return createNextHealthResponse();
}

/**
 * Create error response for authentication failures
 */
export function createAuthErrorResponse(message: string, statusCode: number = 401) {
  return new Response(
    JSON.stringify({
      error: message,
      timestamp: new Date().toISOString()
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

// ===== PERFORMANCE MONITORING =====

/**
 * Get authentication performance metrics
 */
export function getAuthPerformanceMetrics(): Record<string, any> {
  const { getAuthMetrics } = require('@/lib/shared/auth');
  return getAuthMetrics();
}

/**
 * Benchmark authentication performance
 */
export async function benchmarkAuth(
  request: NextRequest,
  iterations: number = 100
): Promise<Record<string, any>> {
  const { benchmarkNextAuth } = await import('@/lib/shared/auth');
  return benchmarkNextAuth(request, iterations);
}

// ===== MIGRATION HELPERS =====

/**
 * Validate that unified auth is working correctly
 */
export async function validateUnifiedAuth(): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    const { authSystemHealthCheck } = await import('@/lib/shared/auth');
    const health = await authSystemHealthCheck();
    
    if (!health.healthy) {
      issues.push('Authentication system health check failed');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  } catch (error) {
    issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      valid: false,
      issues
    };
  }
}

// ===== LEGACY TYPE EXPORTS =====

// Re-export types for backward compatibility
export type { AuthenticatedUser, UserSession, AuthResult };
