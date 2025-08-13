// lib/services/notification-service.ts

import { azureCosmosService } from './azure-cosmos-service';
import { awsSESService, EmailParams } from './aws-ses-service';
// MJML import with conditional loading for build compatibility
let mjml2html: any;

try {
  // Only import MJML in runtime, not during build
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'development') {
    // For production builds, use dynamic import
    mjml2html = null;
  } else {
    mjml2html = require('mjml').default || require('mjml');
  }
} catch (error) {
  console.warn('MJML not available, falling back to simple HTML templates');
  mjml2html = null;
}

export interface NotificationEvent {
  id?: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  content: string;
  templateUsed?: string;
  metadata?: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'bounced' | 'delivered';
  createdAt: Date;
  sentAt?: Date;
  updatedAt?: Date;
  error?: string;
  messageId?: string;
  jobId?: string;
  applicationId?: string;
}

export type NotificationType = 
  | 'job_discovered'
  | 'application_submitted'
  | 'follow_up_reminder'
  | 'interview_scheduled'
  | 'application_status_update'
  | 'daily_summary'
  | 'weekly_report'
  | 'search_completed'
  | 'quota_warning'
  | 'welcome'
  | 'verification'
  | 'premium_upgrade';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export interface JobDiscoveredData {
  jobId: string;
  jobTitle: string;
  company: string;
  location: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    period: string;
  };
  relevancyScore: number;
  matchedSkills: string[];
  jobUrl?: string;
  portal: string;
}

export interface ApplicationSubmittedData {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  submittedAt: Date;
  autoApplied: boolean;
  coverLetterUsed: boolean;
  resumeTailored: boolean;
  relevancyScore: number;
}

export interface FollowUpReminderData {
  applicationId: string;
  jobTitle: string;
  company: string;
  appliedDate: Date;
  followUpType: 'initial' | 'second' | 'thank_you' | 'status_check';
  suggestedMessage?: string;
}

export interface DailySummaryData {
  date: Date;
  jobsFound: number;
  applicationsSubmitted: number;
  followUpsSent: number;
  upcomingFollowUps: number;
  topJobs: JobDiscoveredData[];
}

export class NotificationService {

  /**
   * Send job discovered notification
   */
  async notifyJobDiscovered(
    userId: string,
    email: string,
    userName: string,
    jobData: JobDiscoveredData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const emailContent = this.generateJobDiscoveredEmail(userName, jobData);
      
      const result = await this.sendEmail({
        userId,
        type: 'job_discovered',
        recipient: email,
        subject: `New Job Match: ${jobData.jobTitle} at ${jobData.company}`,
        content: emailContent,
        templateUsed: 'job_discovered',
        metadata: {
          jobId: jobData.jobId,
          relevancyScore: jobData.relevancyScore,
          company: jobData.company,
          portal: jobData.portal
        },
        jobId: jobData.jobId
      });

      return result;
    } catch (error) {
      console.error('Error sending job discovered notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification'
      };
    }
  }

  /**
   * Send application submitted notification
   */
  async notifyApplicationSubmitted(
    userId: string,
    email: string,
    userName: string,
    applicationData: ApplicationSubmittedData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const emailContent = this.generateApplicationSubmittedEmail(userName, applicationData);
      
      const result = await this.sendEmail({
        userId,
        type: 'application_submitted',
        recipient: email,
        subject: `Application Submitted: ${applicationData.jobTitle} at ${applicationData.company}`,
        content: emailContent,
        templateUsed: 'application_submitted',
        metadata: {
          applicationId: applicationData.applicationId,
          jobId: applicationData.jobId,
          autoApplied: applicationData.autoApplied,
          relevancyScore: applicationData.relevancyScore
        },
        jobId: applicationData.jobId,
        applicationId: applicationData.applicationId
      });

      return result;
    } catch (error) {
      console.error('Error sending application submitted notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification'
      };
    }
  }

  /**
   * Send follow-up reminder notification
   */
  async notifyFollowUpReminder(
    userId: string,
    email: string,
    userName: string,
    followUpData: FollowUpReminderData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const emailContent = this.generateFollowUpReminderEmail(userName, followUpData);
      
      const result = await this.sendEmail({
        userId,
        type: 'follow_up_reminder',
        recipient: email,
        subject: `Follow-up Reminder: ${followUpData.jobTitle} at ${followUpData.company}`,
        content: emailContent,
        templateUsed: 'follow_up_reminder',
        metadata: {
          applicationId: followUpData.applicationId,
          followUpType: followUpData.followUpType,
          daysSinceApplication: Math.floor((new Date().getTime() - followUpData.appliedDate.getTime()) / (1000 * 60 * 60 * 24))
        },
        applicationId: followUpData.applicationId
      });

      return result;
    } catch (error) {
      console.error('Error sending follow-up reminder notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification'
      };
    }
  }

  /**
   * Send daily summary notification
   */
  async notifyDailySummary(
    userId: string,
    email: string,
    userName: string,
    summaryData: DailySummaryData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const emailContent = this.generateDailySummaryEmail(userName, summaryData);
      
      const result = await this.sendEmail({
        userId,
        type: 'daily_summary',
        recipient: email,
        subject: `Daily Job Search Summary - ${summaryData.date.toLocaleDateString()}`,
        content: emailContent,
        templateUsed: 'daily_summary',
        metadata: {
          date: summaryData.date.toISOString(),
          jobsFound: summaryData.jobsFound,
          applicationsSubmitted: summaryData.applicationsSubmitted,
          followUpsSent: summaryData.followUpsSent
        }
      });

      return result;
    } catch (error) {
      console.error('Error sending daily summary notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification'
      };
    }
  }

  /**
   * Send generic email notification
   */
  private async sendEmail(params: {
    userId: string;
    type: NotificationType;
    recipient: string;
    subject: string;
    content: string;
    templateUsed?: string;
    metadata?: Record<string, any>;
    jobId?: string;
    applicationId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    let eventId: string | undefined;
    
    try {
      // Create notification event record
      eventId = await azureCosmosService.createNotificationEvent({
        userId: params.userId,
        type: params.type,
        channel: 'email',
        recipient: params.recipient,
        subject: params.subject,
        content: params.content,
        templateUsed: params.templateUsed,
        metadata: params.metadata,
        status: 'pending',
        createdAt: new Date(),
        jobId: params.jobId,
        applicationId: params.applicationId
      });

      // Send email via AWS SES
      const emailParams: EmailParams = {
        to: params.recipient,
        subject: params.subject,
        html: params.content
      };

      const emailResult = await awsSESService.sendEmail(emailParams);

      // Update event status
      await azureCosmosService.updateNotificationEvent(eventId, params.userId, {
        status: emailResult.success ? 'sent' : 'failed',
        sentAt: emailResult.success ? new Date() : undefined,
        messageId: emailResult.messageId,
        error: emailResult.error,
        updatedAt: new Date()
      });

      console.log(`Notification ${params.type} ${emailResult.success ? 'sent' : 'failed'} to ${params.recipient}`);

      return {
        success: emailResult.success,
        error: emailResult.error
      };

    } catch (error) {
      console.error('Error in sendEmail:', error);
      
      // Update event status to failed (only if eventId exists)
      if (eventId) {
        try {
          await azureCosmosService.updateNotificationEvent(eventId, params.userId, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date()
          });
        } catch (updateError) {
          console.error('Failed to update notification event status:', updateError);
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email'
      };
    }
  }

  /**
   * Generate job discovered email using MJML
   */
  private generateJobDiscoveredEmail(userName: string, jobData: JobDiscoveredData): string {
    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-title>New Job Match Found</mj-title>
          <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
          <mj-attributes>
            <mj-all font-family="Inter, Arial, sans-serif" />
            <mj-text font-size="16px" color="#374151" line-height="1.6" />
            <mj-button font-size="16px" font-weight="600" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f9fafb">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="600" color="#111827" align="center">
                🎯 New Job Match Found!
              </mj-text>
              <mj-text font-size="18px" color="#6b7280" align="center" padding-bottom="30px">
                Hi ${userName}, we found a job that matches your profile
              </mj-text>
            </mj-column>
          </mj-section>

          <mj-section background-color="#ffffff" padding="0 20px">
            <mj-column>
              <mj-table>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151; width: 30%;">Position:</td>
                  <td style="padding: 15px 0; color: #111827; font-weight: 500;">${jobData.jobTitle}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Company:</td>
                  <td style="padding: 15px 0; color: #111827; font-weight: 500;">${jobData.company}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Location:</td>
                  <td style="padding: 15px 0; color: #111827;">${jobData.location}</td>
                </tr>
                ${jobData.salary ? `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Salary:</td>
                  <td style="padding: 15px 0; color: #111827;">
                    ${jobData.salary.min && jobData.salary.max 
                      ? `$${jobData.salary.min?.toLocaleString()} - $${jobData.salary.max?.toLocaleString()} ${jobData.salary.period}`
                      : `Competitive salary`
                    }
                  </td>
                </tr>` : ''}
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Match Score:</td>
                  <td style="padding: 15px 0; color: #059669; font-weight: 600;">${jobData.relevancyScore}%</td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Portal:</td>
                  <td style="padding: 15px 0; color: #111827;">${jobData.portal}</td>
                </tr>
              </mj-table>
            </mj-column>
          </mj-section>

          ${jobData.matchedSkills.length > 0 ? `
          <mj-section background-color="#ffffff" padding="30px 20px">
            <mj-column>
              <mj-text font-size="18px" font-weight="600" color="#111827" padding-bottom="15px">
                🎯 Matched Skills
              </mj-text>
              <mj-text font-size="14px" color="#374151">
                ${jobData.matchedSkills.map(skill => 
                  `<span style="background-color: #ecfccb; color: #365314; padding: 4px 8px; border-radius: 12px; margin-right: 8px; margin-bottom: 4px; display: inline-block;">${skill}</span>`
                ).join('')}
              </mj-text>
            </mj-column>
          </mj-section>` : ''}

          <mj-section background-color="#ffffff" padding="30px 20px">
            <mj-column>
              ${jobData.jobUrl ? `
              <mj-button background-color="#2563eb" color="#ffffff" href="${jobData.jobUrl}" target="_blank" padding-bottom="15px">
                View Job Details
              </mj-button>` : ''}
              <mj-button background-color="#059669" color="#ffffff" href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/jobs/${jobData.jobId}" target="_blank">
                Manage in PrepBettr
              </mj-button>
            </mj-column>
          </mj-section>

          <mj-section background-color="#f9fafb" padding="30px 20px">
            <mj-column>
              <mj-text font-size="14px" color="#6b7280" align="center">
                This job was automatically discovered by PrepBettr based on your preferences.
                <br />
                <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/notifications" style="color: #2563eb;">Manage notification preferences</a>
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    if (mjml2html) {
      try {
        const { html } = mjml2html(mjmlTemplate);
        return html;
      } catch (error) {
        console.warn('MJML compilation failed, using fallback HTML:', error);
      }
    }
    
    // Fallback HTML generation
    return this.generateFallbackJobDiscoveredEmail(userName, jobData);
  }

  /**
   * Generate application submitted email using MJML
   */
  private generateApplicationSubmittedEmail(userName: string, appData: ApplicationSubmittedData): string {
    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-title>Application Submitted Successfully</mj-title>
          <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
          <mj-attributes>
            <mj-all font-family="Inter, Arial, sans-serif" />
            <mj-text font-size="16px" color="#374151" line-height="1.6" />
            <mj-button font-size="16px" font-weight="600" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f9fafb">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="600" color="#111827" align="center">
                ✅ Application Submitted!
              </mj-text>
              <mj-text font-size="18px" color="#6b7280" align="center" padding-bottom="30px">
                Hi ${userName}, your application has been successfully submitted
              </mj-text>
            </mj-column>
          </mj-section>

          <mj-section background-color="#ffffff" padding="0 20px">
            <mj-column>
              <mj-table>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151; width: 30%;">Position:</td>
                  <td style="padding: 15px 0; color: #111827; font-weight: 500;">${appData.jobTitle}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Company:</td>
                  <td style="padding: 15px 0; color: #111827; font-weight: 500;">${appData.company}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Submitted:</td>
                  <td style="padding: 15px 0; color: #111827;">${appData.submittedAt.toLocaleDateString()} at ${appData.submittedAt.toLocaleTimeString()}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Application Type:</td>
                  <td style="padding: 15px 0; color: #111827;">
                    ${appData.autoApplied 
                      ? '<span style="background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 14px;">Auto-Applied</span>'
                      : '<span style="background-color: #ecfccb; color: #365314; padding: 2px 8px; border-radius: 12px; font-size: 14px;">Manual</span>'
                    }
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Match Score:</td>
                  <td style="padding: 15px 0; color: #059669; font-weight: 600;">${appData.relevancyScore}%</td>
                </tr>
              </mj-table>
            </mj-column>
          </mj-section>

          <mj-section background-color="#f8fafc" padding="30px 20px">
            <mj-column>
              <mj-text font-size="18px" font-weight="600" color="#111827" padding-bottom="15px">
                📋 Application Details
              </mj-text>
              <mj-text font-size="14px" color="#374151">
                ✅ Cover Letter: ${appData.coverLetterUsed ? 'Included' : 'Not included'}<br/>
                ✅ Resume: ${appData.resumeTailored ? 'Tailored for this position' : 'Standard version'}<br/>
                ✅ Application ID: ${appData.applicationId}
              </mj-text>
            </mj-column>
          </mj-section>

          <mj-section background-color="#ffffff" padding="30px 20px">
            <mj-column>
              <mj-button background-color="#2563eb" color="#ffffff" href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/applications/${appData.applicationId}" target="_blank" padding-bottom="15px">
                Track Application
              </mj-button>
              <mj-button background-color="#059669" color="#ffffff" href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/dashboard" target="_blank">
                View Dashboard
              </mj-button>
            </mj-column>
          </mj-section>

          <mj-section background-color="#f9fafb" padding="30px 20px">
            <mj-column>
              <mj-text font-size="14px" color="#6b7280" align="center">
                🚀 Next Steps: We'll monitor your application progress and send follow-up reminders.
                <br />
                <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/automation" style="color: #2563eb;">Manage automation settings</a>
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    if (mjml2html) {
      try {
        const { html } = mjml2html(mjmlTemplate);
        return html;
      } catch (error) {
        console.warn('MJML compilation failed, using fallback HTML:', error);
      }
    }
    
    // Fallback HTML generation
    return this.generateFallbackApplicationSubmittedEmail(userName, appData);
  }

  /**
   * Generate follow-up reminder email using MJML
   */
  private generateFollowUpReminderEmail(userName: string, followUpData: FollowUpReminderData): string {
    const daysSinceApplication = Math.floor((new Date().getTime() - followUpData.appliedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-title>Follow-up Reminder</mj-title>
          <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
          <mj-attributes>
            <mj-all font-family="Inter, Arial, sans-serif" />
            <mj-text font-size="16px" color="#374151" line-height="1.6" />
            <mj-button font-size="16px" font-weight="600" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f9fafb">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="600" color="#111827" align="center">
                📬 Follow-up Reminder
              </mj-text>
              <mj-text font-size="18px" color="#6b7280" align="center" padding-bottom="30px">
                Hi ${userName}, it's time to follow up on your application
              </mj-text>
            </mj-column>
          </mj-section>

          <mj-section background-color="#ffffff" padding="0 20px">
            <mj-column>
              <mj-table>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151; width: 30%;">Position:</td>
                  <td style="padding: 15px 0; color: #111827; font-weight: 500;">${followUpData.jobTitle}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Company:</td>
                  <td style="padding: 15px 0; color: #111827; font-weight: 500;">${followUpData.company}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Applied:</td>
                  <td style="padding: 15px 0; color: #111827;">${followUpData.appliedDate.toLocaleDateString()} (${daysSinceApplication} days ago)</td>
                </tr>
                <tr>
                  <td style="padding: 15px 0; font-weight: 600; color: #374151;">Follow-up Type:</td>
                  <td style="padding: 15px 0; color: #111827; text-transform: capitalize;">
                    ${followUpData.followUpType.replace('_', ' ')} Follow-up
                  </td>
                </tr>
              </mj-table>
            </mj-column>
          </mj-section>

          ${followUpData.suggestedMessage ? `
          <mj-section background-color="#f8fafc" padding="30px 20px">
            <mj-column>
              <mj-text font-size="18px" font-weight="600" color="#111827" padding-bottom="15px">
                💡 Suggested Follow-up Message
              </mj-text>
              <mj-text font-size="14px" color="#374151" background-color="#ffffff" padding="20px" border-left="4px solid #2563eb">
                ${followUpData.suggestedMessage.replace(/\n/g, '<br/>')}
              </mj-text>
            </mj-column>
          </mj-section>` : ''}

          <mj-section background-color="#ffffff" padding="30px 20px">
            <mj-column>
              <mj-button background-color="#2563eb" color="#ffffff" href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/applications/${followUpData.applicationId}/follow-up" target="_blank" padding-bottom="15px">
                Send Follow-up
              </mj-button>
              <mj-button background-color="#059669" color="#ffffff" href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/applications/${followUpData.applicationId}" target="_blank">
                View Application
              </mj-button>
            </mj-column>
          </mj-section>

          <mj-section background-color="#fef3c7" padding="20px">
            <mj-column>
              <mj-text font-size="14px" color="#92400e" align="center">
                💡 <strong>Pro Tip:</strong> Following up shows enthusiasm and keeps you top-of-mind with hiring managers.
                Most candidates don't follow up, so this gives you a competitive advantage!
              </mj-text>
            </mj-column>
          </mj-section>

          <mj-section background-color="#f9fafb" padding="30px 20px">
            <mj-column>
              <mj-text font-size="14px" color="#6b7280" align="center">
                This reminder was automatically generated based on your application timeline.
                <br />
                <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/follow-up" style="color: #2563eb;">Manage follow-up settings</a>
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    if (mjml2html) {
      try {
        const { html } = mjml2html(mjmlTemplate);
        return html;
      } catch (error) {
        console.warn('MJML compilation failed, using fallback HTML:', error);
      }
    }
    
    // Fallback HTML generation
    return this.generateFallbackFollowUpReminderEmail(userName, followUpData);
  }

  /**
   * Generate daily summary email using MJML
   */
  private generateDailySummaryEmail(userName: string, summaryData: DailySummaryData): string {
    const mjmlTemplate = `
      <mjml>
        <mj-head>
          <mj-title>Daily Job Search Summary</mj-title>
          <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />
          <mj-attributes>
            <mj-all font-family="Inter, Arial, sans-serif" />
            <mj-text font-size="16px" color="#374151" line-height="1.6" />
            <mj-button font-size="16px" font-weight="600" />
          </mj-attributes>
        </mj-head>
        <mj-body background-color="#f9fafb">
          <mj-section background-color="#ffffff" padding="40px 20px">
            <mj-column>
              <mj-text font-size="24px" font-weight="600" color="#111827" align="center">
                📊 Daily Job Search Summary
              </mj-text>
              <mj-text font-size="18px" color="#6b7280" align="center" padding-bottom="30px">
                Hi ${userName}, here's your activity for ${summaryData.date.toLocaleDateString()}
              </mj-text>
            </mj-column>
          </mj-section>

          <mj-section background-color="#ffffff" padding="0 20px 30px 20px">
            <mj-column width="25%">
              <mj-text font-size="32px" font-weight="700" color="#2563eb" align="center" padding-bottom="5px">
                ${summaryData.jobsFound}
              </mj-text>
              <mj-text font-size="14px" color="#6b7280" align="center">
                Jobs Found
              </mj-text>
            </mj-column>
            <mj-column width="25%">
              <mj-text font-size="32px" font-weight="700" color="#059669" align="center" padding-bottom="5px">
                ${summaryData.applicationsSubmitted}
              </mj-text>
              <mj-text font-size="14px" color="#6b7280" align="center">
                Applications
              </mj-text>
            </mj-column>
            <mj-column width="25%">
              <mj-text font-size="32px" font-weight="700" color="#dc2626" align="center" padding-bottom="5px">
                ${summaryData.followUpsSent}
              </mj-text>
              <mj-text font-size="14px" color="#6b7280" align="center">
                Follow-ups
              </mj-text>
            </mj-column>
            <mj-column width="25%">
              <mj-text font-size="32px" font-weight="700" color="#7c3aed" align="center" padding-bottom="5px">
                ${summaryData.upcomingFollowUps}
              </mj-text>
              <mj-text font-size="14px" color="#6b7280" align="center">
                Upcoming
              </mj-text>
            </mj-column>
          </mj-section>

          ${summaryData.topJobs.length > 0 ? `
          <mj-section background-color="#f8fafc" padding="30px 20px">
            <mj-column>
              <mj-text font-size="18px" font-weight="600" color="#111827" padding-bottom="20px">
                🎯 Top Job Matches
              </mj-text>
              
              ${summaryData.topJobs.slice(0, 3).map(job => `
              <mj-table>
                <tr style="border-bottom: 1px solid #e5e7eb; margin-bottom: 15px;">
                  <td style="padding: 15px 0;">
                    <div style="font-weight: 600; color: #111827; margin-bottom: 5px;">${job.jobTitle}</div>
                    <div style="color: #6b7280; margin-bottom: 5px;">${job.company} • ${job.location}</div>
                    <div style="display: flex; align-items: center;">
                      <span style="background-color: #ecfccb; color: #365314; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 10px;">
                        ${job.relevancyScore}% match
                      </span>
                      <span style="background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                        ${job.portal}
                      </span>
                    </div>
                  </td>
                </tr>
              </mj-table>
              `).join('')}
            </mj-column>
          </mj-section>` : ''}

          <mj-section background-color="#ffffff" padding="30px 20px">
            <mj-column>
              <mj-button background-color="#2563eb" color="#ffffff" href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/dashboard" target="_blank" padding-bottom="15px">
                View Full Dashboard
              </mj-button>
              <mj-button background-color="#059669" color="#ffffff" href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/jobs" target="_blank">
                Browse All Jobs
              </mj-button>
            </mj-column>
          </mj-section>

          <mj-section background-color="#f9fafb" padding="30px 20px">
            <mj-column>
              <mj-text font-size="14px" color="#6b7280" align="center">
                Keep up the great work! Consistency is key to a successful job search.
                <br />
                <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/notifications" style="color: #2563eb;">Manage notification preferences</a>
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;

    if (mjml2html) {
      try {
        const { html } = mjml2html(mjmlTemplate);
        return html;
      } catch (error) {
        console.warn('MJML compilation failed, using fallback HTML:', error);
      }
    }
    
    // Fallback HTML generation
    return this.generateFallbackDailySummaryEmail(userName, summaryData);
  }

  /**
   * Fallback HTML generation methods
   */
  private generateFallbackJobDiscoveredEmail(userName: string, jobData: JobDiscoveredData): string {
    const salaryText = jobData.salary && jobData.salary.min && jobData.salary.max 
      ? `$${jobData.salary.min.toLocaleString()} - $${jobData.salary.max.toLocaleString()} ${jobData.salary.period}`
      : 'Competitive salary';

    const skillsHtml = jobData.matchedSkills.length > 0 
      ? `<div style="margin: 20px 0;">
           <h3 style="color: #111827; margin-bottom: 10px;">🎯 Matched Skills</h3>
           <div>${jobData.matchedSkills.map(skill => 
             `<span style="background-color: #ecfccb; color: #365314; padding: 4px 8px; border-radius: 12px; margin-right: 8px; margin-bottom: 4px; display: inline-block;">${skill}</span>`
           ).join('')}</div>
         </div>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Job Match Found</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 20px; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
          .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
          .content { padding: 20px; }
          .table { width: 100%; border-collapse: collapse; }
          .table td { padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
          .table td:first-child { font-weight: 600; color: #374151; width: 30%; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">🎯 New Job Match Found!</h1>
            <p style="font-size: 18px; color: #6b7280; margin: 10px 0 0;">Hi ${userName}, we found a job that matches your profile</p>
          </div>
          
          <div class="content">
            <table class="table">
              <tr><td>Position:</td><td style="color: #111827; font-weight: 500;">${jobData.jobTitle}</td></tr>
              <tr><td>Company:</td><td style="color: #111827; font-weight: 500;">${jobData.company}</td></tr>
              <tr><td>Location:</td><td style="color: #111827;">${jobData.location}</td></tr>
              ${jobData.salary ? `<tr><td>Salary:</td><td style="color: #111827;">${salaryText}</td></tr>` : ''}
              <tr><td>Match Score:</td><td style="color: #059669; font-weight: 600;">${jobData.relevancyScore}%</td></tr>
              <tr><td>Portal:</td><td style="color: #111827;">${jobData.portal}</td></tr>
            </table>
            
            ${skillsHtml}
            
            <div style="text-align: center; margin: 30px 0;">
              ${jobData.jobUrl ? `<a href="${jobData.jobUrl}" class="button">View Job Details</a>` : ''}
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/jobs/${jobData.jobId}" class="button" style="background-color: #059669;">Manage in PrepBettr</a>
            </div>
          </div>
          
          <div class="footer">
            This job was automatically discovered by PrepBettr based on your preferences.<br>
            <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/notifications" style="color: #2563eb;">Manage notification preferences</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateFallbackApplicationSubmittedEmail(userName: string, appData: ApplicationSubmittedData): string {
    const appType = appData.autoApplied ? 'Auto-Applied' : 'Manual';
    const appTypeColor = appData.autoApplied ? '#1e40af' : '#365314';
    const appTypeBg = appData.autoApplied ? '#dbeafe' : '#ecfccb';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Application Submitted Successfully</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 20px; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
          .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
          .content { padding: 20px; }
          .table { width: 100%; border-collapse: collapse; }
          .table td { padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
          .table td:first-child { font-weight: 600; color: #374151; width: 30%; }
          .details { background-color: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 6px; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">✅ Application Submitted!</h1>
            <p style="font-size: 18px; color: #6b7280; margin: 10px 0 0;">Hi ${userName}, your application has been successfully submitted</p>
          </div>
          
          <div class="content">
            <table class="table">
              <tr><td>Position:</td><td style="color: #111827; font-weight: 500;">${appData.jobTitle}</td></tr>
              <tr><td>Company:</td><td style="color: #111827; font-weight: 500;">${appData.company}</td></tr>
              <tr><td>Submitted:</td><td style="color: #111827;">${appData.submittedAt.toLocaleDateString()} at ${appData.submittedAt.toLocaleTimeString()}</td></tr>
              <tr><td>Application Type:</td><td><span style="background-color: ${appTypeBg}; color: ${appTypeColor}; padding: 2px 8px; border-radius: 12px; font-size: 14px;">${appType}</span></td></tr>
              <tr><td>Match Score:</td><td style="color: #059669; font-weight: 600;">${appData.relevancyScore}%</td></tr>
            </table>
            
            <div class="details">
              <h3 style="color: #111827; margin: 0 0 15px;">📋 Application Details</h3>
              <div>✅ Cover Letter: ${appData.coverLetterUsed ? 'Included' : 'Not included'}</div>
              <div>✅ Resume: ${appData.resumeTailored ? 'Tailored for this position' : 'Standard version'}</div>
              <div>✅ Application ID: ${appData.applicationId}</div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/applications/${appData.applicationId}" class="button">Track Application</a>
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/dashboard" class="button" style="background-color: #059669;">View Dashboard</a>
            </div>
          </div>
          
          <div class="footer">
            🚀 Next Steps: We'll monitor your application progress and send follow-up reminders.<br>
            <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/automation" style="color: #2563eb;">Manage automation settings</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateFallbackFollowUpReminderEmail(userName: string, followUpData: FollowUpReminderData): string {
    const daysSinceApplication = Math.floor((new Date().getTime() - followUpData.appliedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const suggestedMessageHtml = followUpData.suggestedMessage 
      ? `<div style="background-color: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 6px; border-left: 4px solid #2563eb;">
           <h3 style="color: #111827; margin: 0 0 15px;">💡 Suggested Follow-up Message</h3>
           <div style="background-color: #ffffff; padding: 15px; border-radius: 4px;">${followUpData.suggestedMessage.replace(/\n/g, '<br>')}</div>
         </div>`
      : '';

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
          .table { width: 100%; border-collapse: collapse; }
          .table td { padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
          .table td:first-child { font-weight: 600; color: #374151; width: 30%; }
          .tip { background-color: #fef3c7; padding: 15px; margin: 20px 0; border-radius: 6px; text-align: center; color: #92400e; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">📬 Follow-up Reminder</h1>
            <p style="font-size: 18px; color: #6b7280; margin: 10px 0 0;">Hi ${userName}, it's time to follow up on your application</p>
          </div>
          
          <div class="content">
            <table class="table">
              <tr><td>Position:</td><td style="color: #111827; font-weight: 500;">${followUpData.jobTitle}</td></tr>
              <tr><td>Company:</td><td style="color: #111827; font-weight: 500;">${followUpData.company}</td></tr>
              <tr><td>Applied:</td><td style="color: #111827;">${followUpData.appliedDate.toLocaleDateString()} (${daysSinceApplication} days ago)</td></tr>
              <tr><td>Follow-up Type:</td><td style="color: #111827; text-transform: capitalize;">${followUpData.followUpType.replace('_', ' ')} Follow-up</td></tr>
            </table>
            
            ${suggestedMessageHtml}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/applications/${followUpData.applicationId}/follow-up" class="button">Send Follow-up</a>
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/applications/${followUpData.applicationId}" class="button" style="background-color: #059669;">View Application</a>
            </div>
            
            <div class="tip">
              💡 <strong>Pro Tip:</strong> Following up shows enthusiasm and keeps you top-of-mind with hiring managers.
              Most candidates don't follow up, so this gives you a competitive advantage!
            </div>
          </div>
          
          <div class="footer">
            This reminder was automatically generated based on your application timeline.<br>
            <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/follow-up" style="color: #2563eb;">Manage follow-up settings</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateFallbackDailySummaryEmail(userName: string, summaryData: DailySummaryData): string {
    const topJobsHtml = summaryData.topJobs.length > 0 
      ? `<div style="background-color: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 6px;">
           <h3 style="color: #111827; margin: 0 0 20px;">🎯 Top Job Matches</h3>
           ${summaryData.topJobs.slice(0, 3).map(job => `
             <div style="border-bottom: 1px solid #e5e7eb; padding: 15px 0; margin-bottom: 15px;">
               <div style="font-weight: 600; color: #111827; margin-bottom: 5px;">${job.jobTitle}</div>
               <div style="color: #6b7280; margin-bottom: 5px;">${job.company} • ${job.location}</div>
               <div>
                 <span style="background-color: #ecfccb; color: #365314; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 10px;">${job.relevancyScore}% match</span>
                 <span style="background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${job.portal}</span>
               </div>
             </div>
           `).join('')}
         </div>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Daily Job Search Summary</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 20px; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
          .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
          .content { padding: 20px; }
          .stats { display: flex; justify-content: space-around; margin: 30px 0; }
          .stat { text-align: center; flex: 1; }
          .stat-number { font-size: 32px; font-weight: 700; margin-bottom: 5px; }
          .stat-label { font-size: 14px; color: #6b7280; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
          .footer { background-color: #f9fafb; padding: 30px 20px; text-align: center; font-size: 14px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">📊 Daily Job Search Summary</h1>
            <p style="font-size: 18px; color: #6b7280; margin: 10px 0 0;">Hi ${userName}, here's your activity for ${summaryData.date.toLocaleDateString()}</p>
          </div>
          
          <div class="content">
            <div class="stats">
              <div class="stat">
                <div class="stat-number" style="color: #2563eb;">${summaryData.jobsFound}</div>
                <div class="stat-label">Jobs Found</div>
              </div>
              <div class="stat">
                <div class="stat-number" style="color: #059669;">${summaryData.applicationsSubmitted}</div>
                <div class="stat-label">Applications</div>
              </div>
              <div class="stat">
                <div class="stat-number" style="color: #dc2626;">${summaryData.followUpsSent}</div>
                <div class="stat-label">Follow-ups</div>
              </div>
              <div class="stat">
                <div class="stat-number" style="color: #7c3aed;">${summaryData.upcomingFollowUps}</div>
                <div class="stat-label">Upcoming</div>
              </div>
            </div>
            
            ${topJobsHtml}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/dashboard" class="button">View Full Dashboard</a>
              <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/jobs" class="button" style="background-color: #059669;">Browse All Jobs</a>
            </div>
          </div>
          
          <div class="footer">
            Keep up the great work! Consistency is key to a successful job search.<br>
            <a href="${process.env.NEXTAUTH_URL || 'https://prepbettr.com'}/settings/notifications" style="color: #2563eb;">Manage notification preferences</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get notification events for a user
   */
  async getNotificationHistory(
    userId: string,
    options?: {
      limit?: number;
      type?: NotificationType;
      status?: NotificationEvent['status'];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<NotificationEvent[]> {
    try {
      const limit = options?.limit || 50;
      const events = await azureCosmosService.getUserNotificationEvents(userId, limit);
      
      // Apply additional filters
      let filteredEvents = events;
      
      if (options?.type) {
        filteredEvents = filteredEvents.filter(event => event.type === options.type);
      }
      
      if (options?.status) {
        filteredEvents = filteredEvents.filter(event => event.status === options.status);
      }
      
      if (options?.startDate) {
        filteredEvents = filteredEvents.filter(event => event.createdAt >= options.startDate!);
      }
      
      if (options?.endDate) {
        filteredEvents = filteredEvents.filter(event => event.createdAt <= options.endDate!);
      }
      
      return filteredEvents.map(event => ({
        id: event.id,
        userId: event.userId,
        type: event.type as NotificationType,
        channel: event.channel as NotificationChannel,
        recipient: event.recipient,
        subject: event.subject,
        content: event.content,
        templateUsed: event.templateUsed,
        metadata: event.metadata,
        status: event.status as NotificationEvent['status'],
        createdAt: event.createdAt,
        sentAt: event.sentAt,
        updatedAt: event.updatedAt,
        error: event.error,
        messageId: event.messageId,
        jobId: event.jobId,
        applicationId: event.applicationId
      }));

    } catch (error) {
      console.error('Error getting notification history:', error);
      return [];
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string, days: number = 30): Promise<{
    total: number;
    sent: number;
    failed: number;
    byType: Record<NotificationType, number>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get recent notifications using Azure Cosmos DB query
      const events = await azureCosmosService.queryDocuments<any>(
        'notificationEvents',
        'SELECT * FROM c WHERE c.userId = @userId AND c.createdAt >= @startDate',
        [
          { name: '@userId', value: userId },
          { name: '@startDate', value: startDate }
        ]
      );

      const stats = {
        total: 0,
        sent: 0,
        failed: 0,
        byType: {} as Record<NotificationType, number>
      };

      events.forEach((event: any) => {
        stats.total++;

        if (event.status === 'sent' || event.status === 'delivered') {
          stats.sent++;
        } else if (event.status === 'failed') {
          stats.failed++;
        }

        const eventType = event.type as NotificationType;
        stats.byType[eventType] = (stats.byType[eventType] || 0) + 1;
      });

      return stats;

    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        total: 0,
        sent: 0,
        failed: 0,
        byType: {} as Record<NotificationType, number>
      };
    }
  }

  /**
   * Clean up old notification events
   */
  async cleanupOldEvents(daysToKeep: number = 90): Promise<{ deleted: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Get old events using Azure Cosmos DB query
      const oldEvents = await azureCosmosService.queryDocuments<any>(
        'notificationEvents',
        'SELECT c.id, c.userId FROM c WHERE c.createdAt < @cutoffDate',
        [{ name: '@cutoffDate', value: cutoffDate }]
      );

      if (oldEvents.length === 0) {
        return { deleted: 0 };
      }

      // Process in smaller batches to avoid limits
      const batchSize = 25;
      let totalDeleted = 0;
      
      for (let i = 0; i < oldEvents.length; i += batchSize) {
        const batch = oldEvents.slice(i, i + batchSize);
        const deletePromises = batch.map(event => 
          azureCosmosService.deleteDocument('notificationEvents', event.id, event.userId)
        );
        
        await Promise.all(deletePromises);
        totalDeleted += batch.length;
      }

      console.log(`Cleaned up ${totalDeleted} old notification events`);

      return { deleted: totalDeleted };

    } catch (error) {
      console.error('Error cleaning up old notification events:', error);
      return { deleted: 0 };
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
