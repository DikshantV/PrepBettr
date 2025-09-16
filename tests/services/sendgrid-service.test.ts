// tests/services/sendgrid-service.test.ts

import { SendGridService } from '@/lib/services/sendgrid-service';

// Mock SendGrid SDK
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

describe('SendGridService', () => {
  let sendGridService: SendGridService;
  let mockSendGrid: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock SendGrid
    mockSendGrid = require('@sendgrid/mail');
    
    // Set up environment variables
    process.env.SENDGRID_API_KEY = 'test-api-key';
    process.env.SENDGRID_FROM_EMAIL = 'test@example.com';
    
    sendGridService = new SendGridService();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
  });

  describe('sendEmail', () => {
    it('should send a single email successfully', async () => {
      // Mock successful response
      mockSendGrid.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'test-message-id' }
      }]);

      const result = await sendGridService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: 'Test content'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockSendGrid.send).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid email addresses', async () => {
      const result = await sendGridService.sendEmail({
        to: 'invalid-email',
        subject: 'Test Subject',
        html: '<p>Test content</p>'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email addresses');
      expect(mockSendGrid.send).not.toHaveBeenCalled();
    });

    it('should handle SendGrid API errors', async () => {
      // Mock SendGrid error
      const sendGridError = {
        response: {
          statusCode: 400,
          body: { errors: [{ message: 'Bad Request' }] }
        }
      };
      mockSendGrid.send.mockRejectedValue(sendGridError);

      const result = await sendGridService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Bad request - check email parameters');
    });

    it('should handle multiple recipients', async () => {
      mockSendGrid.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'test-message-id' }
      }]);

      const result = await sendGridService.sendEmail({
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: 'Test Subject',
        html: '<p>Test content</p>'
      });

      expect(result.success).toBe(true);
      expect(mockSendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['recipient1@example.com', 'recipient2@example.com']
        })
      );
    });
  });

  describe('sendBulkEmail', () => {
    it('should send bulk emails successfully', async () => {
      mockSendGrid.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'test-message-id' }
      }]);

      const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
      const result = await sendGridService.sendBulkEmail(
        recipients,
        'Bulk Test Subject',
        '<p>Bulk test content</p>',
        'Bulk test content'
      );

      expect(result.success).toBe(true);
      expect(result.sent).toBe(3);
      expect(result.failed).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should handle partial failures in bulk sending', async () => {
      // First call succeeds, second fails
      mockSendGrid.send
        .mockResolvedValueOnce([{
          statusCode: 202,
          headers: { 'x-message-id': 'test-message-id-1' }
        }])
        .mockRejectedValueOnce(new Error('Network error'));

      const recipients = Array.from({ length: 1500 }, (_, i) => `user${i}@example.com`);
      const result = await sendGridService.sendBulkEmail(
        recipients,
        'Bulk Test Subject',
        '<p>Bulk test content</p>'
      );

      expect(result.success).toBe(false);
      expect(result.sent).toBe(1000); // First batch succeeded
      expect(result.failed.length).toBe(500); // Second batch failed
      expect(result.errors).toContain('Network error');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockSendGrid.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'test-message-id' }
      }]);

      const result = await sendGridService.testConnection();

      expect(result.success).toBe(true);
    });

    it('should handle connection test failure', async () => {
      mockSendGrid.send.mockRejectedValue(new Error('Connection failed'));

      const result = await sendGridService.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('verifyEmailAddress', () => {
    it('should handle email verification in development', async () => {
      process.env.NODE_ENV = 'development';

      const result = await sendGridService.verifyEmailAddress('test@example.com');

      expect(result.success).toBe(true);
    });

    it('should handle email verification in production', async () => {
      process.env.NODE_ENV = 'production';

      const result = await sendGridService.verifyEmailAddress('test@example.com');

      expect(result.success).toBe(true);
      expect(result.error).toContain('SendGrid dashboard');
    });
  });

  describe('sendTemplatedEmail', () => {
    it('should send templated email successfully', async () => {
      mockSendGrid.send.mockResolvedValue([{
        statusCode: 202,
        headers: { 'x-message-id': 'test-message-id' }
      }]);

      const result = await sendGridService.sendTemplatedEmail(
        'recipient@example.com',
        'template-id-123',
        { name: 'John', company: 'Test Corp' },
        'custom@example.com',
        ['newsletter'],
        { userId: '12345' }
      );

      expect(result.success).toBe(true);
      expect(mockSendGrid.send).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'template-id-123',
          dynamicTemplateData: { name: 'John', company: 'Test Corp' },
          categories: ['newsletter'],
          customArgs: { userId: '12345' }
        })
      );
    });
  });
});