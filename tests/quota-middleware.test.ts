// tests/quota-middleware.test.ts
import { withQuota } from '@/lib/middleware/quota-middleware';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { subscriptionService } from '@/lib/services/subscription-service';
import { NextRequest, NextResponse } from 'next/server';

// Mock the services
jest.mock('@/lib/services/firebase-verification', () => ({
  firebaseVerification: {
    verifyIdToken: jest.fn(),
  },
}));

jest.mock('@/lib/services/subscription-service', () => ({
  subscriptionService: {
    getUserSubscription: jest.fn(),
    getUserUsage: jest.fn(),
    incrementUsage: jest.fn(),
    initializeUsageCounters: jest.fn(),
    canPerformAction: jest.fn(),
    getUserSubscriptionStatus: jest.fn(),
  },
}));

// Mock dependencies
const mockVerifyIdToken = firebaseVerification.verifyIdToken as jest.MockedFunction<typeof firebaseVerification.verifyIdToken>;
const mockGetUserSubscription = subscriptionService.getUserSubscription as jest.MockedFunction<typeof subscriptionService.getUserSubscription>;
const mockGetUserUsage = subscriptionService.getUserUsage as jest.MockedFunction<typeof subscriptionService.getUserUsage>;
const mockIncrementUsage = subscriptionService.incrementUsage as jest.MockedFunction<typeof subscriptionService.incrementUsage>;
const mockInitializeUsageCounters = subscriptionService.initializeUsageCounters as jest.MockedFunction<typeof subscriptionService.initializeUsageCounters>;
const mockCanPerformAction = subscriptionService.canPerformAction as jest.MockedFunction<typeof subscriptionService.canPerformAction>;
const mockGetUserSubscriptionStatus = subscriptionService.getUserSubscriptionStatus as jest.MockedFunction<typeof subscriptionService.getUserSubscriptionStatus>;

describe('Quota Middleware', () => {
  let mockRequest: Partial<NextRequest>;
  let mockHandler: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      cookies: {
        get: jest.fn(),
      } as any,
    };
    
    mockHandler = jest.fn().mockResolvedValue({ status: 200 });
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should skip quota enforcement in development mode', async () => {
      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      await wrappedHandler(mockRequest as NextRequest);

      expect(mockHandler).toHaveBeenCalled();
      expect(mockGetUserSubscription).not.toHaveBeenCalled();
    });

    it('should extract userId in development mode when session exists', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'test-session-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'test-user-id' } as any,
      });

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      await wrappedHandler(mockRequest as NextRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest, { userId: 'test-user-id' });
    });
  });

  describe('Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should return 401 when no session cookie is provided', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue(undefined);

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      const response = await wrappedHandler(mockRequest as NextRequest);

      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should return 401 when session verification fails', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'invalid-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      const response = await wrappedHandler(mockRequest as NextRequest);

      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should allow premium users unlimited access', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'valid-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'premium-user-id' } as any,
      });
      mockCanPerformAction.mockResolvedValue({
        canPerform: true,
      });
      mockGetUserSubscriptionStatus.mockResolvedValue({
        plan: 'premium',
        planStatus: 'active',
        hasPremium: true,
        premiumSource: 'subscription',
        emailVerified: true,
        usage: null
      } as any);

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      const response = await wrappedHandler(mockRequest as NextRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest, { userId: 'premium-user-id' });
      expect(response.status).toBe(200);
    });

    it('should enforce quota limits for free users', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'valid-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'free-user-id' } as any,
      });
      mockCanPerformAction.mockResolvedValue({
        canPerform: false,
        reason: "You've reached your interviews limit for the free plan",
        upgradeRequired: true
      });
      mockGetUserSubscriptionStatus.mockResolvedValue({
        plan: 'free',
        planStatus: 'active',
        hasPremium: false,
        premiumSource: null,
        emailVerified: true,
        usage: {
          interviews: {
            count: 5,
            limit: 5,
            updatedAt: new Date(),
          }
        }
      } as any);

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      const response = await wrappedHandler(mockRequest as NextRequest);

      expect(response.status).toBe(402);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should allow free users within quota limits', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'valid-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'free-user-id' } as any,
      });
      mockCanPerformAction.mockResolvedValue({
        canPerform: true,
      });
      mockGetUserSubscriptionStatus.mockResolvedValue({
        plan: 'free',
        planStatus: 'active',
        hasPremium: false,
        premiumSource: null,
        emailVerified: true,
        usage: {
          interviews: {
            count: 3,
            limit: 5,
            updatedAt: new Date(),
          }
        }
      } as any);

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      const response = await wrappedHandler(mockRequest as NextRequest);

      expect(mockHandler).toHaveBeenCalledWith(mockRequest, { userId: 'free-user-id' });
      expect(response.status).toBe(200);
    });

    it('should increment usage counter on successful request', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'valid-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'free-user-id' } as any,
      });
      mockCanPerformAction.mockResolvedValue({
        canPerform: true,
      });
      mockGetUserSubscriptionStatus.mockResolvedValue({
        plan: 'free',
        planStatus: 'active',
        hasPremium: false,
        premiumSource: null,
        emailVerified: true,
        usage: {
          interviews: {
            count: 3,
            limit: 5,
            updatedAt: new Date(),
          }
        }
      } as any);
      mockIncrementUsage.mockResolvedValue(true);

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      await wrappedHandler(mockRequest as NextRequest);

      // Give time for async increment
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockIncrementUsage).toHaveBeenCalledWith('free-user-id', 'interviews');
    });

    it('should initialize usage counters when no usage record exists', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'valid-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'new-user-id' } as any,
      });
      mockCanPerformAction.mockResolvedValue({
        canPerform: true,
      });
      mockGetUserSubscriptionStatus.mockResolvedValue({
        plan: 'free',
        planStatus: 'active',
        hasPremium: false,
        premiumSource: null,
        emailVerified: true,
        usage: null
      } as any);
      mockInitializeUsageCounters.mockResolvedValue();

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      const response = await wrappedHandler(mockRequest as NextRequest);

      expect(response.status).toBe(200);
    });

    it('should handle errors gracefully', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'valid-token' });
      mockVerifyIdToken.mockRejectedValue(new Error('Service unavailable'));

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
      });

      const wrappedHandler = middleware(mockHandler);
      const response = await wrappedHandler(mockRequest as NextRequest);

      expect(response.status).toBe(500);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Feature-specific behavior', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should handle resume tailoring feature', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'valid-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'user-id' } as any,
      });
      mockCanPerformAction.mockResolvedValue({
        canPerform: true,
      });
      mockGetUserSubscriptionStatus.mockResolvedValue({
        plan: 'free',
        planStatus: 'active',
        hasPremium: false,
        premiumSource: null,
        emailVerified: true,
        usage: {
          resumeTailor: {
            count: 2,
            limit: 3,
            updatedAt: new Date(),
          }
        }
      } as any);

      const middleware = withQuota({
        featureKey: 'resumeTailor',
        limitFree: 3,
      });

      const wrappedHandler = middleware(mockHandler);
      const response = await wrappedHandler(mockRequest as NextRequest);

      expect(response.status).toBe(200);
    });

    it('should handle auto apply feature', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'valid-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'user-id' } as any,
      });
      mockCanPerformAction.mockResolvedValue({
        canPerform: false,
        reason: "You've reached your auto-apply job application limit for the free plan",
        upgradeRequired: true
      });
      mockGetUserSubscriptionStatus.mockResolvedValue({
        plan: 'free',
        planStatus: 'active',
        hasPremium: false,
        premiumSource: null,
        emailVerified: true,
        usage: {
          autoApply: {
            count: 10,
            limit: 10,
            updatedAt: new Date(),
          }
        }
      } as any);

      const middleware = withQuota({
        featureKey: 'autoApply',
        limitFree: 10,
      });

      const wrappedHandler = middleware(mockHandler);
      const response = await wrappedHandler(mockRequest as NextRequest);

      expect(response.status).toBe(402);
      expect(JSON.parse(response.body)).toMatchObject({
        success: false,
        error: "You've reached your auto-apply job application limit for the free plan",
        feature: 'autoApply',
        upgradeUrl: '/pricing',
      });
    });
  });

  describe('Custom usage document ID', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should use custom usage document ID when provided', async () => {
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'valid-token' });
      mockVerifyIdToken.mockResolvedValue({
        success: true,
        decodedToken: { uid: 'user-id' } as any,
      });
      mockCanPerformAction.mockResolvedValue({ canPerform: true });
      mockGetUserSubscriptionStatus.mockResolvedValue({
        plan: 'free',
        planStatus: 'active',
        hasPremium: false,
        premiumSource: null,
        emailVerified: true,
        usage: {
          interviews: {
            count: 1,
            limit: 5,
            updatedAt: new Date(),
          }
        }
      } as any);

      const middleware = withQuota({
        featureKey: 'interviews',
        limitFree: 5,
        usageDocId: 'custom-doc-id',
      });

      const wrappedHandler = middleware(mockHandler);
      await wrappedHandler(mockRequest as NextRequest);

      expect(mockCanPerformAction).toHaveBeenCalledWith('custom-doc-id', 'interviews', true);
    });
  });
});
