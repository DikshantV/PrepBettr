/**
 * Azure Functions Authentication Middleware Adapter
 * 
 * Provides Azure Functions-specific authentication middleware using the unified auth library
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
  AuthMiddlewareResult,
  AuthErrorCode,
  AzureContext,
  AzureRequest 
} from '../types';

// ===== AZURE FUNCTIONS MIDDLEWARE =====

/**
 * Core authentication middleware for Azure Functions
 */
export async function azureAuthMiddleware(
  context: AzureContext,
  req: AzureRequest,
  options: AuthMiddlewareOptions = {}
): Promise<AuthMiddlewareResult<any>> {
  const monitor = AuthPerformanceMonitor.getInstance();
  const endTiming = monitor.startTiming('azure-auth-middleware');

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const authResult = await verifyAuthHeader(authHeader);

    if (!authResult.success || !authResult.user) {
      const error = new UnifiedAuthError(
        authResult.errorCode || AuthErrorCode.INVALID_TOKEN,
        authResult.error || 'Authentication failed'
      );

      return {
        success: false,
        user: null,
        response: createAzureErrorResponse(error),
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
          response: createAzureErrorResponse(error),
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
          response: createAzureErrorResponse(error),
          error: error.message,
          errorCode: error.code
        };
      }
    }

    // Log successful authentication
    context.log.info(`Authenticated user: ${authResult.user.uid} (${authResult.user.email})`);

    endTiming();
    return {
      success: true,
      user: authResult.user
    };

  } catch (error) {
    endTiming();
    context.log.error(`Azure Functions auth middleware error: ${error}`);
    
    const authError = error instanceof UnifiedAuthError ? error : 
      new UnifiedAuthError(AuthErrorCode.UNKNOWN_ERROR, 'Authentication system error');

    return {
      success: false,
      user: null,
      response: createAzureErrorResponse(authError),
      error: authError.message,
      errorCode: authError.code
    };
  }
}

/**
 * Role-based authentication middleware for Azure Functions
 */
export async function azureRoleMiddleware(
  context: AzureContext,
  req: AzureRequest,
  requiredRoles: string[]
): Promise<AuthMiddlewareResult<any>> {
  return azureAuthMiddleware(context, req, { requiredRoles });
}

/**
 * Admin-only middleware for Azure Functions
 */
export async function azureAdminMiddleware(
  context: AzureContext,
  req: AzureRequest
): Promise<AuthMiddlewareResult<any>> {
  return azureAuthMiddleware(context, req, { requiredRoles: ['admin'] });
}

// ===== HIGHER-ORDER FUNCTIONS =====

/**
 * Create authenticated Azure Function wrapper
 */
export function createAuthenticatedAzureFunction(
  handlerFunction: (context: AzureContext, req: AzureRequest, user: AuthenticatedUser) => Promise<void>,
  options: AuthMiddlewareOptions = {}
) {
  return async function (context: AzureContext, req: AzureRequest): Promise<void> {
    if (options.skipAuth) {
      return await handlerFunction(context, req, null as any);
    }

    const authResult = await azureAuthMiddleware(context, req, options);

    if (!authResult.success || !authResult.user) {
      context.res = authResult.response;
      return;
    }

    // Call the actual handler with the authenticated user
    return await handlerFunction(context, req, authResult.user);
  };
}

/**
 * Create admin-only Azure Function wrapper
 */
export function createAdminAzureFunction(
  handlerFunction: (context: AzureContext, req: AzureRequest, user: AuthenticatedUser) => Promise<void>
) {
  return createAuthenticatedAzureFunction(handlerFunction, { requiredRoles: ['admin'] });
}

/**
 * Create role-based Azure Function wrapper
 */
export function createRoleBasedAzureFunction(
  handlerFunction: (context: AzureContext, req: AzureRequest, user: AuthenticatedUser) => Promise<void>,
  requiredRoles: string[]
) {
  return createAuthenticatedAzureFunction(handlerFunction, { requiredRoles });
}

// ===== UTILITY FUNCTIONS =====

/**
 * Create standardized error response for Azure Functions
 */
function createAzureErrorResponse(error: UnifiedAuthError): any {
  return {
    status: error.statusCode || 500,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      error: error.message,
      code: error.code,
      details: error.details
    })
  };
}

/**
 * Create health check response for Azure Functions
 */
export function createAzureHealthResponse(): any {
  return {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Azure Functions Unified Auth Middleware'
    })
  };
}

/**
 * Extract user from Azure Functions request
 */
export async function extractUserFromAzureRequest(
  context: AzureContext,
  req: AzureRequest
): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const authResult = await verifyAuthHeader(authHeader);
    
    return authResult.success ? authResult.user : null;
  } catch (error) {
    context.log.error(`Failed to extract user from Azure request: ${error}`);
    return null;
  }
}

// ===== LEGACY COMPATIBILITY =====

/**
 * Legacy Azure Functions middleware format (for backward compatibility)
 */
export async function legacyAzureAuthMiddleware(context: AzureContext, req: AzureRequest) {
  const authResult = await azureAuthMiddleware(context, req);
  
  // Return in the old format for backward compatibility
  return {
    success: authResult.success,
    user: authResult.user,
    response: authResult.response
  };
}

/**
 * Initialize Firebase for Azure Functions (backward compatibility)
 */
export async function initializeFirebaseForAzure(): Promise<any> {
  const auth = getUnifiedAuth();
  await auth.initialize();
  return auth;
}

// ===== PERFORMANCE HELPERS =====

/**
 * Benchmark Azure Functions authentication performance
 */
export async function benchmarkAzureAuth(
  context: AzureContext,
  req: AzureRequest,
  iterations: number = 100
): Promise<Record<string, any>> {
  const monitor = AuthPerformanceMonitor.getInstance();
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const endTiming = monitor.startTiming('benchmark');
    await azureAuthMiddleware(context, req);
    const duration = endTiming();
    results.push(duration);
  }

  const sorted = results.sort((a, b) => a - b);
  const sum = results.reduce((a, b) => a + b, 0);

  const stats = {
    iterations,
    average: sum / iterations,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };

  context.log.info(`Azure auth performance benchmark: ${JSON.stringify(stats)}`);
  return stats;
}
