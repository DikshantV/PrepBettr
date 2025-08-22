/**
 * End-to-End Authentication Flow Tests
 * 
 * Tests complete authentication flows across platforms
 */

import { 
  UnifiedAuth,
  getUnifiedAuth,
  verifyAuthHeader,
  authSystemHealthCheck
} from '../index';

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    verifySessionCookie: jest.fn(),
    getUser: jest.fn()
  }))
}));

describe('End-to-End Authentication Flow', () => {
  let auth: UnifiedAuth;
  let mockFirebaseAuth: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    auth = getUnifiedAuth();
    
    const { getAdminAuth } = require('@/lib/firebase/admin');
    mockFirebaseAuth = getAdminAuth();
  });

  describe('Complete Authentication Flow', () => {
    it('should handle complete user authentication lifecycle', async () => {
      // 1. Initialize authentication system
      await auth.initialize();
      expect(auth['initialized']).toBe(true);

      // 2. Simulate user login with valid token
      const mockUser = {
        uid: 'user123',
        email: 'user@example.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
        custom_claims: { roles: ['user'] }
      };

      mockFirebaseAuth.verifyIdToken.mockResolvedValue(mockUser);

      // 3. Verify token through unified system
      const authResult = await verifyAuthHeader('Bearer valid-jwt-token');
      expect(authResult.success).toBe(true);
      expect(authResult.user?.uid).toBe('user123');
      expect(authResult.user?.email).toBe('user@example.com');

      // 4. Check metrics
      const metrics = auth.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulAuth).toBe(1);

      // 5. Simulate role-based access
      const hasUserRole = auth.hasRequiredRoles(authResult.user!, ['user']);
      const hasAdminRole = auth.hasRequiredRoles(authResult.user!, ['admin']);
      
      expect(hasUserRole).toBe(true);
      expect(hasAdminRole).toBe(false);
    });

    it('should handle authentication failure and recovery', async () => {
      await auth.initialize();

      // 1. Simulate invalid token
      mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));
      
      const failedResult = await verifyAuthHeader('Bearer invalid-token');
      expect(failedResult.success).toBe(false);

      // 2. Check error metrics
      let metrics = auth.getMetrics();
      expect(metrics.failedAuth).toBe(1);

      // 3. Simulate token refresh/recovery
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'user123',
        email: 'user@example.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      const recoveredResult = await verifyAuthHeader('Bearer refreshed-token');
      expect(recoveredResult.success).toBe(true);

      // 4. Verify recovery metrics
      metrics = auth.getMetrics();
      expect(metrics.successfulAuth).toBe(1);
      expect(metrics.failedAuth).toBe(1);
      expect(metrics.totalRequests).toBe(2);
    });
  });

  describe('Cross-Platform Consistency', () => {
    it('should provide consistent results across all adapters', async () => {
      await auth.initialize();
      
      const mockUser = {
        uid: 'consistent-user',
        email: 'test@example.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockFirebaseAuth.verifyIdToken.mockResolvedValue(mockUser);

      // Test core verification
      const coreResult = await auth.verifyToken('test-token');
      expect(coreResult.valid).toBe(true);
      expect(coreResult.user?.uid).toBe('consistent-user');

      // Test utility function
      const utilResult = await verifyAuthHeader('Bearer test-token');
      expect(utilResult.success).toBe(true);
      expect(utilResult.user?.uid).toBe('consistent-user');

      // Results should be consistent
      expect(coreResult.user?.uid).toBe(utilResult.user?.uid);
      expect(coreResult.user?.email).toBe(utilResult.user?.email);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent authentication requests', async () => {
      await auth.initialize();
      
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'concurrent-user',
        email: 'concurrent@example.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      // Simulate multiple concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) => 
        verifyAuthHeader(`Bearer token-${i}`)
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.user?.uid).toBe('concurrent-user');
      });

      // Check metrics
      const metrics = auth.getMetrics();
      expect(metrics.totalRequests).toBe(10);
      expect(metrics.successfulAuth).toBe(10);
    });

    it('should maintain performance under load', async () => {
      await auth.initialize();
      
      mockFirebaseAuth.verifyIdToken.mockImplementation(async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          uid: 'perf-user',
          email: 'perf@example.com',
          email_verified: true,
          exp: Math.floor(Date.now() / 1000) + 3600
        };
      });

      const startTime = Date.now();
      
      // Run 50 authentication requests
      const promises = Array.from({ length: 50 }, () => 
        verifyAuthHeader('Bearer perf-token')
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(totalTime).toBeLessThan(2000); // 2 seconds for 50 requests

      // Check performance metrics
      const metrics = auth.getMetrics();
      expect(metrics.averageVerificationTime).toBeGreaterThan(0);
      expect(metrics.averageVerificationTime).toBeLessThan(100); // 100ms average
    });
  });

  describe('Error Resilience', () => {
    it('should recover from Firebase service outage', async () => {
      await auth.initialize();

      // 1. Simulate service outage
      mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Service unavailable'));

      const outageResult = await verifyAuthHeader('Bearer token-during-outage');
      expect(outageResult.success).toBe(false);

      // 2. Simulate service recovery
      mockFirebaseAuth.verifyIdToken.mockResolvedValue({
        uid: 'recovered-user',
        email: 'recovered@example.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600
      });

      const recoveryResult = await verifyAuthHeader('Bearer token-after-recovery');
      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.user?.uid).toBe('recovered-user');
    });

    it('should handle malformed tokens gracefully', async () => {
      await auth.initialize();

      const malformedTests = [
        'Bearer', // Missing token
        'Bearer ', // Empty token
        'Basic token', // Wrong auth type
        'Bearer invalid..jwt', // Malformed JWT
        '', // Empty header
        'Bearer token-with-special-chars-!@#$%'
      ];

      for (const header of malformedTests) {
        const result = await verifyAuthHeader(header);
        expect(result.success).toBe(false);
        // Should not throw errors
      }
    });
  });

  describe('Health Monitoring', () => {
    it('should provide accurate system health status', async () => {
      // 1. Check health before initialization
      let health = await authSystemHealthCheck();
      expect(health.healthy).toBe(false);

      // 2. Initialize and check health
      await auth.initialize();
      health = await authSystemHealthCheck();
      expect(health.healthy).toBe(true);
      expect(health.core.details.initialized).toBe(true);
      expect(health.core.details.firebase).toBe(true);

      // 3. Check metrics are included
      expect(health.metrics.core).toBeDefined();
      expect(health.metrics.performance).toBeDefined();
    });

    it('should detect authentication system degradation', async () => {
      await auth.initialize();

      // Simulate some failures to trigger degradation
      mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Intermittent failure'));

      // Generate some failures
      for (let i = 0; i < 5; i++) {
        await verifyAuthHeader('Bearer failing-token');
      }

      const metrics = auth.getMetrics();
      expect(metrics.failedAuth).toBe(5);
      expect(metrics.totalRequests).toBe(5);

      // Health check should still be healthy (system operational)
      // but metrics should show the issues
      const health = await authSystemHealthCheck();
      expect(health.healthy).toBe(true); // System is up
      expect(health.metrics.core.failedAuth).toBe(5); // But has failures
    });
  });

  describe('Security Features', () => {
    it('should handle token expiry correctly', async () => {
      await auth.initialize();

      // Simulate expired token
      mockFirebaseAuth.verifyIdToken.mockRejectedValue({
        code: 'auth/id-token-expired'
      });

      const result = await verifyAuthHeader('Bearer expired-token');
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EXPIRED_TOKEN');
    });

    it('should validate required roles strictly', async () => {
      await auth.initialize();

      const userWithRoles = {
        uid: 'role-user',
        email: 'role@example.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600,
        custom_claims: { roles: ['user', 'editor'] }
      };

      mockFirebaseAuth.verifyIdToken.mockResolvedValue(userWithRoles);
      const result = await verifyAuthHeader('Bearer role-token');
      
      expect(result.success).toBe(true);
      
      // Test various role combinations
      expect(auth.hasRequiredRoles(result.user!, ['user'])).toBe(true);
      expect(auth.hasRequiredRoles(result.user!, ['editor'])).toBe(true);
      expect(auth.hasRequiredRoles(result.user!, ['admin'])).toBe(false);
      expect(auth.hasRequiredRoles(result.user!, ['user', 'admin'])).toBe(true); // OR logic
      expect(auth.hasRequiredRoles(result.user!, ['admin', 'superuser'])).toBe(false);
    });
  });
});
