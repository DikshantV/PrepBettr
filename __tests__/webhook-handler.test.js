// __tests__/webhook-handler.test.js

import { createMocks } from 'node-mocks-http';
import webhookHandler from '../app/api/paypal/webhooks/route';

/**
 * PayPal Webhook Handler Tests
 * Tests webhook event processing, signature validation, and database updates
 */

describe('PayPal Webhook Handler', () => {
  let mockDb;

  beforeEach(() => {
    // Mock database operations
    mockDb = {
      subscriptions: new Map(),
      
      updateSubscription: jest.fn(async (id, data) => {
        const existing = mockDb.subscriptions.get(id) || {};
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockDb.subscriptions.set(id, updated);
        return updated;
      }),

      getSubscription: jest.fn(async (id) => {
        return mockDb.subscriptions.get(id);
      }),

      createPaymentRecord: jest.fn(async (data) => {
        return { id: 'payment_' + Date.now(), ...data };
      })
    };

    // Setup test subscription
    mockDb.subscriptions.set('I-TEST123456789', {
      id: 'I-TEST123456789',
      userId: 'user_123',
      planId: 'individual',
      status: 'active',
      paypalSubscriptionId: 'I-TEST123456789',
      createdAt: new Date('2024-01-01'),
      currentPeriodStart: new Date('2024-01-01'),
      currentPeriodEnd: new Date('2024-02-01')
    });
  });

  describe('Webhook Event Processing', () => {
    it('processes BILLING.SUBSCRIPTION.ACTIVATED event correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          'paypal-transmission-id': 'test-transmission-id',
          'paypal-cert-id': 'test-cert-id',
          'paypal-auth-algo': 'SHA256withRSA',
          'paypal-transmission-time': new Date().toISOString(),
          'paypal-auth-version': 'v1'
        },
        body: mockWebhookPayloads.subscriptionActivated
      });

      // Mock signature verification
      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      await webhookHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockDb.updateSubscription).toHaveBeenCalledWith(
        'I-TEST123456789',
        expect.objectContaining({
          status: 'active',
          paypalStatus: 'ACTIVE'
        })
      );
    });

    it('processes BILLING.SUBSCRIPTION.CANCELLED event correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: getValidWebhookHeaders(),
        body: mockWebhookPayloads.subscriptionCancelled
      });

      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      await webhookHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockDb.updateSubscription).toHaveBeenCalledWith(
        'I-TEST123456789',
        expect.objectContaining({
          status: 'cancelled',
          paypalStatus: 'CANCELLED',
          cancelledAt: expect.any(Date)
        })
      );
    });

    it('processes PAYMENT.SALE.COMPLETED event correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: getValidWebhookHeaders(),
        body: mockWebhookPayloads.paymentCompleted
      });

      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      await webhookHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockDb.createPaymentRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          paypalPaymentId: 'PAY-TEST123456789',
          amount: 49.00,
          currency: 'USD',
          status: 'completed'
        })
      );
    });

    it('processes BILLING.SUBSCRIPTION.PAYMENT.FAILED event correctly', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: getValidWebhookHeaders(),
        body: mockWebhookPayloads.paymentFailed
      });

      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      await webhookHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockDb.updateSubscription).toHaveBeenCalledWith(
        'I-TEST123456789',
        expect.objectContaining({
          status: 'past_due',
          lastPaymentFailed: true,
          lastPaymentError: expect.any(String)
        })
      );
    });
  });

  describe('Webhook Signature Validation', () => {
    it('rejects webhooks with invalid signature', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: getValidWebhookHeaders(),
        body: mockWebhookPayloads.subscriptionActivated
      });

      // Mock invalid signature
      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(false);

      await webhookHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Unauthorized',
        message: 'Invalid webhook signature'
      });
    });

    it('validates required webhook headers', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          // Missing required headers
          'paypal-transmission-id': 'test-id'
        },
        body: mockWebhookPayloads.subscriptionActivated
      });

      await webhookHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Bad Request',
        message: 'Missing required webhook headers'
      });
    });
  });

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: getValidWebhookHeaders(),
        body: mockWebhookPayloads.subscriptionActivated
      });

      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      // Mock database error
      mockDb.updateSubscription.mockRejectedValue(new Error('Database connection failed'));

      await webhookHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Internal Server Error',
        message: 'Failed to process webhook'
      });
    });

    it('handles unknown webhook events', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: getValidWebhookHeaders(),
        body: {
          event_type: 'UNKNOWN.EVENT.TYPE',
          resource: { id: 'test-resource' }
        }
      });

      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      await webhookHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'Webhook received but not processed',
        event_type: 'UNKNOWN.EVENT.TYPE'
      });
    });

    it('handles malformed webhook payload', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: getValidWebhookHeaders(),
        body: {
          // Missing required fields
          event_type: 'BILLING.SUBSCRIPTION.ACTIVATED'
          // No resource field
        }
      });

      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      await webhookHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Bad Request',
        message: 'Invalid webhook payload structure'
      });
    });
  });

  describe('Subscription Status Transitions', () => {
    it('correctly transitions from active to cancelled', async () => {
      // Setup active subscription
      mockDb.subscriptions.set('I-TEST123456789', {
        id: 'I-TEST123456789',
        status: 'active',
        paypalStatus: 'ACTIVE'
      });

      const { req, res } = createMocks({
        method: 'POST',
        headers: getValidWebhookHeaders(),
        body: mockWebhookPayloads.subscriptionCancelled
      });

      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      await webhookHandler(req, res);

      const updatedSubscription = mockDb.subscriptions.get('I-TEST123456789');
      expect(updatedSubscription.status).toBe('cancelled');
      expect(updatedSubscription.cancelledAt).toBeDefined();
    });

    it('correctly transitions from active to past_due on payment failure', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: getValidWebhookHeaders(),
        body: mockWebhookPayloads.paymentFailed
      });

      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      await webhookHandler(req, res);

      const updatedSubscription = mockDb.subscriptions.get('I-TEST123456789');
      expect(updatedSubscription.status).toBe('past_due');
      expect(updatedSubscription.lastPaymentFailed).toBe(true);
    });
  });

  describe('Idempotency', () => {
    it('handles duplicate webhook events gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          ...getValidWebhookHeaders(),
          'paypal-transmission-id': 'duplicate-transmission-id'
        },
        body: mockWebhookPayloads.subscriptionActivated
      });

      jest.spyOn(require('../lib/paypal-client'), 'verifyWebhookSignature')
        .mockResolvedValue(true);

      // Process webhook first time
      await webhookHandler(req, res);
      expect(res._getStatusCode()).toBe(200);

      // Reset mocks for second request
      mockDb.updateSubscription.mockClear();

      // Process same webhook again
      await webhookHandler(req, res);

      // Should still return 200 but not process duplicate
      expect(res._getStatusCode()).toBe(200);
      expect(mockDb.updateSubscription).not.toHaveBeenCalled();
    });
  });
});

// Helper function to generate valid webhook headers
function getValidWebhookHeaders() {
  return {
    'paypal-transmission-id': 'test-transmission-' + Date.now(),
    'paypal-cert-id': 'test-cert-id',
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-transmission-time': new Date().toISOString(),
    'paypal-auth-version': 'v1',
    'content-type': 'application/json'
  };
}

// Mock webhook payloads for testing
export const mockWebhookPayloads = {
  subscriptionActivated: {
    id: 'WH-TEST-SUBSCRIPTION-ACTIVATED',
    event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    resource_type: 'subscription',
    summary: 'Subscription activated.',
    resource: {
      id: 'I-TEST123456789',
      status: 'ACTIVE',
      status_update_time: '2024-01-01T10:00:00Z',
      plan_id: 'P-TEST-INDIVIDUAL-MONTHLY',
      start_time: '2024-01-01T10:00:00Z',
      subscriber: {
        email_address: 'test@prepbettr.com',
        payer_id: 'TESTPAYERID123'
      },
      billing_info: {
        outstanding_balance: {
          currency_code: 'USD',
          value: '0.00'
        },
        cycle_executions: [
          {
            tenure_type: 'TRIAL',
            sequence: 1,
            cycles_completed: 0,
            cycles_remaining: 1
          },
          {
            tenure_type: 'REGULAR',
            sequence: 2,
            cycles_completed: 0,
            cycles_remaining: 0
          }
        ],
        next_billing_time: '2024-01-08T10:00:00Z'
      }
    },
    create_time: '2024-01-01T10:00:00Z',
    event_version: '1.0'
  },

  subscriptionCancelled: {
    id: 'WH-TEST-SUBSCRIPTION-CANCELLED',
    event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
    resource_type: 'subscription',
    summary: 'Subscription cancelled.',
    resource: {
      id: 'I-TEST123456789',
      status: 'CANCELLED',
      status_update_time: '2024-02-01T10:00:00Z',
      plan_id: 'P-TEST-INDIVIDUAL-MONTHLY',
      subscriber: {
        email_address: 'test@prepbettr.com',
        payer_id: 'TESTPAYERID123'
      }
    },
    create_time: '2024-02-01T10:00:00Z',
    event_version: '1.0'
  },

  paymentCompleted: {
    id: 'WH-TEST-PAYMENT-COMPLETED',
    event_type: 'PAYMENT.SALE.COMPLETED',
    resource_type: 'sale',
    summary: 'Payment completed for subscription.',
    resource: {
      id: 'PAY-TEST123456789',
      state: 'completed',
      amount: {
        total: '49.00',
        currency: 'USD'
      },
      payment_mode: 'INSTANT_TRANSFER',
      protection_eligibility: 'ELIGIBLE',
      transaction_fee: {
        value: '1.72',
        currency: 'USD'
      },
      billing_agreement_id: 'I-TEST123456789',
      create_time: '2024-01-01T10:00:00Z',
      update_time: '2024-01-01T10:00:00Z'
    },
    create_time: '2024-01-01T10:00:00Z',
    event_version: '1.0'
  },

  paymentFailed: {
    id: 'WH-TEST-PAYMENT-FAILED',
    event_type: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
    resource_type: 'subscription',
    summary: 'Payment failed for subscription.',
    resource: {
      id: 'I-TEST123456789',
      status: 'ACTIVE',
      status_update_time: '2024-01-15T10:00:00Z',
      plan_id: 'P-TEST-INDIVIDUAL-MONTHLY',
      billing_info: {
        outstanding_balance: {
          currency_code: 'USD',
          value: '49.00'
        },
        cycle_executions: [
          {
            tenure_type: 'REGULAR',
            sequence: 1,
            cycles_completed: 1,
            cycles_remaining: 0
          }
        ],
        failed_payments_count: 1,
        next_billing_time: '2024-01-18T10:00:00Z'
      },
      subscriber: {
        email_address: 'test@prepbettr.com',
        payer_id: 'TESTPAYERID123'
      }
    },
    create_time: '2024-01-15T10:00:00Z',
    event_version: '1.0'
  },

  subscriptionSuspended: {
    id: 'WH-TEST-SUBSCRIPTION-SUSPENDED',
    event_type: 'BILLING.SUBSCRIPTION.SUSPENDED',
    resource_type: 'subscription',
    summary: 'Subscription suspended.',
    resource: {
      id: 'I-TEST123456789',
      status: 'SUSPENDED',
      status_update_time: '2024-01-20T10:00:00Z',
      plan_id: 'P-TEST-INDIVIDUAL-MONTHLY',
      subscriber: {
        email_address: 'test@prepbettr.com',
        payer_id: 'TESTPAYERID123'
      }
    },
    create_time: '2024-01-20T10:00:00Z',
    event_version: '1.0'
  },

  subscriptionReactivated: {
    id: 'WH-TEST-SUBSCRIPTION-REACTIVATED',
    event_type: 'BILLING.SUBSCRIPTION.RE-ACTIVATED',
    resource_type: 'subscription',
    summary: 'Subscription reactivated.',
    resource: {
      id: 'I-TEST123456789',
      status: 'ACTIVE',
      status_update_time: '2024-01-25T10:00:00Z',
      plan_id: 'P-TEST-INDIVIDUAL-MONTHLY',
      billing_info: {
        outstanding_balance: {
          currency_code: 'USD',
          value: '0.00'
        },
        next_billing_time: '2024-02-01T10:00:00Z'
      },
      subscriber: {
        email_address: 'test@prepbettr.com',
        payer_id: 'TESTPAYERID123'
      }
    },
    create_time: '2024-01-25T10:00:00Z',
    event_version: '1.0'
  }
};