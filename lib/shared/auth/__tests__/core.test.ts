/**
 * Unit Tests for Unified Authentication Core Library
 * 
 * Tests all core authentication functionality including:
 * - Token verification
 * - Error handling
 * - Performance monitoring
 * - Health checks
 */

import { 
  UnifiedAuth, 
  UnifiedAuthError, 
  TokenUtils, 
  AuthPerformanceMonitor,
  getUnifiedAuth,
  verifyToken,
  verifyAuthHeader,
  createAuthError
} from '../core';
import { AuthErrorCode } from '../types';

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    verifySessionCookie: jest.fn(),
    getUser: jest.fn()
  }))
}));

describe('UnifiedAuth Core Library', () => {
  let auth: UnifiedAuth;
  let mockFirebaseAuth: any;

  beforeEach(() => {
    jest.clearAllMocks();
    auth = new UnifiedAuth();
    
    // Setup mock Firebase auth
    const { getAdminAuth } = require('@/lib/firebase/admin');
    mockFirebaseAuth = getAdminAuth();
  });

  afterEach(() => {
    auth.resetMetrics();
  });

  describe('UnifiedAuth Class', () => {
    describe('initialization', () => {
      it('should initialize successfully with default config', async () => {
        await auth.initialize();
        expect(auth['initialized']).toBe(true);
      });

      it('should handle initialization errors', async () => {
        const { getAdminAuth } = require('@/lib/firebase/admin');
        getAdminAuth.mockImplementation(() => {
          throw new Error('Firebase init failed');
        });

        await expect(auth.initialize()).rejects.toThrow('Firebase init failed');
      });

      it('should not re-initialize if already initialized', async () => {
        await auth.initialize();
        const initSpy = jest.spyOn(auth, 'initialize');
        await auth.initialize();
        expect(initSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('token extraction', () => {
      it('should extract Bearer token correctly', () => {
        const token = auth.extractBearerToken('Bearer abc123');
        expect(token).toBe('abc123');
      });

      it('should return null for invalid auth header', () => {
        expect(auth.extractBearerToken('')).toBe(null);
        expect(auth.extractBearerToken('Basic abc123')).toBe(null);
        expect(auth.extractBearerToken('Bearer')).toBe(null);
        expect(auth.extractBearerToken(null)).toBe(null);
        expect(auth.extractBearerToken(undefined)).toBe(null);
      });

      it('should handle malformed Bearer headers', () => {
        expect(auth.extractBearerToken('Bearer  ')).toBe('');
        expect(auth.extractBearerToken('Bearer token1 token2')).toBe('token1');
      });
    });

    describe('token verification', () => {
      it('should verify valid Firebase token', async () => {
        const mockToken = {
          uid: 'test-user-id',
          email: 'test@example.com',
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 3600,
          firebase: { sign_in_provider: 'password' }
        };

        mockFirebaseAuth.verifyIdToken.mockResolvedValue(mockToken);
        await auth.initialize();

        const result = await auth.verifyToken('valid-token');

        expect(result.valid).toBe(true);
        expect(result.user?.uid).toBe('test-user-id');
        expect(result.user?.email).toBe('test@example.com');
        expect(result.user?.provider).toBe('firebase');
      });

      it('should handle expired tokens', async () => {
        mockFirebaseAuth.verifyIdToken.mockRejectedValue({ 
          code: 'auth/id-token-expired' 
        });
        await auth.initialize();

        const result = await auth.verifyToken('expired-token');

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(AuthErrorCode.EXPIRED_TOKEN);
      });

      it('should handle invalid tokens', async () => {
        mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));
        await auth.initialize();

        const result = await auth.verifyToken('invalid-token');

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(AuthErrorCode.FIREBASE_ERROR);
      });

      it('should update metrics on token verification', async () => {
        mockFirebaseAuth.verifyIdToken.mockResolvedValue({
          uid: 'test-user',
          email: 'test@example.com',
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 3600
        });
        await auth.initialize();

        await auth.verifyToken('valid-token');
        
        const metrics = auth.getMetrics();
        expect(metrics.totalRequests).toBe(1);
        expect(metrics.successfulAuth).toBe(1);
        expect(metrics.failedAuth).toBe(0);
      });
    });

    describe('role validation', () => {
      const mockUser = {
        uid: 'test-user',
        email: 'test@example.com',
        email_verified: true,
        custom_claims: { roles: ['user', 'editor'] },
        provider: 'firebase' as const
      };

      it('should validate user roles correctly', () => {
        expect(auth.hasRequiredRoles(mockUser, ['user'])).toBe(true);
        expect(auth.hasRequiredRoles(mockUser, ['admin'])).toBe(false);
        expect(auth.hasRequiredRoles(mockUser, ['user', 'admin'])).toBe(true); // OR logic
        expect(auth.hasRequiredRoles(mockUser, [])).toBe(true); // No roles required
      });

      it('should handle users without roles', () => {
        const userWithoutRoles = { ...mockUser, custom_claims: {} };
        expect(auth.hasRequiredRoles(userWithoutRoles, ['user'])).toBe(false);
        expect(auth.hasRequiredRoles(userWithoutRoles, [])).toBe(true);
      });
    });

    describe('session cookie verification', () => {
      it('should verify valid session cookie', async () => {
        const mockClaims = {
          uid: 'test-user',
          email: 'test@example.com',
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 3600
        };

        mockFirebaseAuth.verifySessionCookie.mockResolvedValue(mockClaims);
        await auth.initialize();

        const result = await auth.verifySessionCookie('valid-session');

        expect(result.valid).toBe(true);
        expect(result.user?.uid).toBe('test-user');
      });

      it('should handle invalid session cookie', async () => {
        mockFirebaseAuth.verifySessionCookie.mockRejectedValue(new Error('Invalid session'));
        await auth.initialize();

        const result = await auth.verifySessionCookie('invalid-session');

        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe(AuthErrorCode.INVALID_TOKEN);
      });
    });

    describe('health check', () => {
      it('should return healthy status when initialized', async () => {
        await auth.initialize();
        const health = await auth.healthCheck();

        expect(health.healthy).toBe(true);
        expect(health.details.initialized).toBe(true);
        expect(health.details.firebase).toBe(true);
      });

      it('should return unhealthy status when not initialized', async () => {
        const health = await auth.healthCheck();

        expect(health.healthy).toBe(false);
        expect(health.details.initialized).toBe(false);
      });
    });

    describe('metrics', () => {
      it('should track authentication metrics', async () => {
        await auth.initialize();
        mockFirebaseAuth.verifyIdToken.mockResolvedValue({
          uid: 'test-user',
          email: 'test@example.com',
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 3600
        });

        // Successful auth
        await auth.verifyToken('valid-token');
        
        // Failed auth
        mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Invalid'));
        await auth.verifyToken('invalid-token');

        const metrics = auth.getMetrics();
        expect(metrics.totalRequests).toBe(2);
        expect(metrics.successfulAuth).toBe(1);
        expect(metrics.failedAuth).toBe(1);
        expect(metrics.errorsByCode[AuthErrorCode.FIREBASE_ERROR]).toBe(1);
      });

      it('should reset metrics', async () => {
        await auth.initialize();
        await auth.verifyToken('test-token');
        
        auth.resetMetrics();
        
        const metrics = auth.getMetrics();
        expect(metrics.totalRequests).toBe(0);
        expect(metrics.successfulAuth).toBe(0);
        expect(metrics.failedAuth).toBe(0);
      });
    });
  });

  describe('UnifiedAuthError', () => {
    it('should create error with correct properties', () => {
      const error = new UnifiedAuthError(
        AuthErrorCode.INVALID_TOKEN,
        'Test error',
        { detail: 'test' },
        401
      );

      expect(error.code).toBe(AuthErrorCode.INVALID_TOKEN);
      expect(error.message).toBe('Test error');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('UnifiedAuthError');
    });

    it('should create predefined error types', () => {
      expect(UnifiedAuthError.missingToken().code).toBe(AuthErrorCode.MISSING_TOKEN);
      expect(UnifiedAuthError.invalidToken().code).toBe(AuthErrorCode.INVALID_TOKEN);
      expect(UnifiedAuthError.expiredToken().code).toBe(AuthErrorCode.EXPIRED_TOKEN);
      expect(UnifiedAuthError.insufficientPermissions(['admin']).code).toBe(AuthErrorCode.INSUFFICIENT_PERMISSIONS);
      expect(UnifiedAuthError.serviceUnavailable('firebase').code).toBe(AuthErrorCode.SERVICE_UNAVAILABLE);
    });
  });

  describe('TokenUtils', () => {
    const mockJWT = 'eyJhbGciOiJSUzI1NiJ9.eyJ1aWQiOiJ0ZXN0LXVzZXIiLCJleHAiOjE3MDAwMDAwMDB9.signature';

    it('should parse JWT token info', () => {
      const tokenInfo = TokenUtils.parseTokenInfo(mockJWT);
      
      expect(tokenInfo).toBeTruthy();
      expect(tokenInfo?.provider).toBe('firebase');
      expect(tokenInfo?.userId).toBe('test-user');
      expect(tokenInfo?.expiresAt).toBeDefined();
    });

    it('should handle non-JWT tokens', () => {
      const tokenInfo = TokenUtils.parseTokenInfo('simple-token');
      
      expect(tokenInfo).toBeTruthy();
      expect(tokenInfo?.provider).toBe('custom');
      expect(tokenInfo?.value).toBe('simple-token');
    });

    it('should return null for malformed tokens', () => {
      const tokenInfo = TokenUtils.parseTokenInfo('malformed.jwt');
      expect(tokenInfo).toBeNull();
    });

    it('should check token expiry', () => {
      const expiredJWT = 'eyJhbGciOiJSUzI1NiJ9.eyJ1aWQiOiJ0ZXN0IiwiZXhwIjoxNTAwMDAwMDAwfQ.signature';
      const futureJWT = `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify({
        uid: 'test',
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64url')}.signature`;

      expect(TokenUtils.isTokenExpired(expiredJWT)).toBe(true);
      expect(TokenUtils.isTokenExpired(futureJWT)).toBe(false);
      expect(TokenUtils.isTokenExpired('simple-token')).toBe(false);
    });
  });

  describe('AuthPerformanceMonitor', () => {
    let monitor: AuthPerformanceMonitor;

    beforeEach(() => {
      monitor = AuthPerformanceMonitor.getInstance();
      monitor.reset();
    });

    it('should record timing measurements', () => {
      monitor.recordTiming('test-operation', 100);
      monitor.recordTiming('test-operation', 200);

      const stats = monitor.getStats('test-operation');
      expect(stats.count).toBe(2);
      expect(stats.average).toBe(150);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(200);
    });

    it('should provide timing function', (done) => {
      const endTiming = monitor.startTiming('test-timing');
      
      setTimeout(() => {
        const duration = endTiming();
        expect(duration).toBeGreaterThan(0);
        
        const stats = monitor.getStats('test-timing');
        expect(stats.count).toBe(1);
        done();
      }, 10);
    });

    it('should calculate percentiles correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      values.forEach(val => monitor.recordTiming('percentile-test', val));

      const stats = monitor.getStats('percentile-test');
      expect(stats.median).toBe(5);
      expect(stats.p95).toBe(10);
      expect(stats.p99).toBe(10);
    });

    it('should limit stored measurements', () => {
      // Record more than 100 measurements
      for (let i = 0; i < 150; i++) {
        monitor.recordTiming('limit-test', i);
      }

      const stats = monitor.getStats('limit-test');
      expect(stats.count).toBe(100); // Should cap at 100
    });
  });

  describe('Utility Functions', () => {
    describe('verifyAuthHeader', () => {
      beforeEach(async () => {
        const auth = getUnifiedAuth();
        await auth.initialize();
      });

      it('should verify valid auth header', async () => {
        mockFirebaseAuth.verifyIdToken.mockResolvedValue({
          uid: 'test-user',
          email: 'test@example.com',
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 3600
        });

        const result = await verifyAuthHeader('Bearer valid-token');

        expect(result.success).toBe(true);
        expect(result.user?.uid).toBe('test-user');
      });

      it('should handle missing auth header', async () => {
        const result = await verifyAuthHeader(null);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(AuthErrorCode.MISSING_TOKEN);
      });

      it('should handle invalid token format', async () => {
        const result = await verifyAuthHeader('Invalid format');

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe(AuthErrorCode.MISSING_TOKEN);
      });
    });

    describe('createAuthError', () => {
      it('should create auth error with all properties', () => {
        const error = createAuthError(
          AuthErrorCode.INVALID_TOKEN,
          'Test error',
          { test: true },
          401
        );

        expect(error).toBeInstanceOf(UnifiedAuthError);
        expect(error.code).toBe(AuthErrorCode.INVALID_TOKEN);
        expect(error.message).toBe('Test error');
        expect(error.details).toEqual({ test: true });
        expect(error.statusCode).toBe(401);
      });
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getUnifiedAuth();
      const instance2 = getUnifiedAuth();
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across instances', async () => {
      const instance1 = getUnifiedAuth();
      await instance1.initialize();

      const instance2 = getUnifiedAuth();
      expect(instance2['initialized']).toBe(true);
    });
  });
});
