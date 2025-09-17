/**
 * MJML Template Engine
 * 
 * Extracted from notification-service.ts
 * Handles MJML email template compilation and rendering.
 * Reduces the main service from 1,247 lines to manageable chunks.
 */

import { 
  EmailTemplateType, 
  EmailTemplateData, 
  JobDiscoveredData, 
  ApplicationSubmittedData, 
  FollowUpReminderData, 
  DailySummaryData 
} from '../core/types';

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

export class MjmlTemplateEngine {
  private templateCache = new Map<EmailTemplateType, CompiledTemplate>();
  
  /**
   * Generate job discovered email using MJML
   */
  generateJobDiscoveredEmail(userName: string, jobData: JobDiscoveredData): string {
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

    return this.compileMjmlTemplate(mjmlTemplate, 'job_discovered') ||
           this.generateFallbackJobDiscoveredEmail(userName, jobData);
  }

  /**
   * Generate application submitted email using MJML
   */
  generateApplicationSubmittedEmail(userName: string, appData: ApplicationSubmittedData): string {
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

    return this.compileMjmlTemplate(mjmlTemplate, 'application_submitted') ||
           this.generateFallbackApplicationSubmittedEmail(userName, appData);
  }

  /**
   * Compile MJML template to HTML
   */
  private compileMjmlTemplate(mjmlTemplate: string, templateType: EmailTemplateType): string | null {
    if (mjml2html) {
      try {
        const { html } = mjml2html(mjmlTemplate);
        return html;
      } catch (error) {
        console.warn(`MJML compilation failed for ${templateType}, using fallback HTML:`, error);
      }
    }
    return null;
  }

  /**
   * Fallback HTML generation for job discovered email
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

  /**
   * Fallback HTML generation for application submitted email
   */
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
}

interface CompiledTemplate {
  html: string;
  compiledAt: Date;
}

export const mjmlTemplateEngine = new MjmlTemplateEngine();