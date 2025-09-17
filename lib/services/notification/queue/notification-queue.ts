/**
 * Notification Queue Service
 * 
 * Extracted from notification-service.ts
 * Handles queuing, processing, and retry logic for notifications.
 * Reduces load on the main service and provides better error handling.
 */

import { NotificationEvent, NotificationStatus, NotificationResult } from '../core/types';
import { emailService } from '../channels/email-service';

interface QueueItem {
  id: string;
  notification: NotificationEvent;
  attempts: number;
  maxRetries: number;
  nextRetry?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
}

export class NotificationQueue {
  private queue: Map<string, QueueItem> = new Map();
  private processing: Set<string> = new Set();
  private isProcessing = false;
  private maxRetries = 3;
  private retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s
  private processInterval: NodeJS.Timeout | null = null;

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
    this.startProcessing();
  }

  /**
   * Add notification to the queue
   */
  async add(notification: NotificationEvent, maxRetries?: number): Promise<void> {
    const queueItem: QueueItem = {
      id: notification.id || this.generateId(),
      notification: {
        ...notification,
        id: notification.id || this.generateId(),
        status: 'pending',
        createdAt: notification.createdAt || new Date(),
      },
      attempts: 0,
      maxRetries: maxRetries || this.maxRetries,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.queue.set(queueItem.id, queueItem);
    console.log(`[NotificationQueue] Added notification ${queueItem.id} to queue`);
  }

  /**
   * Process pending notifications
   */
  async process(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingItems = Array.from(this.queue.values())
        .filter(item => 
          !this.processing.has(item.id) && 
          item.attempts < item.maxRetries &&
          (!item.nextRetry || item.nextRetry <= new Date())
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const batchSize = 5; // Process 5 notifications at a time
      const batch = pendingItems.slice(0, batchSize);

      await Promise.allSettled(
        batch.map(item => this.processItem(item))
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    if (this.processing.has(item.id)) {
      return;
    }

    this.processing.add(item.id);

    try {
      console.log(`[NotificationQueue] Processing notification ${item.id}, attempt ${item.attempts + 1}`);

      item.attempts++;
      item.updatedAt = new Date();
      item.notification.status = 'pending';

      let result: NotificationResult;

      // Route to appropriate channel
      switch (item.notification.channel) {
        case 'email':
          result = await emailService.sendNotificationEmail(item.notification);
          break;
        case 'sms':
          result = await this.sendSMS(item.notification);
          break;
        case 'push':
          result = await this.sendPushNotification(item.notification);
          break;
        default:
          result = {
            success: false,
            error: `Unsupported channel: ${item.notification.channel}`,
          };
      }

      // Update notification status based on result
      if (result.success) {
        item.notification.status = 'sent';
        item.notification.sentAt = new Date();
        item.notification.messageId = result.messageId;
        item.error = undefined;
        
        console.log(`[NotificationQueue] Successfully sent notification ${item.id} via ${item.notification.channel}`);
        
        // Remove from queue on success
        this.queue.delete(item.id);
      } else {
        item.error = result.error;
        
        if (item.attempts >= item.maxRetries) {
          item.notification.status = 'failed';
          console.error(`[NotificationQueue] Failed to send notification ${item.id} after ${item.attempts} attempts: ${result.error}`);
        } else {
          // Schedule retry
          const delay = this.retryDelays[Math.min(item.attempts - 1, this.retryDelays.length - 1)];
          item.nextRetry = new Date(Date.now() + delay);
          console.warn(`[NotificationQueue] Retrying notification ${item.id} in ${delay}ms (attempt ${item.attempts}/${item.maxRetries})`);
        }
      }

      // Update the queue item
      this.queue.set(item.id, item);

    } catch (error: any) {
      console.error(`[NotificationQueue] Error processing notification ${item.id}:`, error);
      
      item.error = error.message || 'Unknown processing error';
      item.updatedAt = new Date();
      
      if (item.attempts >= item.maxRetries) {
        item.notification.status = 'failed';
      } else {
        const delay = this.retryDelays[Math.min(item.attempts - 1, this.retryDelays.length - 1)];
        item.nextRetry = new Date(Date.now() + delay);
      }
      
      this.queue.set(item.id, item);
    } finally {
      this.processing.delete(item.id);
    }
  }

  /**
   * Send SMS notification (placeholder)
   */
  private async sendSMS(notification: NotificationEvent): Promise<NotificationResult> {
    // TODO: Implement SMS provider (Twilio, AWS SNS, etc.)
    console.log(`[NotificationQueue] SMS sending not implemented yet for ${notification.id}`);
    return {
      success: false,
      error: 'SMS provider not implemented',
    };
  }

  /**
   * Send push notification (placeholder)
   */
  private async sendPushNotification(notification: NotificationEvent): Promise<NotificationResult> {
    // TODO: Implement push provider (Firebase, OneSignal, etc.)
    console.log(`[NotificationQueue] Push notification sending not implemented yet for ${notification.id}`);
    return {
      success: false,
      error: 'Push notification provider not implemented',
    };
  }

  /**
   * Retry a specific notification
   */
  async retry(notificationId: string, maxRetries?: number): Promise<boolean> {
    const item = this.queue.get(notificationId);
    if (!item) {
      return false;
    }

    // Reset retry parameters
    item.attempts = 0;
    item.nextRetry = undefined;
    item.error = undefined;
    item.updatedAt = new Date();
    
    if (maxRetries !== undefined) {
      item.maxRetries = maxRetries;
    }

    this.queue.set(notificationId, item);
    console.log(`[NotificationQueue] Reset retry for notification ${notificationId}`);
    
    return true;
  }

  /**
   * Cancel a pending notification
   */
  async cancel(notificationId: string): Promise<boolean> {
    const deleted = this.queue.delete(notificationId);
    if (deleted) {
      console.log(`[NotificationQueue] Cancelled notification ${notificationId}`);
    }
    return deleted;
  }

  /**
   * Get notification status
   */
  async getStatus(notificationId: string): Promise<NotificationStatus | null> {
    const item = this.queue.get(notificationId);
    return item ? item.notification.status : null;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const items = Array.from(this.queue.values());
    
    return {
      pending: items.filter(item => 
        item.attempts < item.maxRetries && 
        (!item.nextRetry || item.nextRetry <= new Date())
      ).length,
      processing: this.processing.size,
      completed: 0, // Completed items are removed from queue
      failed: items.filter(item => 
        item.attempts >= item.maxRetries && 
        item.notification.status === 'failed'
      ).length,
      retrying: items.filter(item => 
        item.attempts < item.maxRetries && 
        item.nextRetry && 
        item.nextRetry > new Date()
      ).length,
    };
  }

  /**
   * Get failed notifications
   */
  getFailedNotifications(): NotificationEvent[] {
    return Array.from(this.queue.values())
      .filter(item => item.notification.status === 'failed')
      .map(item => item.notification);
  }

  /**
   * Clean up old completed/failed notifications
   */
  cleanup(olderThanDays: number = 7): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;
    
    for (const [id, item] of this.queue.entries()) {
      const shouldDelete = (
        item.notification.status === 'failed' ||
        (item.attempts >= item.maxRetries && item.updatedAt < cutoffDate)
      );

      if (shouldDelete) {
        this.queue.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[NotificationQueue] Cleaned up ${deletedCount} old notifications`);
    }

    return deletedCount;
  }

  /**
   * Start automatic processing
   */
  private startProcessing(): void {
    if (this.processInterval) {
      return;
    }

    // Process queue every 5 seconds
    this.processInterval = setInterval(async () => {
      try {
        await this.process();
        
        // Cleanup old notifications once per hour
        if (Date.now() % (60 * 60 * 1000) < 5000) {
          this.cleanup();
        }
      } catch (error) {
        console.error('[NotificationQueue] Error in automatic processing:', error);
      }
    }, 5000);

    console.log('[NotificationQueue] Started automatic processing');
  }

  /**
   * Stop automatic processing
   */
  stopProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      console.log('[NotificationQueue] Stopped automatic processing');
    }
  }

  /**
   * Generate unique ID for notifications
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.size;
  }

  /**
   * Clear all notifications (use with caution)
   */
  clear(): void {
    const count = this.queue.size;
    this.queue.clear();
    this.processing.clear();
    console.log(`[NotificationQueue] Cleared ${count} notifications from queue`);
  }
}

// Singleton instance
export const notificationQueue = new NotificationQueue();