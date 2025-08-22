/**
 * Integration Tests for Azure Functions Unified Auth Middleware
 * 
 * Validates the Azure Functions adapter in a simulated environment
 */

import { 
  azureAuthMiddleware,
  createAuthenticatedAzureFunction,
  createAdminAzureFunction
} from '../adapters/azure-auth';
import { getUnifiedAuth } from '../core';
import { AzureContext, AzureRequest } from '../types';

// Mock dependencies
jest.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: jest.fn(() => ({
    verifyIdToken: jest.fn()
  }))
}));

describe('Azure Functions Auth Middleware Integration', () => {
  let mockFirebaseAuth: any;
  let mockContext: AzureContext;
  let mockRequest: AzureRequest;

  beforeEach(async () => {
    jest.clearAllMocks();
    const auth = getUnifiedAuth();
    await auth.initialize();
    
    const { getAdminAuth } = require('@/lib/firebase/admin');
    mockFirebaseAuth = getAdminAuth();

    // Setup mock Azure context and request
    mockContext = {
      log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      },
      res: undefined
    };

    mockRequest = {
      headers: {},
      body: {},
      query: {}
    };
  });

  describe('azureAuthMiddleware', () => {
    it('should succeed with valid token', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'test-user',
        email: 'test@example.com'
      });

      mockRequest.headers.authorization = 'Bearer valid-token';

      const result = await azureAuthMiddleware(mockContext, mockRequest);

      expect(result.success).toBe(true);
      expect(result.user?.uid).toBe('test-user');
      expect(result.response).toBeUndefined();
      expect(mockContext.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Authenticated user: test-user')
      );
    });

    it('should fail with missing token and return 401 response', async () => {
      const result = await azureAuthMiddleware(mockContext, mockRequest);

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(401);
      expect(JSON.parse(result.response?.body || '{}')).toMatchObject({
        error: 'Missing or invalid Authorization header'
      });
    });

    it('should fail with invalid token and return 401 response', async () => {
      mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));
      mockRequest.headers.authorization = 'Bearer invalid-token';

      const result = await azureAuthMiddleware(mockContext, mockRequest);

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(401);
    });

    it('should handle case-insensitive authorization header', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'test-user' });
      mockRequest.headers.Authorization = 'Bearer valid-token'; // Capital A

      const result = await azureAuthMiddleware(mockContext, mockRequest);

      expect(result.success).toBe(true);
    });

    it('should handle role-based access control', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'admin-user',
        custom_claims: { roles: ['admin'] }
      });

      mockRequest.headers.authorization = 'Bearer admin-token';

      // Should succeed with correct role
      const successResult = await azureAuthMiddleware(mockContext, mockRequest, {
        requiredRoles: ['admin']
      });
      expect(successResult.success).toBe(true);

      // Should fail with missing role
      const failureResult = await azureAuthMiddleware(mockContext, mockRequest, {
        requiredRoles: ['superuser']
      });
      expect(failureResult.success).toBe(false);
      expect(failureResult.response?.status).toBe(403);
    });

    it('should handle custom validation', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'test-user',
        email: 'test@blocked-domain.com'
      });

      mockRequest.headers.authorization = 'Bearer valid-token';

      const customValidator = jest.fn(async (user) => {
        return !user.email?.includes('blocked-domain');
      });

      const result = await azureAuthMiddleware(mockContext, mockRequest, {
        customValidator
      });

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(403);
      expect(customValidator).toHaveBeenCalled();
    });
  });

  describe('createAuthenticatedAzureFunction', () => {
    it('should call handler with authenticated user', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'test-user',
        email: 'test@example.com'
      });

      const handler = jest.fn(async (context, req, user) => {
        expect(user.uid).toBe('test-user');
        context.res = { status: 200, body: 'Success' };
      });

      mockRequest.headers.authorization = 'Bearer valid-token';

      const authenticatedFunction = createAuthenticatedAzureFunction(handler);
      await authenticatedFunction(mockContext, mockRequest);

      expect(handler).toHaveBeenCalled();
      expect(mockContext.res?.status).toBe(200);
    });

    it('should not call handler on authentication failure', async () => {
      mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const handler = jest.fn();
      mockRequest.headers.authorization = 'Bearer invalid-token';

      const authenticatedFunction = createAuthenticatedAzureFunction(handler);
      await authenticatedFunction(mockContext, mockRequest);

      expect(handler).not.toHaveBeenCalled();
      expect(mockContext.res?.status).toBe(401);
    });

    it('should skip authentication when specified', async () => {
      const handler = jest.fn(async (context, req, user) => {
        expect(user).toBeNull();
        context.res = { status: 200, body: 'Public endpoint' };
      });

      const publicFunction = createAuthenticatedAzureFunction(handler, { skipAuth: true });
      await publicFunction(mockContext, mockRequest);

      expect(handler).toHaveBeenCalled();
      expect(mockContext.res?.status).toBe(200);
    });
  });

  describe('createAdminAzureFunction', () => {
    it('should grant access to admin users', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'admin-user',
        custom_claims: { roles: ['admin'] }
      });

      const handler = jest.fn(async (context, req, user) => {
        context.res = { status: 200, body: 'Admin access granted' };
      });

      mockRequest.headers.authorization = 'Bearer admin-token';

      const adminFunction = createAdminAzureFunction(handler);
      await adminFunction(mockContext, mockRequest);

      expect(handler).toHaveBeenCalled();
      expect(mockContext.res?.status).toBe(200);
    });

    it('should deny access to non-admin users', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'regular-user',
        custom_claims: { roles: ['user'] }
      });

      const handler = jest.fn();
      mockRequest.headers.authorization = 'Bearer user-token';

      const adminFunction = createAdminAzureFunction(handler);
      await adminFunction(mockContext, mockRequest);

      expect(handler).not.toHaveBeenCalled();
      expect(mockContext.res?.status).toBe(403);
    });
  });

  describe('Error handling', () => {
    it('should handle Firebase service unavailable', async () => {
      mockFirebaseAuth.verifyIdToken.mockRejectedValue({
        code: 'auth/service-unavailable'
      });

      mockRequest.headers.authorization = 'Bearer token';

      const result = await azureAuthMiddleware(mockContext, mockRequest);

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(401);
      expect(mockContext.log.error).toHaveBeenCalled();
    });

    it('should handle unexpected errors gracefully', async () => {
      mockFirebaseAuth.verifyIdToken.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      mockRequest.headers.authorization = 'Bearer token';

      const result = await azureAuthMiddleware(mockContext, mockRequest);

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(500);
      expect(mockContext.log.error).toHaveBeenCalled();
    });
  });
});
