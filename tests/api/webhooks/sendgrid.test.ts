// tests/api/webhooks/sendgrid.test.ts
// Tests for SendGrid webhook endpoint

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/webhooks/sendgrid/route';
import crypto from 'crypto';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('/api/webhooks/sendgrid', () => {
  describe('GET endpoint', () => {
    it('should return health check information', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        service: 'SendGrid Webhook Endpoint',
        status: 'healthy',
        timestamp: expect.any(String),
        environment: process.env.NODE_ENV,
        webhookSecretConfigured: false // No secret in test env
      });
    });

    it('should show webhook secret as configured when present', async () => {
      process.env.SENDGRID_WEBHOOK_SECRET = 'test-secret';

      const response = await GET();
      const data = await response.json();

      expect(data.webhookSecretConfigured).toBe(true);
    });
  });

  describe('POST endpoint', () => {
    const mockSendGridEvents = [
      {
        email: 'test@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        event: 'delivered' as const,
        sg_event_id: 'test-event-id',
        sg_message_id: 'test-message-id'
      },
      {
        email: 'bounce@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        event: 'bounce' as const,
        sg_event_id: 'test-bounce-id',
        sg_message_id: 'test-bounce-message-id',
        reason: 'Mail box does not exist'
      }
    ];

    it('should process valid SendGrid webhook events', async () => {
      const payload = JSON.stringify(mockSendGridEvents);
      const request = new NextRequest('http://localhost:3000/api/webhooks/sendgrid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payload
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        processed: 2,
        timestamp: expect.any(String)
      });
    });

    it('should handle invalid JSON payload', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/sendgrid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid-json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON payload');
    });

    it('should verify webhook signature in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENDGRID_WEBHOOK_SECRET = 'test-webhook-secret';

      const payload = JSON.stringify(mockSendGridEvents);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = crypto
        .createHmac('sha256', 'test-webhook-secret')
        .update(timestamp + payload)
        .digest('base64');

      const request = new NextRequest('http://localhost:3000/api/webhooks/sendgrid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Twilio-Email-Event-Webhook-Signature': signature,
          'X-Twilio-Email-Event-Webhook-Timestamp': timestamp
        },
        body: payload
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid webhook signature in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENDGRID_WEBHOOK_SECRET = 'test-webhook-secret';

      const payload = JSON.stringify(mockSendGridEvents);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const invalidSignature = 'invalid-signature';

      const request = new NextRequest('http://localhost:3000/api/webhooks/sendgrid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Twilio-Email-Event-Webhook-Signature': invalidSignature,
          'X-Twilio-Email-Event-Webhook-Timestamp': timestamp
        },
        body: payload
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid webhook signature');
    });

    it('should skip signature verification in development', async () => {
      process.env.NODE_ENV = 'development';
      // No webhook secret set

      const payload = JSON.stringify(mockSendGridEvents);
      const request = new NextRequest('http://localhost:3000/api/webhooks/sendgrid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Twilio-Email-Event-Webhook-Signature': 'any-signature',
          'X-Twilio-Email-Event-Webhook-Timestamp': '123456'
        },
        body: payload
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Event handling', () => {
    // Spy on console methods to test logging
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should handle delivered events', async () => {
      const events = [{
        email: 'test@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        event: 'delivered' as const,
        sg_event_id: 'test-event-id',
        sg_message_id: 'test-message-id'
      }];

      const request = new NextRequest('http://localhost:3000/api/webhooks/sendgrid', {
        method: 'POST',
        body: JSON.stringify(events)
      });

      await POST(request);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Email delivered to test@example.com')
      );
    });

    it('should handle bounce events', async () => {
      const events = [{
        email: 'bounce@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        event: 'bounce' as const,
        sg_event_id: 'test-event-id',
        sg_message_id: 'test-message-id',
        reason: 'Mailbox does not exist'
      }];

      const request = new NextRequest('http://localhost:3000/api/webhooks/sendgrid', {
        method: 'POST',
        body: JSON.stringify(events)
      });

      await POST(request);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Email bounced for bounce@example.com: Mailbox does not exist')
      );
    });

    it('should handle spam report events', async () => {
      const events = [{
        email: 'spam@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        event: 'spam_report' as const,
        sg_event_id: 'test-event-id',
        sg_message_id: 'test-message-id'
      }];

      const request = new NextRequest('http://localhost:3000/api/webhooks/sendgrid', {
        method: 'POST',
        body: JSON.stringify(events)
      });

      await POST(request);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('🚫 Spam report from spam@example.com')
      );
    });

    it('should handle open and click events', async () => {
      const events = [
        {
          email: 'open@example.com',
          timestamp: Math.floor(Date.now() / 1000),
          event: 'open' as const,
          sg_event_id: 'test-open-id',
          sg_message_id: 'test-message-id'
        },
        {
          email: 'click@example.com',
          timestamp: Math.floor(Date.now() / 1000),
          event: 'click' as const,
          sg_event_id: 'test-click-id',
          sg_message_id: 'test-message-id',
          url: 'https://prepbettr.com/dashboard'
        }
      ];

      const request = new NextRequest('http://localhost:3000/api/webhooks/sendgrid', {
        method: 'POST',
        body: JSON.stringify(events)
      });

      await POST(request);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('👁️ Email opened by open@example.com')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🖱️ Email link clicked by click@example.com: https://prepbettr.com/dashboard')
      );
    });
  });
});