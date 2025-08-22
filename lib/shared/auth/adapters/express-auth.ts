/**
 * Express.js Authentication Middleware Adapter
 * 
 * Provides Express.js-specific authentication middleware using the unified auth library
 */

import { 
  getUnifiedAuth, 
  verifyAuthHeader, 
  UnifiedAuthError,
  AuthPerformanceMonitor 
} from '../core';
import { 
  AuthenticatedUser, 
  AuthMiddlewareOptions, 
  AuthErrorCode,
  ExpressRequest,
  ExpressResponse,
  ExpressNext 
} from '../types';

// ===== EXPRESS.JS MIDDLEWARE =====

/**
 * Core authentication middleware for Express.js
 */
export function expressAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext): Promise<void> => {
    const monitor = AuthPerformanceMonitor.getInstance();
    const endTiming = monitor.startTiming('express-auth-middleware');

    try {
      if (options.skipAuth) {
        req.user = null as any;
        next();
        return;
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      const authResult = await verifyAuthHeader(authHeader);

      if (!authResult.success || !authResult.user) {
        const error = new UnifiedAuthError(
          authResult.errorCode || AuthErrorCode.INVALID_TOKEN,
          authResult.error || 'Authentication failed'
        );

        endTiming();
        res.status(error.statusCode || 401).json({
          error: error.message,
          code: error.code,
          details: error.details
        });
        return;
      }

      // Check roles if required
      if (options.requiredRoles?.length) {
        const auth = getUnifiedAuth();
        if (!auth.hasRequiredRoles(authResult.user, options.requiredRoles)) {
          const error = UnifiedAuthError.insufficientPermissions(options.requiredRoles);
          endTiming();
          res.status(error.statusCode || 403).json({
            error: error.message,
            code: error.code,
            details: error.details
          });
          return;
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
          endTiming();
          res.status(error.statusCode || 403).json({
            error: error.message,
            code: error.code,
            details: error.details
          });
          return;
        }
      }

      // Attach user to request
      req.user = authResult.user;
      
      endTiming();
      next();

    } catch (error) {
      endTiming();
      console.error('Express auth middleware error:', error);
      
      const authError = error instanceof UnifiedAuthError ? error : 
        new UnifiedAuthError(AuthErrorCode.UNKNOWN_ERROR, 'Authentication system error');

      res.status(authError.statusCode || 500).json({
        error: authError.message,
        code: authError.code,
        details: authError.details
      });
    }
  };
}

/**
 * Optional authentication middleware (allows anonymous users)
 */
export function expressOptionalAuth() {
  return async (req: ExpressRequest, res: ExpressResponse, next: ExpressNext): Promise<void> => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const authResult = await verifyAuthHeader(authHeader);

      req.user = authResult.success ? (authResult.user || undefined) : undefined;
      next();
    } catch (error) {
      req.user = undefined;
      next();
    }
  };
}

/**
 * Role-based authentication middleware
 */
export function expressRoleMiddleware(requiredRoles: string[]) {
  return expressAuthMiddleware({ requiredRoles });
}

/**
 * Admin-only middleware
 */
export function expressAdminMiddleware() {
  return expressAuthMiddleware({ requiredRoles: ['admin'] });
}

// ===== UTILITY FUNCTIONS =====

/**
 * Extract user from Express request
 */
export async function extractUserFromExpressRequest(req: ExpressRequest): Promise<AuthenticatedUser | null> {
  try {
    // Check if user is already attached (from middleware)
    if (req.user) {
      return req.user;
    }

    // Try to extract from authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const authResult = await verifyAuthHeader(authHeader);
    
    return authResult.success ? authResult.user : null;
  } catch (error) {
    console.error('Failed to extract user from Express request:', error);
    return null;
  }
}

/**
 * Check if Express request is authenticated
 */
export function isExpressRequestAuthenticated(req: ExpressRequest): boolean {
  return !!req.user;
}

/**
 * Get user roles from Express request
 */
export function getUserRoles(req: ExpressRequest): string[] {
  return req.user?.custom_claims?.roles || [];
}

/**
 * Check if Express request user has role
 */
export function hasRole(req: ExpressRequest, role: string): boolean {
  const roles = getUserRoles(req);
  return roles.includes(role);
}

/**
 * Check if Express request user has any of the required roles
 */
export function hasAnyRole(req: ExpressRequest, requiredRoles: string[]): boolean {
  const userRoles = getUserRoles(req);
  return requiredRoles.some(role => userRoles.includes(role));
}

// ===== ERROR HANDLERS =====

/**
 * Express error handler for authentication errors
 */
export function expressAuthErrorHandler() {
  return (error: any, req: ExpressRequest, res: ExpressResponse, next: ExpressNext): void => {
    if (error instanceof UnifiedAuthError) {
      res.status(error.statusCode || 500).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
      return;
    }

    // Pass non-auth errors to next handler
    next(error);
  };
}

// ===== PERFORMANCE HELPERS =====

/**
 * Benchmark Express authentication performance
 */
export async function benchmarkExpressAuth(
  req: ExpressRequest,
  iterations: number = 100
): Promise<Record<string, any>> {
  const monitor = AuthPerformanceMonitor.getInstance();
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const endTiming = monitor.startTiming('benchmark');
    
    // Simulate middleware execution
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes
    } as ExpressResponse;
    
    const mockNext = () => {};
    
    await new Promise<void>((resolve) => {
      expressAuthMiddleware()(req, mockRes, () => {
        const duration = endTiming();
        results.push(duration);
        resolve();
      });
    });
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

// ===== ROUTE PROTECTION HELPERS =====

/**
 * Protect all routes in an Express router with authentication
 */
export function protectExpressRouter(options: AuthMiddlewareOptions = {}) {
  return expressAuthMiddleware(options);
}

/**
 * Protect specific Express routes with role-based access
 */
export function protectExpressRouteWithRoles(requiredRoles: string[]) {
  return expressRoleMiddleware(requiredRoles);
}

/**
 * Protect Express routes for admin-only access
 */
export function protectExpressAdminRoutes() {
  return expressAdminMiddleware();
}
