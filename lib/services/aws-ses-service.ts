// lib/services/aws-ses-service.ts

import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';

export interface EmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export class AWSSESService {
  private sesClient: SESClient;
  private defaultFromEmail: string;

  constructor() {
    // Initialize SES client with region and credentials
    this.sesClient = new SESClient({
      region: process.env.AWS_SES_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.defaultFromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@prepbettr.com';
  }

  /**
   * Send a single email using AWS SES
   */
  async sendEmail(params: EmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { to, subject, html, text, from } = params;

      // Ensure we have either HTML or text content
      if (!html && !text) {
        return {
          success: false,
          error: 'Either HTML or text content must be provided'
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

      const command = new SendEmailCommand({
        Source: from || this.defaultFromEmail,
        Destination: {
          ToAddresses: recipients,
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            ...(html && {
              Html: {
                Data: html,
                Charset: 'UTF-8',
              },
            }),
            ...(text && {
              Text: {
                Data: text,
                Charset: 'UTF-8',
              },
            }),
          },
        },
      });

      const result = await this.sesClient.send(command);

      console.log(`Email sent successfully to ${recipients.join(', ')}. MessageId: ${result.MessageId}`);

      return {
        success: true,
        messageId: result.MessageId,
      };

    } catch (error) {
      console.error('Error sending email via AWS SES:', error);
      
      let errorMessage = 'Failed to send email';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send bulk emails (up to 50 recipients per call)
   */
  async sendBulkEmail(
    recipients: string[],
    subject: string,
    html?: string,
    text?: string,
    from?: string
  ): Promise<{ success: boolean; sent: number; failed: string[]; errors: string[] }> {
    const results = {
      success: true,
      sent: 0,
      failed: [] as string[],
      errors: [] as string[],
    };

    // AWS SES allows up to 50 recipients per call
    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      try {
        const result = await this.sendEmail({
          to: batch,
          subject,
          html,
          text,
          from,
        });

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
   * Verify an email address with AWS SES (for sandbox mode)
   */
  async verifyEmailAddress(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { VerifyEmailIdentityCommand } = await import('@aws-sdk/client-ses');
      const command = new VerifyEmailIdentityCommand({
        EmailAddress: email,
      });

      await this.sesClient.send(command);

      console.log(`Verification email sent to ${email}`);

      return { success: true };
    } catch (error) {
      console.error('Error verifying email address:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify email address',
      };
    }
  }

  /**
   * Check if AWS SES is properly configured
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to get sending quota to test connection
      const { GetSendQuotaCommand } = await import('@aws-sdk/client-ses');
      const command = new GetSendQuotaCommand({});
      
      const result = await this.sesClient.send(command);
      
      console.log('AWS SES connection successful:', {
        maxSendRate: result.MaxSendRate,
        max24HourSend: result.Max24HourSend,
        sentLast24Hours: result.SentLast24Hours,
      });

      return { success: true };
    } catch (error) {
      console.error('AWS SES connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }
}

// Export singleton instance
export const awsSESService = new AWSSESService();
