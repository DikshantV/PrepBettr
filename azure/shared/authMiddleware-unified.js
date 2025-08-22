/**
 * Unified Azure Functions Authentication Middleware
 * 
 * Replacement for azure/shared/authMiddleware.js using the unified auth library
 * Eliminates code duplication and provides consistent authentication across platforms
 */

const { 
  azureAuthMiddleware,
  azureRoleMiddleware,
  azureAdminMiddleware,
  createAuthenticatedAzureFunction,
  createAdminAzureFunction,
  createRoleBasedAzureFunction,
  createAzureHealthResponse,
  extractUserFromAzureRequest,
  initializeUnifiedAuth,
  getAuthMetrics,
  resetAuthMetrics,
  benchmarkAzureAuth
} = require('../../lib/shared/auth');

/**
 * Firebase Authentication Middleware for Azure Functions
 * 
 * This middleware validates Firebase ID tokens and ensures only authenticated users
 * can access protected endpoints in Azure Functions.
 * 
 * Replaces the old authMiddleware with unified implementation
 */
async function authMiddleware(context, req, options = {}) {
  const result = await azureAuthMiddleware(context, req, options);
  
  // Return in the expected format
  return {
    success: result.success,
    user: result.user,
    response: result.response
  };
}

/**
 * Role-based authorization middleware
 */
async function roleMiddleware(context, req, requiredRoles = []) {
  const result = await azureRoleMiddleware(context, req, requiredRoles);
  
  return {
    success: result.success,
    user: result.user,
    response: result.response
  };
}

/**
 * Admin-only middleware
 */
async function adminMiddleware(context, req) {
  return roleMiddleware(context, req, ['admin']);
}

/**
 * Initialize Firebase Admin SDK
 * 
 * Unified initialization using the auth library
 */
async function initializeFirebase() {
  try {
    const auth = await initializeUnifiedAuth();
    return auth;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    throw error;
  }
}

/**
 * Verify Firebase ID token (unified implementation)
 */
async function verifyFirebaseToken(idToken) {
  try {
    const { verifyToken } = require('../../lib/shared/auth');
    const result = await verifyToken(idToken);
    
    return {
      success: result.valid,
      user: result.user,
      error: result.error
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return {
      success: false,
      user: null,
      error: error.message || 'Token verification failed'
    };
  }
}

/**
 * Create authenticated Azure Function wrapper
 * 
 * Usage:
 * const { createAuthenticatedFunction } = require('../shared/authMiddleware-unified');
 * 
 * module.exports = createAuthenticatedFunction(async function (context, req, user) {
 *   // Your protected function logic here
 *   // 'user' contains the authenticated Firebase user
 * });
 */
function createAuthenticatedFunction(handlerFunction, options = {}) {
  return createAuthenticatedAzureFunction(handlerFunction, options);
}

/**
 * Create admin-only Azure Function wrapper
 */
function createAdminFunction(handlerFunction) {
  return createAdminAzureFunction(handlerFunction);
}

/**
 * Create role-based Azure Function wrapper
 */
function createRoleBasedFunction(handlerFunction, requiredRoles) {
  return createRoleBasedAzureFunction(handlerFunction, requiredRoles);
}

/**
 * Health check endpoint (no auth required)
 */
function createHealthCheckResponse() {
  return createAzureHealthResponse();
}

/**
 * Extract user from Azure request
 */
async function getUserFromRequest(context, req) {
  return extractUserFromAzureRequest(context, req);
}

// ===== PERFORMANCE MONITORING =====

/**
 * Get authentication performance metrics
 */
function getAuthPerformanceMetrics() {
  return getAuthMetrics();
}

/**
 * Reset authentication performance metrics
 */
function resetAuthPerformanceMetrics() {
  resetAuthMetrics();
}

/**
 * Run authentication performance benchmark
 */
async function runAuthBenchmark(context, req, iterations = 100) {
  return benchmarkAzureAuth(context, req, iterations);
}

// ===== LEGACY COMPATIBILITY =====

/**
 * Legacy function signatures for backward compatibility
 */

// Extract Bearer token from Authorization header (legacy)
function extractBearerToken(authHeader) {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

// ===== MODULE EXPORTS =====

module.exports = {
  // Main middleware functions
  authMiddleware,
  roleMiddleware,
  adminMiddleware,
  
  // Higher-order functions
  createAuthenticatedFunction,
  createAdminFunction,
  createRoleBasedFunction,
  
  // Utility functions
  initializeFirebase,
  verifyFirebaseToken,
  createHealthCheckResponse,
  getUserFromRequest,
  extractBearerToken, // Legacy compatibility
  
  // Performance monitoring
  getAuthPerformanceMetrics,
  resetAuthPerformanceMetrics,
  runAuthBenchmark,
  
  // Legacy aliases for backward compatibility
  createAuthenticatedAzureFunction: createAuthenticatedFunction,
  createAdminAzureFunction: createAdminFunction,
  createRoleBasedAzureFunction: createRoleBasedFunction
};
