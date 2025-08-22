/**
 * Integration Tests for Next.js Unified Auth Middleware
 * 
 * Validates the Next.js adapter in a simulated environment
 */

import { NextRequest } from 'next/server';
import { 
  nextAuthMiddleware,
  withNextAuth,
  withNextAdminAuth
} from '../adapters/next-auth';
import { getUnifiedAuth } from '../core';

// Mock dependencies
jest.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: jest.fn(() => ({
    verifyIdToken: jest.fn()
  }))
}));

describe('Next.js Auth Middleware Integration', () => {
  let mockFirebaseAuth: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const auth = getUnifiedAuth();
    await auth.initialize();
    
    const { getAdminAuth } = require('@/lib/firebase/admin');
    mockFirebaseAuth = getAdminAuth();
  });

  describe('nextAuthMiddleware', () => {
    it('should succeed with valid token', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'test-user' });
      
      const request = new NextRequest('https://test.com/api/protected', {
        headers: { Authorization: 'Bearer valid-token' }
      });

      const result = await nextAuthMiddleware(request);

      expect(result.success).toBe(true);
      expect(result.user?.uid).toBe('test-user');
      expect(result.response).toBeUndefined();
    });

    it('should fail with missing token and return 401 response', async () => {
      const request = new NextRequest('https://test.com/api/protected');
      const result = await nextAuthMiddleware(request);

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(401);
    });

    it('should fail with invalid token and return 401 response', async () => {
      mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Invalid'));
      
      const request = new NextRequest('https://test.com/api/protected', {
        headers: { Authorization: 'Bearer invalid-token' }
      });

      const result = await nextAuthMiddleware(request);

      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(401);
    });

    it('should handle role-based access control', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'admin-user',
        custom_claims: { roles: ['admin'] }
      });

      const request = new NextRequest('https://test.com/api/admin', {
        headers: { Authorization: 'Bearer admin-token' }
      });

      // Should succeed with correct role
      const successResult = await nextAuthMiddleware(request, { requiredRoles: ['admin'] });
      expect(successResult.success).toBe(true);

      // Should fail with missing role
      const failureResult = await nextAuthMiddleware(request, { requiredRoles: ['superuser'] });
      expect(failureResult.success).toBe(false);
      expect(failureResult.response?.status).toBe(403);
    });
  });

  describe('withNextAuth HOF', () => {
    it('should call handler with authenticated user', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'test-user' });
      
      const handler = jest.fn((req, user) => {
        expect(user.uid).toBe('test-user');
        return new Response('Success');
      });

      const request = new NextRequest('https://test.com/api/protected', {
        headers: { Authorization: 'Bearer valid-token' }
      });

      const protectedHandler = withNextAuth(handler);
      await protectedHandler(request);

      expect(handler).toHaveBeenCalled();
    });

    it('should not call handler on authentication failure', async () => {
      mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Invalid'));
      
      const handler = jest.fn();

      const request = new NextRequest('https://test.com/api/protected', {
        headers: { Authorization: 'Bearer invalid-token' }
      });

      const protectedHandler = withNextAuth(handler);
      const response = await protectedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('should skip authentication when specified', async () => {
      const handler = jest.fn();
      const request = new NextRequest('https://test.com/api/public');

      const publicHandler = withNextAuth(handler, { skipAuth: true });
      await publicHandler(request);

      expect(handler).toHaveBeenCalledWith(request, null, expect.anything());
    });
  });

  describe('withNextAdminAuth HOF', () => {
    it('should grant access to admin users', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'admin-user',
        custom_claims: { roles: ['admin'] }
      });

      const handler = jest.fn();
      const request = new NextRequest('https://test.com/api/admin', {
        headers: { Authorization: 'Bearer admin-token' }
      });

      const adminHandler = withNextAdminAuth(handler);
      await adminHandler(request);

      expect(handler).toHaveBeenCalled();
    });

    it('should deny access to non-admin users', async () => {
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({ uid: 'non-admin' });

      const handler = jest.fn();
      const request = new NextRequest('https://test.com/api/admin', {
        headers: { Authorization: 'Bearer user-token' }
      });

      const adminHandler = withNextAdminAuth(handler);
      const response = await adminHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });
  });
});
