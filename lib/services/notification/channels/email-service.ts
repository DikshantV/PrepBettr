/**
 * Email Service Channel
 * 
 * Extracted from notification-service.ts
 * Handles email sending using various providers (SendGrid, Resend, etc.)
 * Uses the MJML template engine for professional email formatting.
 */

// Import type declarations for optional dependencies
import './email-types';

import { 
  NotificationEvent, 
  EmailTemplateType, 
  JobDiscoveredData, 
  ApplicationSubmittedData,
  FollowUpReminderData,
  DailySummaryData,
  EmailResult,
  NotificationResult 
} from '../core/types';
import { mjmlTemplateEngine } from '../templates/mjml-template-engine';

// Email provider interfaces
interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<EmailResult>;
  verify?: () => Promise<boolean>;
}

interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

// SendGrid provider
class SendGridProvider implements EmailProvider {
  name = 'sendgrid';
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      // Dynamic import to avoid build issues
      const sgMail = (await import('@sendgrid/mail')).default;
      sgMail.setApiKey(this.apiKey);

      const msg = {
        to: message.to,
        from: message.from || this.fromEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        headers: message.headers,
      };

      const [response] = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response.headers['x-message-id'] as string || 'unknown',
      };
    } catch (error: any) {
      console.error('SendGrid send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email via SendGrid',
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      const sgMail = (await import('@sendgrid/mail')).default;
      sgMail.setApiKey(this.apiKey);
      
      // Test with a dry run
      const testMsg = {
        to: this.fromEmail,
        from: this.fromEmail,
        subject: 'SendGrid Verification Test',
        html: '<p>This is a test email to verify SendGrid configuration.</p>',
        mailSettings: {
          sandboxMode: {
            enable: true
          }
        }
      };

      await sgMail.send(testMsg as any);
      return true;
    } catch (error) {
      console.error('SendGrid verification failed:', error);
      return false;
    }
  }
}

// Resend provider
class ResendProvider implements EmailProvider {
  name = 'resend';
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const resendModule = await import('resend').catch(() => null) as any;
      if (!resendModule) {
        return {
          success: false,
          error: 'Resend package not installed'
        };
      }
      const { Resend } = resendModule;
      const resend = new Resend(this.apiKey);

      const result = await resend.emails.send({
        from: message.from || this.fromEmail,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
        headers: message.headers,
      });

      if (result.error) {
        return {
          success: false,
          error: result.error.message,
        };
      }

      return {
        success: true,
        messageId: result.data?.id || 'unknown',
      };
    } catch (error: any) {
      console.error('Resend send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email via Resend',
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      const resendModule = await import('resend').catch(() => null) as any;
      if (!resendModule) {
        console.warn('Resend package not installed');
        return false;
      }
      const { Resend } = resendModule;
      const resend = new Resend(this.apiKey);

      // Check API key validity by listing domains
      const result = await resend.domains.list();
      return !result.error;
    } catch (error) {
      console.error('Resend verification failed:', error);
      return false;
    }
  }
}

// Nodemailer provider (for SMTP)
class NodemailerProvider implements EmailProvider {
  name = 'nodemailer';
  private config: any;
  private fromEmail: string;

  constructor(config: any, fromEmail: string) {
    this.config = config;
    this.fromEmail = fromEmail;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const nodemailer = await import('nodemailer').catch(() => null) as any;
      if (!nodemailer) {
        return {
          success: false,
          error: 'Nodemailer package not installed'
        };
      }
      const transporter = nodemailer.createTransport(this.config);

      const info = await transporter.sendMail({
        from: message.from || this.fromEmail,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        headers: message.headers,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error('Nodemailer send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email via SMTP',
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      const nodemailer = await import('nodemailer').catch(() => null) as any;
      if (!nodemailer) {
        console.warn('Nodemailer package not installed');
        return false;
      }
      const transporter = nodemailer.createTransport(this.config);
      await transporter.verify();
      return true;
    } catch (error) {
      console.error('Nodemailer verification failed:', error);
      return false;
    }
  }
}

export class EmailService {
  private providers: EmailProvider[] = [];
  private activeProvider: EmailProvider | null = null;
  private fromEmail: string;
  private replyToEmail?: string;

  constructor(fromEmail: string, replyToEmail?: string) {
    this.fromEmail = fromEmail;
    this.replyToEmail = replyToEmail;
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize providers based on available environment variables
    if (process.env.SENDGRID_API_KEY) {
      this.providers.push(new SendGridProvider(process.env.SENDGRID_API_KEY, this.fromEmail));
    }

    if (process.env.RESEND_API_KEY) {
      this.providers.push(new ResendProvider(process.env.RESEND_API_KEY, this.fromEmail));
    }

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      };
      this.providers.push(new NodemailerProvider(smtpConfig, this.fromEmail));
    }

    // Set the first available provider as active
    this.activeProvider = this.providers[0] || null;
  }

  async sendNotificationEmail(notification: NotificationEvent): Promise<NotificationResult> {
    if (!this.activeProvider) {
      return {
        success: false,
        error: 'No email provider configured',
      };
    }

    try {
      const html = await this.generateEmailContent(
        notification.type as EmailTemplateType,
        notification.metadata || {}
      );

      const message: EmailMessage = {
        to: notification.recipient,
        from: this.fromEmail,
        subject: notification.subject,
        html,
        text: this.htmlToText(html),
        replyTo: this.replyToEmail,
        headers: {
          'X-PrepBettr-Type': notification.type,
          'X-PrepBettr-User': notification.userId,
          ...(notification.jobId && { 'X-PrepBettr-Job': notification.jobId }),
          ...(notification.applicationId && { 'X-PrepBettr-App': notification.applicationId }),
        },
      };

      const result = await this.activeProvider.send(message);
      
      if (!result.success && this.providers.length > 1) {
        // Try fallback provider
        console.log(`Primary provider (${this.activeProvider.name}) failed, trying fallback`);
        this.activeProvider = this.providers.find(p => p !== this.activeProvider) || this.activeProvider;
        return await this.sendNotificationEmail(notification);
      }

      return {
        success: result.success,
        error: result.error,
        messageId: result.messageId,
      };
    } catch (error: any) {
      console.error('Email service error:', error);
      return {
        success: false,
        error: error.message || 'Unknown email service error',
      };
    }
  }

  private async generateEmailContent(type: EmailTemplateType, data: any): Promise<string> {
    const userName = data.userName || 'User';

    switch (type) {
      case 'job_discovered':
        return mjmlTemplateEngine.generateJobDiscoveredEmail(userName, data as JobDiscoveredData);

      case 'application_submitted':
        return mjmlTemplateEngine.generateApplicationSubmittedEmail(userName, data as ApplicationSubmittedData);

      case 'follow_up_reminder':
        return this.generateFollowUpReminderEmail(userName, data as FollowUpReminderData);

      case 'daily_summary':
        return this.generateDailySummaryEmail(userName, data as DailySummaryData);

      default:
        return this.generateGenericEmail(userName, type, data);
    }
  }

  private generateFollowUpReminderEmail(userName: string, data: FollowUpReminderData): string {
    const daysSince = Math.floor((new Date().getTime() - data.appliedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Follow-up Reminder</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 20px; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
          .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
          .content { padding: 20px; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; font-size: 14px; color: #6b7280; }
          .reminder-box { background-color: #fef3c7; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">⏰ Follow-up Reminder</h1>
            <p style="font-size: 18px; color: #6b7280; margin: 10px 0 0;">Hi ${userName}, time for a follow-up!</p>
          </div>
          
          <div class="content">
            <div class="reminder-box">
              <h3 style="margin: 0 0 10px; color: #92400e;">Application Follow-up</h3>
              <p><strong>Position:</strong> ${data.jobTitle}</p>
              <p><strong>Company:</strong> ${data.company}</p>
              <p><strong>Applied:</strong> ${data.appliedDate.toLocaleDateString()} (${daysSince} days ago)</p>
              <p><strong>Follow-up Type:</strong> ${data.followUpType.replace('_', ' ').toUpperCase()}</p>
            </div>
            
            ${data.suggestedMessage ? `
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="margin: 0 0 10px; color: #0369a1;">💡 Suggested Message</h3>
              <p style="font-style: italic; color: #374151;">"${data.suggestedMessage}"</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/applications/${data.applicationId}" class="button">View Application</a>
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/follow-ups" class="button" style="background-color: #059669;">Manage Follow-ups</a>
            </div>
          </div>
          
          <div class="footer">
            Regular follow-ups increase your response rate by up to 40%!<br>
            <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/notifications" style="color: #2563eb;">Manage notification preferences</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDailySummaryEmail(userName: string, data: DailySummaryData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Daily Summary</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 20px; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
          .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
          .content { padding: 20px; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat-item { text-align: center; padding: 15px; background-color: #f8fafc; border-radius: 6px; margin: 0 5px; flex: 1; }
          .stat-number { font-size: 24px; font-weight: 600; color: #059669; margin: 0; }
          .stat-label { font-size: 14px; color: #6b7280; margin: 5px 0 0; }
          .job-item { padding: 15px; border: 1px solid #e5e7eb; border-radius: 6px; margin: 10px 0; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">📊 Daily Summary</h1>
            <p style="font-size: 18px; color: #6b7280; margin: 10px 0 0;">Hi ${userName}, here's your job search update for ${data.date.toLocaleDateString()}</p>
          </div>
          
          <div class="content">
            <div class="stats">
              <div class="stat-item">
                <div class="stat-number">${data.jobsFound}</div>
                <div class="stat-label">Jobs Found</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">${data.applicationsSubmitted}</div>
                <div class="stat-label">Applied</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">${data.followUpsSent}</div>
                <div class="stat-label">Follow-ups</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">${data.upcomingFollowUps}</div>
                <div class="stat-label">Upcoming</div>
              </div>
            </div>
            
            ${data.topJobs.length > 0 ? `
            <div style="margin: 30px 0;">
              <h3 style="color: #111827; margin-bottom: 15px;">🔥 Top Job Matches</h3>
              ${data.topJobs.slice(0, 3).map(job => `
                <div class="job-item">
                  <h4 style="margin: 0 0 5px; color: #111827;">${job.jobTitle}</h4>
                  <p style="margin: 0 0 5px; color: #6b7280;">${job.company} • ${job.location}</p>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="background-color: #ecfccb; color: #365314; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${job.relevancyScore}% match</span>
                    ${job.jobUrl ? `<a href="${job.jobUrl}" style="color: #2563eb; text-decoration: none;">View Job →</a>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/dashboard" class="button">View Dashboard</a>
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/jobs" class="button" style="background-color: #059669;">Browse Jobs</a>
            </div>
          </div>
          
          <div class="footer">
            Keep up the great work! Consistent job searching leads to success.<br>
            <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/notifications" style="color: #2563eb;">Manage daily summary preferences</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateGenericEmail(userName: string, type: string, data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>PrepBettr Notification</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 20px; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
          .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
          .content { padding: 20px; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">PrepBettr Update</h1>
            <p style="font-size: 18px; color: #6b7280; margin: 10px 0 0;">Hi ${userName}</p>
          </div>
          
          <div class="content">
            <p>You have a ${type.replace('_', ' ')} update from PrepBettr.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/dashboard" class="button">View Dashboard</a>
            </div>
          </div>
          
          <div class="footer">
            Thank you for using PrepBettr to accelerate your job search!<br>
            <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/notifications" style="color: #2563eb;">Manage notification preferences</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.activeProvider?.verify) {
      return true; // Assume working if no verification method
    }
    return await this.activeProvider.verify();
  }

  getProviderName(): string {
    return this.activeProvider?.name || 'none';
  }

  getAvailableProviders(): string[] {
    return this.providers.map(p => p.name);
  }
}

// Singleton instance
export const emailService = new EmailService(
  process.env.FROM_EMAIL || 'noreply@prepbettr.com',
  process.env.REPLY_TO_EMAIL || 'support@prepbettr.com'
);