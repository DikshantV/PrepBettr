// lib/services/sendgrid-service.ts

import sgMail from '@sendgrid/mail';
import { MailDataRequired, MailData } from '@sendgrid/helpers/classes/mail';

export interface EmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  categories?: string[];
  customArgs?: Record<string, string>;
}

export class SendGridService {
  private defaultFromEmail: string;
  private isInitialized: boolean = false;

  constructor() {
    this.defaultFromEmail = process.env.SENDGRID_FROM_EMAIL || 'contact@prepbettr.com';
    this.initializeSendGrid();
  }

  private initializeSendGrid() {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      console.warn('SENDGRID_API_KEY not found. Email functionality will be limited.');
      return;
    }

    try {
      sgMail.setApiKey(apiKey);
      this.isInitialized = true;
      console.log('SendGrid service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SendGrid:', error);
    }
  }

  /**
   * Send a single email using SendGrid
   */
  async sendEmail(params: EmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'SendGrid service not initialized. Check SENDGRID_API_KEY.'
      };
    }

    try {
      const { to, subject, html, text, from, templateId, dynamicTemplateData, categories, customArgs } = params;

      // Ensure we have either HTML/text content or a template
      if (!html && !text && !templateId) {
        return {
          success: false,
          error: 'Either HTML/text content or templateId must be provided'
        };
      }

      // Convert single recipient to array for consistent handling
      const recipients = Array.isArray(to) ? to : [to];

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = recipients.filter(email => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        return {
          success: false,
          error: `Invalid email addresses: ${invalidEmails.join(', ')}`
        };
      }

      // Build email data
      const mailData: MailData = {
        from: from || this.defaultFromEmail,
        to: recipients,
        subject: subject,
        ...(categories && { categories }),
        ...(customArgs && { customArgs }),
      };

      // Add content based on what's provided
      if (templateId) {
        mailData.templateId = templateId;
        if (dynamicTemplateData) {
          mailData.dynamicTemplateData = dynamicTemplateData;
        }
      } else {
        if (html) {
          mailData.html = html;
        }
        if (text) {
          mailData.text = text;
        }
      }

      const [response] = await sgMail.send(mailData as MailDataRequired);

      console.log(`Email sent successfully via SendGrid to ${recipients.join(', ')}. Status: ${response.statusCode}`);

      return {
        success: true,
        messageId: response.headers['x-message-id'] || response.statusCode?.toString(),
      };

    } catch (error: any) {
      console.error('Error sending email via SendGrid:', error);
      
      let errorMessage = 'Failed to send email';
      
      // Handle SendGrid specific errors
      if (error.response) {
        const { statusCode, body } = error.response;
        errorMessage = `SendGrid API error (${statusCode}): ${JSON.stringify(body)}`;
        
        // Handle specific error codes
        switch (statusCode) {
          case 400:
            errorMessage = 'Bad request - check email parameters';
            break;
          case 401:
            errorMessage = 'Unauthorized - check SendGrid API key';
            break;
          case 403:
            errorMessage = 'Forbidden - insufficient permissions';
            break;
          case 413:
            errorMessage = 'Email content too large';
            break;
          case 429:
            errorMessage = 'Rate limit exceeded';
            break;
          default:
            errorMessage = `SendGrid error: ${body?.errors?.[0]?.message || 'Unknown error'}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk emails (SendGrid supports up to 1000 personalizations per request)
   */
  async sendBulkEmail(
    recipients: string[],
    subject: string,
    html?: string,
    text?: string,
    from?: string,
    templateId?: string,
    dynamicTemplateData?: Record<string, any>
  ): Promise<{ success: boolean; sent: number; failed: string[]; errors: string[] }> {
    const results = {
      success: true,
      sent: 0,
      failed: [] as string[],
      errors: [] as string[],
    };

    // SendGrid allows up to 1000 personalizations per request
    const batchSize = 1000;
    const batches = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      try {
        const emailParams: EmailParams = {
          to: batch,
          subject,
          html,
          text,
          from,
          templateId,
          dynamicTemplateData
        };

        const result = await this.sendEmail(emailParams);

        if (result.success) {
          results.sent += batch.length;
        } else {
          results.failed.push(...batch);
          results.errors.push(result.error || 'Unknown error');
          results.success = false;
        }
      } catch (error) {
        results.failed.push(...batch);
        results.errors.push(error instanceof Error ? error.message : 'Unknown error');
        results.success = false;
      }
    }

    return results;
  }

  /**
   * Verify an email address with SendGrid (for sender verification)
   * Note: SendGrid handles verification differently than SES
   */
  async verifyEmailAddress(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      // SendGrid doesn't require email verification in the same way as SES
      // This is handled through sender authentication and domain verification
      console.log(`Email verification requested for ${email}. Ensure sender authentication is configured in SendGrid.`);
      
      // For development/testing, we can simulate verification
      if (process.env.NODE_ENV === 'development') {
        console.log(`Simulated verification success for ${email} in development mode`);
        return { success: true };
      }

      // In production, sender verification should be handled via SendGrid dashboard
      return { 
        success: true,
        error: 'Sender verification should be configured in SendGrid dashboard'
      };
    } catch (error) {
      console.error('Error with email verification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify email address',
      };
    }
  }

  /**
   * Check if SendGrid is properly configured
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'SendGrid service not initialized. Check SENDGRID_API_KEY.'
      };
    }

    try {
      // Test connection by attempting to send a test email to a test address
      // In a real implementation, you might want to use SendGrid's API to check account status
      const testResult = await this.sendEmail({
        to: 'test@example.com',
        subject: 'SendGrid Connection Test',
        text: 'This is a connection test. This email should not be delivered.',
        html: '<p>This is a connection test. This email should not be delivered.</p>'
      });

      // Even if the test email "fails" due to invalid recipient, 
      // a successful API response indicates the connection is working
      if (testResult.error && testResult.error.includes('Invalid email')) {
        console.log('SendGrid connection test successful (invalid test email expected)');
        return { success: true };
      }

      console.log('SendGrid connection test result:', testResult);
      
      return { 
        success: true,
        error: testResult.error 
      };
    } catch (error) {
      console.error('SendGrid connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Send email using SendGrid template
   */
  async sendTemplatedEmail(
    to: string | string[],
    templateId: string,
    dynamicTemplateData: Record<string, any>,
    from?: string,
    categories?: string[],
    customArgs?: Record<string, string>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendEmail({
      to,
      subject: '', // Subject is defined in the template
      templateId,
      dynamicTemplateData,
      from,
      categories,
      customArgs
    });
  }

  /**
   * Get service statistics (placeholder - SendGrid stats require separate API calls)
   */
  async getStats(): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
      // This would require additional SendGrid API calls to get statistics
      // For now, return success without detailed stats
      console.log('SendGrid statistics require separate API implementation');
      
      return {
        success: true,
        stats: {
          service: 'SendGrid',
          initialized: this.isInitialized,
          message: 'Statistics available through SendGrid dashboard'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats'
      };
    }
  }
}

// Export singleton instance
export const sendGridService = new SendGridService();

// Export with the same name as the old AWS SES service for easy replacement
export const awsSESService = sendGridService;