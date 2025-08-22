/**
 * Unified Next.js Authentication Middleware
 * 
 * Replacement for lib/middleware/authMiddleware.ts using the unified auth library
 * Eliminates code duplication and provides consistent authentication across platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  nextAuthMiddleware,
  nextOptionalAuth,
  nextRoleMiddleware,
  nextAdminMiddleware,
  withNextAuth,
  withNextAdminAuth,
  withNextRoleAuth,
  getUserFromSessionCookie,
  extractUserFromRequest,
  AuthenticatedUser,
  AuthMiddlewareOptions,
  AuthResult
} from '@/lib/shared/auth';

// ===== MAIN MIDDLEWARE EXPORTS =====

/**
 * Firebase Authentication Middleware for Next.js API Routes
 * 
 * This middleware validates Firebase ID tokens and ensures only authenticated users
 * can access protected API endpoints.
 * 
 * Replaces the old authMiddleware with unified implementation
 */
export async function authMiddleware(
  request: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<{
  success: boolean;
  user: AuthenticatedUser | null;
  response?: NextResponse;
}> {
  const result = await nextAuthMiddleware(request, options);
  
  return {
    success: result.success,
    user: result.user,
    response: result.response
  };
}

/**
 * Verify Firebase ID token (unified implementation)
 */
export async function verifyFirebaseToken(idToken: string): Promise<AuthResult> {
  const { verifyToken } = await import('@/lib/shared/auth');
  const result = await verifyToken(idToken);
  
  return {
    success: result.valid,
    user: result.user || null,
    error: result.error
  };
}

/**
 * Role-based authorization middleware
 */
export async function roleMiddleware(
  request: NextRequest, 
  requiredRoles: string[] = []
): Promise<{
  success: boolean;
  user: AuthenticatedUser | null;
  response?: NextResponse;
}> {
  const result = await nextRoleMiddleware(request, requiredRoles);
  
  return {
    success: result.success,
    user: result.user,
    response: result.response
  };
}

/**
 * Admin-only middleware
 */
export function adminMiddleware(request: NextRequest) {
  return roleMiddleware(request, ['admin']);
}

/**
 * Middleware for API routes that need to handle both authenticated and anonymous users
 */
export async function optionalAuth(request: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
}> {
  return nextOptionalAuth(request);
}

/**
 * Health check utility (no auth required)
 */
export function createHealthCheckResponse() {
  const { createNextHealthResponse } = require('@/lib/shared/auth');
  return createNextHealthResponse();
}

// ===== HIGHER-ORDER FUNCTIONS =====

/**
 * Higher-order function to create authenticated API handlers
 * 
 * Usage:
 * import { withAuth } from '@/lib/middleware/authMiddleware-unified';
 * 
 * export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
 *   // Your protected API logic here
 *   return NextResponse.json({ message: `Hello ${user.email}` });
 * });
 */
export { withNextAuth as withAuth };

/**
 * Admin-only handler wrapper
 */
export { withNextAdminAuth as withAdminAuth };

/**
 * Role-based handler wrapper
 */
export { withNextRoleAuth as withRoleAuth };

// ===== UTILITY FUNCTIONS =====

/**
 * Utility function to get user from session cookie (for server components)
 * 
 * Replaces getUserFromSessionCookie from the old implementation
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
 * Extract user from request context (trying both auth header and session cookie)
 */
export async function getUserFromRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  return extractUserFromRequest(request);
}

// ===== MIGRATION COMPATIBILITY =====

/**
 * Legacy interface compatibility
 * Maintains the exact same interface as the old authMiddleware for easy migration
 */
export interface AuthRequest extends NextRequest {
  user?: AuthenticatedUser;
}

// Re-export types for backward compatibility
export type { AuthenticatedUser, AuthResult };

// ===== PERFORMANCE MONITORING =====

/**
 * Get authentication performance metrics
 */
export function getAuthPerformanceMetrics(): Record<string, any> {
  const { getAuthMetrics } = require('@/lib/shared/auth');
  return getAuthMetrics();
}

/**
 * Reset authentication performance metrics
 */
export function resetAuthPerformanceMetrics(): void {
  const { resetAuthMetrics } = require('@/lib/shared/auth');
  resetAuthMetrics();
}

/**
 * Run authentication performance benchmark
 */
export async function runAuthBenchmark(
  request: NextRequest,
  iterations: number = 100
): Promise<Record<string, any>> {
  const { benchmarkNextAuth } = await import('@/lib/shared/auth');
  return benchmarkNextAuth(request, iterations);
}
