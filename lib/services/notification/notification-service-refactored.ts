/**
 * Refactored Notification Service
 * 
 * This is a cleaner, more maintainable version of the original notification-service.ts.
 * The large monolithic service has been broken down into focused modules:
 * 
 * - Core types (types.ts)
 * - MJML template engine (templates/mjml-template-engine.ts)
 * - Email service channel (channels/email-service.ts)
 * - Notification queue (queue/notification-queue.ts)
 * 
 * This main service now orchestrates these components following SRP principles.
 */

import { 
  NotificationEvent, 
  NotificationType, 
  NotificationChannel,
  NotificationStatus,
  JobDiscoveredData, 
  ApplicationSubmittedData,
  FollowUpReminderData,
  DailySummaryData,
  NotificationResult,
  EmailTemplateType,
  NotificationHistoryOptions,
  NotificationStats,
  NotificationCleanupResult
} from './core/types';
import { emailService } from './channels/email-service';
import { notificationQueue } from './queue/notification-queue';

export class NotificationService {
  private notifications: Map<string, NotificationEvent> = new Map();
  
  constructor() {
    console.log('[NotificationService] Initialized with modular architecture');
  }

  /**
   * Send a job discovered notification
   */
  async sendJobDiscoveredNotification(
    userId: string,
    email: string,
    userName: string,
    jobData: JobDiscoveredData
  ): Promise<NotificationResult> {
    const notification: NotificationEvent = {
      id: this.generateId(),
      userId,
      type: 'job_discovered',
      channel: 'email',
      recipient: email,
      subject: `🎯 New Job Match: ${jobData.jobTitle} at ${jobData.company}`,
      content: '',
      status: 'pending',
      createdAt: new Date(),
      jobId: jobData.jobId,
      metadata: {
        userName,
        ...jobData
      }
    };

    return this.queueNotification(notification);
  }

  /**
   * Send an application submitted notification
   */
  async sendApplicationSubmittedNotification(
    userId: string,
    email: string,
    userName: string,
    appData: ApplicationSubmittedData
  ): Promise<NotificationResult> {
    const notification: NotificationEvent = {
      id: this.generateId(),
      userId,
      type: 'application_submitted',
      channel: 'email',
      recipient: email,
      subject: `✅ Application Submitted: ${appData.jobTitle} at ${appData.company}`,
      content: '',
      status: 'pending',
      createdAt: new Date(),
      applicationId: appData.applicationId,
      jobId: appData.jobId,
      metadata: {
        userName,
        ...appData
      }
    };

    return this.queueNotification(notification);
  }

  /**
   * Send a follow-up reminder notification
   */
  async sendFollowUpReminderNotification(
    userId: string,
    email: string,
    userName: string,
    reminderData: FollowUpReminderData
  ): Promise<NotificationResult> {
    const notification: NotificationEvent = {
      id: this.generateId(),
      userId,
      type: 'follow_up_reminder',
      channel: 'email',
      recipient: email,
      subject: `⏰ Follow-up Reminder: ${reminderData.jobTitle} at ${reminderData.company}`,
      content: '',
      status: 'pending',
      createdAt: new Date(),
      applicationId: reminderData.applicationId,
      metadata: {
        userName,
        ...reminderData
      }
    };

    return this.queueNotification(notification);
  }

  /**
   * Send a daily summary notification
   */
  async sendDailySummaryNotification(
    userId: string,
    email: string,
    userName: string,
    summaryData: DailySummaryData
  ): Promise<NotificationResult> {
    const notification: NotificationEvent = {
      id: this.generateId(),
      userId,
      type: 'daily_summary',
      channel: 'email',
      recipient: email,
      subject: `📊 Daily Job Search Summary - ${summaryData.date.toLocaleDateString()}`,
      content: '',
      status: 'pending',
      createdAt: new Date(),
      metadata: {
        userName,
        ...summaryData
      }
    };

    return this.queueNotification(notification);
  }

  /**
   * Send a generic notification
   */
  async sendNotification(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
    recipient: string,
    subject: string,
    content: string,
    metadata?: Record<string, any>
  ): Promise<NotificationResult> {
    const notification: NotificationEvent = {
      id: this.generateId(),
      userId,
      type,
      channel,
      recipient,
      subject,
      content,
      status: 'pending',
      createdAt: new Date(),
      metadata
    };

    return this.queueNotification(notification);
  }

  /**
   * Send immediate notification (bypass queue)
   */
  async sendImmediateNotification(
    notification: NotificationEvent
  ): Promise<NotificationResult> {
    this.storeNotification(notification);

    try {
      let result: NotificationResult;

      switch (notification.channel) {
        case 'email':
          result = await emailService.sendNotificationEmail(notification);
          break;
        case 'sms':
          result = { success: false, error: 'SMS not implemented yet' };
          break;
        case 'push':
          result = { success: false, error: 'Push notifications not implemented yet' };
          break;
        case 'in_app':
          result = { success: false, error: 'In-app notifications not implemented yet' };
          break;
        default:
          result = { success: false, error: `Unsupported channel: ${notification.channel}` };
      }

      // Update notification status
      const updatedNotification = { 
        ...notification, 
        status: result.success ? 'sent' : 'failed' as NotificationStatus,
        sentAt: result.success ? new Date() : undefined,
        messageId: result.messageId,
        error: result.error,
        updatedAt: new Date()
      };

      this.storeNotification(updatedNotification);
      return result;

    } catch (error: any) {
      const failedNotification = { 
        ...notification, 
        status: 'failed' as NotificationStatus,
        error: error.message,
        updatedAt: new Date()
      };

      this.storeNotification(failedNotification);
      
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Queue a notification for processing
   */
  private async queueNotification(notification: NotificationEvent): Promise<NotificationResult> {
    this.storeNotification(notification);

    try {
      await notificationQueue.add(notification);
      console.log(`[NotificationService] Queued ${notification.type} notification for ${notification.recipient}`);
      
      return {
        success: true,
        messageId: notification.id
      };
    } catch (error: any) {
      console.error('[NotificationService] Error queuing notification:', error);
      return {
        success: false,
        error: error.message || 'Failed to queue notification'
      };
    }
  }

  /**
   * Store notification in memory (replace with database in production)
   */
  private storeNotification(notification: NotificationEvent): void {
    this.notifications.set(notification.id!, notification);
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(
    userId: string,
    options: NotificationHistoryOptions = {}
  ): Promise<NotificationEvent[]> {
    const { limit = 50, type, status, startDate, endDate } = options;

    let notifications = Array.from(this.notifications.values())
      .filter(n => n.userId === userId);

    // Apply filters
    if (type) {
      notifications = notifications.filter(n => n.type === type);
    }

    if (status) {
      notifications = notifications.filter(n => n.status === status);
    }

    if (startDate) {
      notifications = notifications.filter(n => n.createdAt >= startDate);
    }

    if (endDate) {
      notifications = notifications.filter(n => n.createdAt <= endDate);
    }

    // Sort by creation date (newest first) and limit
    return notifications
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    const userNotifications = Array.from(this.notifications.values())
      .filter(n => n.userId === userId);

    const total = userNotifications.length;
    const sent = userNotifications.filter(n => n.status === 'sent').length;
    const failed = userNotifications.filter(n => n.status === 'failed').length;

    // Group by type
    const byType = userNotifications.reduce((acc, notification) => {
      acc[notification.type] = (acc[notification.type] || 0) + 1;
      return acc;
    }, {} as Record<NotificationType, number>);

    return {
      total,
      sent,
      failed,
      byType
    };
  }

  /**
   * Retry a failed notification
   */
  async retryNotification(notificationId: string): Promise<NotificationResult> {
    const notification = this.notifications.get(notificationId);
    
    if (!notification) {
      return {
        success: false,
        error: 'Notification not found'
      };
    }

    if (notification.status !== 'failed') {
      return {
        success: false,
        error: 'Only failed notifications can be retried'
      };
    }

    // Try queue first
    const queueRetryResult = await notificationQueue.retry(notificationId);
    
    if (queueRetryResult) {
      return {
        success: true,
        messageId: notificationId
      };
    }

    // If not in queue, send immediately
    const resetNotification = {
      ...notification,
      status: 'pending' as NotificationStatus,
      error: undefined,
      updatedAt: new Date()
    };

    return this.sendImmediateNotification(resetNotification);
  }

  /**
   * Cancel a pending notification
   */
  async cancelNotification(notificationId: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId);
    
    if (!notification) {
      return false;
    }

    if (notification.status !== 'pending') {
      return false; // Can't cancel already sent notifications
    }

    // Try to cancel from queue
    const cancelled = await notificationQueue.cancel(notificationId);
    
    if (cancelled || notification.status === 'pending') {
      // Update status to cancelled
      const cancelledNotification = {
        ...notification,
        status: 'failed' as NotificationStatus, // Using 'failed' as we don't have 'cancelled' status
        error: 'Cancelled by user',
        updatedAt: new Date()
      };

      this.storeNotification(cancelledNotification);
      return true;
    }

    return false;
  }

  /**
   * Clean up old notifications
   */
  async cleanupNotifications(olderThanDays: number = 30): Promise<NotificationCleanupResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deleted = 0;
    
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.createdAt < cutoffDate && notification.status !== 'pending') {
        this.notifications.delete(id);
        deleted++;
      }
    }

    // Also cleanup queue
    const queueDeleted = notificationQueue.cleanup(olderThanDays);

    console.log(`[NotificationService] Cleaned up ${deleted + queueDeleted} old notifications`);

    return { deleted: deleted + queueDeleted };
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      email: { status: string; provider: string; available_providers: string[] };
      queue: { status: string; size: number; stats: any };
    };
    last_check: Date;
  }> {
    const emailHealthy = await emailService.verifyConnection();
    const queueStats = notificationQueue.getStats();
    
    const status = emailHealthy && queueStats.failed < 10 ? 'healthy' : 
                  emailHealthy || queueStats.failed < 50 ? 'degraded' : 'unhealthy';

    return {
      status,
      services: {
        email: {
          status: emailHealthy ? 'healthy' : 'unhealthy',
          provider: emailService.getProviderName(),
          available_providers: emailService.getAvailableProviders()
        },
        queue: {
          status: queueStats.failed < 10 ? 'healthy' : 'degraded',
          size: notificationQueue.size(),
          stats: queueStats
        }
      },
      last_check: new Date()
    };
  }

  /**
   * Generate unique notification ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get total notifications count
   */
  getTotalNotifications(): number {
    return this.notifications.size;
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return notificationQueue.getStats();
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Also export the class for testing purposes
export { NotificationService as NotificationServiceClass };