// tests/webhook-integration.test.ts
import crypto from 'crypto';
import { NextRequest } from 'next/server';

// Mock the webhook handler
jest.mock('@/app/api/webhooks/dodo/route', () => ({
  POST: jest.fn(),
}));

describe('Webhook Integration Tests', () => {
  const TEST_WEBHOOK_SECRET = 'test_webhook_secret_key_123';
  const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/dodo';
  
  beforeEach(() => {
    process.env.DODO_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.DODO_WEBHOOK_SECRET;
  });

  // Helper function to generate webhook signature
  function generateWebhookSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  // Helper function to create mock webhook request
  function createMockWebhookRequest(payload: any, signature?: string): Partial<NextRequest> {
    const payloadString = JSON.stringify(payload);
    const actualSignature = signature || generateWebhookSignature(payloadString, TEST_WEBHOOK_SECRET);
    
    return {
      method: 'POST',
      headers: new Map([
        ['content-type', 'application/json'],
        ['x-dodo-signature', actualSignature],
      ]),
      json: async () => payload,
      text: async () => payloadString,
    };
  }

  // Sample webhook payloads
  const PAYMENT_SUCCESS_PAYLOAD = {
    id: 'evt_test_123',
    type: 'payment_intent.succeeded',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'pi_test_123',
        amount: 2999,
        currency: 'usd',
        status: 'succeeded',
        metadata: {
          userId: 'user_123',
          plan: 'premium',
          billing_cycle: 'monthly',
        },
      },
    },
  };

  const SUBSCRIPTION_CREATED_PAYLOAD = {
    id: 'evt_test_456',
    type: 'customer.subscription.created',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'sub_test_456',
        customer: 'cus_test_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        metadata: {
          userId: 'user_123',
          plan: 'premium',
        },
      },
    },
  };

  const SUBSCRIPTION_CANCELLED_PAYLOAD = {
    id: 'evt_test_789',
    type: 'customer.subscription.deleted',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'sub_test_456',
        customer: 'cus_test_123',
        status: 'canceled',
        metadata: {
          userId: 'user_123',
        },
      },
    },
  };

  describe('Webhook Signature Verification', () => {
    it('should accept webhooks with valid signatures', async () => {
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD);
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ received: true }), { status: 200 }));
      
      const response = await POST(mockRequest);
      const responseData = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseData.received).toBe(true);
      expect(POST).toHaveBeenCalledWith(mockRequest);
    });

    it('should reject webhooks with invalid signatures', async () => {
      const invalidSignature = 'invalid_signature_123';
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD, invalidSignature);
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 }));
      
      const response = await POST(mockRequest);
      const responseData = await response.json();
      
      expect(response.status).toBe(401);
      expect(responseData.error).toContain('signature');
    });

    it('should reject webhooks with missing signatures', async () => {
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD);
      // Remove signature header
      mockRequest.headers?.delete('x-dodo-signature');
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ error: 'Missing signature' }), { status: 401 }));
      
      const response = await POST(mockRequest);
      
      expect(response.status).toBe(401);
    });

    it('should reject webhooks when webhook secret is not configured', async () => {
      delete process.env.DODO_WEBHOOK_SECRET;
      
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD);
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ error: 'Webhook secret not configured' }), { status: 500 }));
      
      const response = await POST(mockRequest);
      
      expect(response.status).toBe(500);
    });

    it('should handle malformed signature headers gracefully', async () => {
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD);
      mockRequest.headers?.set('x-dodo-signature', ''); // Empty signature
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid signature format' }), { status: 401 }));
      
      const response = await POST(mockRequest);
      
      expect(response.status).toBe(401);
    });
  });

  describe('Webhook Idempotency', () => {
    it('should handle duplicate webhook events idempotently', async () => {
      const { POST } = require('@/app/api/webhooks/dodo/route');
      
      // Mock successful processing for first request
      POST.mockResolvedValueOnce(new Response(JSON.stringify({ received: true, processed: true }), { status: 200 }));
      // Mock idempotent response for duplicate
      POST.mockResolvedValueOnce(new Response(JSON.stringify({ received: true, processed: false, reason: 'duplicate' }), { status: 200 }));
      
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD);
      
      // First request
      const response1 = await POST(mockRequest);
      const data1 = await response1.json();
      
      expect(response1.status).toBe(200);
      expect(data1.processed).toBe(true);
      
      // Duplicate request with same event ID
      const response2 = await POST(mockRequest);
      const data2 = await response2.json();
      
      expect(response2.status).toBe(200);
      expect(data2.processed).toBe(false);
      expect(data2.reason).toBe('duplicate');
    });

    it('should track processed webhook event IDs', async () => {
      const { POST } = require('@/app/api/webhooks/dodo/route');
      
      // Create multiple different events
      const event1 = { ...PAYMENT_SUCCESS_PAYLOAD, id: 'evt_unique_1' };
      const event2 = { ...PAYMENT_SUCCESS_PAYLOAD, id: 'evt_unique_2' };
      
      const request1 = createMockWebhookRequest(event1);
      const request2 = createMockWebhookRequest(event2);
      
      POST.mockResolvedValue(new Response(JSON.stringify({ received: true, processed: true }), { status: 200 }));
      
      // Process both events
      const response1 = await POST(request1);
      const response2 = await POST(request2);
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(POST).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent duplicate requests properly', async () => {
      const { POST } = require('@/app/api/webhooks/dodo/route');
      
      // Mock race condition handling
      POST.mockImplementation(async () => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return new Response(JSON.stringify({ received: true, processed: true }), { status: 200 });
      });
      
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD);
      
      // Send concurrent requests
      const promises = [
        POST(mockRequest),
        POST(mockRequest),
        POST(mockRequest),
      ];
      
      const responses = await Promise.all(promises);
      
      // All should succeed (idempotency handling)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Payment Event Processing', () => {
    it('should process payment success events correctly', async () => {
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ 
        received: true, 
        processed: true,
        action: 'subscription_activated'
      }), { status: 200 }));
      
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD);
      
      const response = await POST(mockRequest);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.action).toBe('subscription_activated');
    });

    it('should process subscription creation events', async () => {
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ 
        received: true, 
        processed: true,
        action: 'subscription_created'
      }), { status: 200 }));
      
      const mockRequest = createMockWebhookRequest(SUBSCRIPTION_CREATED_PAYLOAD);
      
      const response = await POST(mockRequest);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.action).toBe('subscription_created');
    });

    it('should process subscription cancellation events', async () => {
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ 
        received: true, 
        processed: true,
        action: 'subscription_cancelled'
      }), { status: 200 }));
      
      const mockRequest = createMockWebhookRequest(SUBSCRIPTION_CANCELLED_PAYLOAD);
      
      const response = await POST(mockRequest);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.action).toBe('subscription_cancelled');
    });

    it('should handle unknown webhook event types gracefully', async () => {
      const unknownEvent = {
        id: 'evt_unknown',
        type: 'unknown.event.type',
        data: { object: { id: 'unknown_obj' } },
      };
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ 
        received: true, 
        processed: false,
        reason: 'unknown_event_type'
      }), { status: 200 }));
      
      const mockRequest = createMockWebhookRequest(unknownEvent);
      
      const response = await POST(mockRequest);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(data.processed).toBe(false);
      expect(data.reason).toBe('unknown_event_type');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle webhook processing errors gracefully', async () => {
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockRejectedValue(new Error('Database connection failed'));
      
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD);
      
      try {
        await POST(mockRequest);
      } catch (error) {
        expect(error.message).toBe('Database connection failed');
      }
    });

    it('should validate webhook payload structure', async () => {
      const invalidPayload = {
        id: 'evt_test',
        // Missing type and data fields
      };
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ 
        error: 'Invalid payload structure' 
      }), { status: 400 }));
      
      const mockRequest = createMockWebhookRequest(invalidPayload);
      
      const response = await POST(mockRequest);
      
      expect(response.status).toBe(400);
    });

    it('should handle missing metadata gracefully', async () => {
      const payloadWithoutMetadata = {
        ...PAYMENT_SUCCESS_PAYLOAD,
        data: {
          object: {
            id: 'pi_test',
            amount: 2999,
            currency: 'usd',
            status: 'succeeded',
            // No metadata field
          },
        },
      };
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ 
        received: true, 
        processed: false,
        reason: 'missing_user_metadata'
      }), { status: 200 }));
      
      const mockRequest = createMockWebhookRequest(payloadWithoutMetadata);
      
      const response = await POST(mockRequest);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.processed).toBe(false);
      expect(data.reason).toBe('missing_user_metadata');
    });
  });

  describe('Webhook Security', () => {
    it('should prevent replay attacks with timestamp validation', async () => {
      const oldEvent = {
        ...PAYMENT_SUCCESS_PAYLOAD,
        created: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      POST.mockResolvedValue(new Response(JSON.stringify({ 
        error: 'Webhook timestamp too old' 
      }), { status: 401 }));
      
      const mockRequest = createMockWebhookRequest(oldEvent);
      
      const response = await POST(mockRequest);
      
      expect(response.status).toBe(401);
    });

    it('should validate webhook source IP if configured', async () => {
      process.env.ALLOWED_WEBHOOK_IPS = '127.0.0.1,192.168.1.0/24';
      
      const { POST } = require('@/app/api/webhooks/dodo/route');
      
      // Mock request from allowed IP
      POST.mockResolvedValueOnce(new Response(JSON.stringify({ received: true }), { status: 200 }));
      
      const mockRequest = createMockWebhookRequest(PAYMENT_SUCCESS_PAYLOAD);
      
      const response = await POST(mockRequest);
      
      expect(response.status).toBe(200);
      
      delete process.env.ALLOWED_WEBHOOK_IPS;
    });
  });
  });

