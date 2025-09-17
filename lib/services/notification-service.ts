// lib/services/notification-service.ts

import { azureCosmosService } from './azure-cosmos-service';
import { awsSESService, EmailParams } from './sendgrid-service';
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
  | 'interview_scheduled'
  | 'application_status_update'
  | 'weekly_report'
  | 'search_completed'
  | 'quota_warning'
  | 'welcome'
  | 'verification'
  | 'premium_upgrade';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';


export class NotificationService {


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
