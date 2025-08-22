/**
 * Next.js Authentication Middleware Adapter
 * 
 * Provides Next.js-specific authentication middleware using the unified auth library
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getUnifiedAuth, 
  verifyAuthHeader, 
  UnifiedAuthError,
  AuthPerformanceMonitor 
} from '../core';
import { 
  AuthenticatedUser, 
  AuthMiddlewareOptions, 
  AuthMiddlewareResult,
  AuthErrorCode 
} from '../types';

// ===== NEXT.JS MIDDLEWARE FUNCTIONS =====

/**
 * Core authentication middleware for Next.js API routes
 */
export async function nextAuthMiddleware(
  request: NextRequest, 
  options: AuthMiddlewareOptions = {}
): Promise<AuthMiddlewareResult<NextResponse>> {
  const monitor = AuthPerformanceMonitor.getInstance();
  const endTiming = monitor.startTiming('next-auth-middleware');

  try {
    const authHeader = request.headers.get('authorization');
    const authResult = await verifyAuthHeader(authHeader);

    if (!authResult.success || !authResult.user) {
      const error = new UnifiedAuthError(
        authResult.errorCode || AuthErrorCode.INVALID_TOKEN,
        authResult.error || 'Authentication failed'
      );

      return {
        success: false,
        user: null,
        response: createErrorResponse(error),
        error: error.message,
        errorCode: error.code
      };
    }

    // Check roles if required
    if (options.requiredRoles?.length) {
      const auth = getUnifiedAuth();
      if (!auth.hasRequiredRoles(authResult.user, options.requiredRoles)) {
        const error = UnifiedAuthError.insufficientPermissions(options.requiredRoles);
        return {
          success: false,
          user: null,
          response: createErrorResponse(error),
          error: error.message,
          errorCode: error.code
        };
      }
    }

    // Custom validation
    if (options.customValidator) {
      const isValid = await options.customValidator(authResult.user);
      if (!isValid) {
        const error = new UnifiedAuthError(
          AuthErrorCode.INSUFFICIENT_PERMISSIONS,
          'Custom validation failed'
        );
        return {
          success: false,
          user: null,
          response: createErrorResponse(error),
          error: error.message,
          errorCode: error.code
        };
      }
    }

    endTiming();
    return {
      success: true,
      user: authResult.user
    };

  } catch (error) {
    endTiming();
    console.error('Next.js auth middleware error:', error);
    
    const authError = error instanceof UnifiedAuthError ? error : 
      new UnifiedAuthError(AuthErrorCode.UNKNOWN_ERROR, 'Authentication system error');

    return {
      success: false,
      user: null,
      response: createErrorResponse(authError),
      error: authError.message,
      errorCode: authError.code
    };
  }
}

/**
 * Optional authentication middleware (allows anonymous users)
 */
export async function nextOptionalAuth(request: NextRequest): Promise<{
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
}> {
  try {
    const authHeader = request.headers.get('authorization');
    const authResult = await verifyAuthHeader(authHeader);

    return {
      user: authResult.user,
      isAuthenticated: authResult.success
    };
  } catch (error) {
    return {
      user: null,
      isAuthenticated: false
    };
  }
}

/**
 * Role-based authentication middleware
 */
export async function nextRoleMiddleware(
  request: NextRequest,
  requiredRoles: string[]
): Promise<AuthMiddlewareResult<NextResponse>> {
  return nextAuthMiddleware(request, { requiredRoles });
}

/**
 * Admin-only middleware
 */
export async function nextAdminMiddleware(
  request: NextRequest
): Promise<AuthMiddlewareResult<NextResponse>> {
  return nextAuthMiddleware(request, { requiredRoles: ['admin'] });
}

// ===== HIGHER-ORDER FUNCTIONS =====

/**
 * Higher-order function to create authenticated API handlers
 */
export function withNextAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    if (options.skipAuth) {
      return await handler(request, null as any, ...args);
    }

    const authResult = await nextAuthMiddleware(request, options);

    if (!authResult.success || !authResult.user) {
      return authResult.response!;
    }

    // Call the actual handler with the authenticated user
    return await handler(request, authResult.user, ...args);
  };
}

/**
 * Admin-only handler wrapper
 */
export function withNextAdminAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>
) {
  return withNextAuth(handler, { requiredRoles: ['admin'] });
}

/**
 * Role-based handler wrapper
 */
export function withNextRoleAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>,
  requiredRoles: string[]
) {
  return withNextAuth(handler, { requiredRoles });
}

// ===== UTILITY FUNCTIONS =====

/**
 * Create standardized error response for Next.js
 */
function createErrorResponse(error: UnifiedAuthError): NextResponse {
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
      details: error.details
    },
    { 
      status: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Create health check response
 */
export function createNextHealthResponse(): NextResponse {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Next.js Unified Auth Middleware'
    },
    { status: 200 }
  );
}

/**
 * Get user from session cookie (for server components)
 */
export async function getUserFromSessionCookie(sessionCookie: string): Promise<AuthenticatedUser | null> {
  try {
    const auth = getUnifiedAuth();
    const result = await auth.verifySessionCookie(sessionCookie);
    
    return result.valid ? result.user || null : null;
  } catch (error) {
    console.error('Session cookie verification failed:', error);
    return null;
  }
}

/**
 * Extract user from Next.js request context
 */
export async function extractUserFromRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // Try Authorization header first
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const authResult = await verifyAuthHeader(authHeader);
      if (authResult.success && authResult.user) {
        return authResult.user;
      }
    }

    // Try session cookie as fallback
    const sessionCookie = request.cookies.get('session')?.value;
    if (sessionCookie) {
      return await getUserFromSessionCookie(sessionCookie);
    }

    return null;
  } catch (error) {
    console.error('Failed to extract user from request:', error);
    return null;
  }
}

// ===== PERFORMANCE HELPERS =====

/**
 * Benchmark authentication performance
 */
export async function benchmarkNextAuth(
  request: NextRequest,
  iterations: number = 100
): Promise<Record<string, any>> {
  const monitor = AuthPerformanceMonitor.getInstance();
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const endTiming = monitor.startTiming('benchmark');
    await nextAuthMiddleware(request);
    const duration = endTiming();
    results.push(duration);
  }

  const sorted = results.sort((a, b) => a - b);
  const sum = results.reduce((a, b) => a + b, 0);

  return {
    iterations,
    average: sum / iterations,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
}
