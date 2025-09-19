// lib/subscription-notifications.js

import { EventEmitter } from 'events';
import subscriptionManager from '@/lib/subscription-manager';
import subscriptionMonitor from '@/lib/subscription-monitoring';

/**
 * Subscription Notifications and Grace Period Management
 * Handles payment retry logic, renewal reminders, grace periods, and dunning management
 */

class SubscriptionNotificationManager extends EventEmitter {
  constructor() {
    super();
    this.retrySchedule = new Map(); // Payment retry queue
    this.notificationQueue = new Map(); // Notification queue
    this.gracePeriodsActive = new Map(); // Active grace periods
    this.dunningSequences = new Map(); // Active dunning sequences
    
    // Configuration
    this.config = {
      // Payment retry configuration
      maxRetryAttempts: 3,
      retryIntervals: [1, 3, 7], // Days between retries
      gracePeriodDays: 7,
      
      // Notification timing (days before event)
      renewalReminderDays: [7, 3, 1],
      trialEndingReminderDays: [3, 1],
      
      // Dunning configuration
      dunningSequence: [
        { day: 1, type: 'payment_failed', severity: 'medium' },
        { day: 3, type: 'payment_retry', severity: 'medium' },
        { day: 7, type: 'final_notice', severity: 'high' },
        { day: 14, type: 'suspension_notice', severity: 'critical' }
      ]
    };
    
    this.initializeNotificationSystem();
  }

  initializeNotificationSystem() {
    // Listen to subscription events
    subscriptionManager.on('subscription.created', this.onSubscriptionCreated.bind(this));
    subscriptionManager.on('subscription.activated', this.onSubscriptionActivated.bind(this));
    subscriptionManager.on('subscription.payment_failed', this.onPaymentFailed.bind(this));
    subscriptionManager.on('subscription.cancelled', this.onSubscriptionCancelled.bind(this));
    
    // Schedule periodic tasks
    this.schedulePeriodicTasks();
    
    console.log('Subscription notification system initialized');
  }

  /**
   * Handle payment failure with retry logic
   */
  async handlePaymentFailure(failureData) {
    try {
      const {
        subscriptionId,
        paymentId,
        failureReason,
        amount,
        planId
      } = failureData;

      console.log(`Processing payment failure for subscription ${subscriptionId}`);

      // Check if we already have retry attempts for this subscription
      let retryInfo = this.retrySchedule.get(subscriptionId) || {
        subscriptionId,
        attempts: 0,
        lastAttempt: null,
        nextRetryDate: null,
        originalFailureDate: new Date(),
        failureReason,
        amount,
        planId
      };

      if (retryInfo.attempts >= this.config.maxRetryAttempts) {
        console.log(`Max retry attempts reached for subscription ${subscriptionId}`);
        await this.handleMaxRetriesReached(retryInfo);
        return;
      }

      // Schedule next retry
      const nextRetryDays = this.config.retryIntervals[retryInfo.attempts];
      const nextRetryDate = new Date();
      nextRetryDate.setDate(nextRetryDate.getDate() + nextRetryDays);

      retryInfo.attempts++;
      retryInfo.nextRetryDate = nextRetryDate;
      retryInfo.lastAttempt = new Date();

      this.retrySchedule.set(subscriptionId, retryInfo);

      // Start grace period
      await this.startGracePeriod(subscriptionId, retryInfo);

      // Send payment failure notification
      await this.sendPaymentFailureNotification(retryInfo);

      // Start dunning sequence
      await this.startDunningSequence(subscriptionId, retryInfo);

      // Emit retry scheduled event
      this.emit('payment.retry_scheduled', {
        subscriptionId,
        attempt: retryInfo.attempts,
        nextRetryDate,
        gracePeriodEnd: this.calculateGracePeriodEnd(retryInfo.originalFailureDate)
      });

    } catch (error) {
      console.error('Error handling payment failure:', error);
      throw error;
    }
  }

  /**
   * Start grace period for failed payment
   */
  async startGracePeriod(subscriptionId, retryInfo) {
    try {
      const gracePeriodEnd = this.calculateGracePeriodEnd(retryInfo.originalFailureDate);
      
      const graceData = {
        subscriptionId,
        startDate: retryInfo.originalFailureDate,
        endDate: gracePeriodEnd,
        reason: 'payment_failure',
        retryAttempts: retryInfo.attempts,
        status: 'active'
      };

      this.gracePeriodsActive.set(subscriptionId, graceData);

      // Update subscription status to indicate grace period
      await subscriptionManager.updateSubscriptionStatus(subscriptionId, 'past_due', {
        gracePeriodEnd,
        gracePeriodActive: true
      });

      console.log(`Grace period started for subscription ${subscriptionId} until ${gracePeriodEnd.toISOString()}`);

    } catch (error) {
      console.error('Error starting grace period:', error);
      throw error;
    }
  }

  /**
   * Start dunning management sequence
   */
  async startDunningSequence(subscriptionId, retryInfo) {
    try {
      const dunningData = {
        subscriptionId,
        startDate: new Date(),
        currentStep: 0,
        sequence: this.config.dunningSequence,
        retryInfo,
        status: 'active'
      };

      this.dunningSequences.set(subscriptionId, dunningData);

      // Schedule first dunning notification
      await this.scheduleDunningNotification(subscriptionId, 0);

      console.log(`Dunning sequence started for subscription ${subscriptionId}`);

    } catch (error) {
      console.error('Error starting dunning sequence:', error);
      throw error;
    }
  }

  /**
   * Send subscription renewal reminders
   */
  async sendRenewalReminders() {
    try {
      const activeSubscriptions = await subscriptionManager.getActiveSubscriptions();
      
      for (const subscription of activeSubscriptions) {
        if (subscription.status === 'active' && subscription.currentPeriodEnd) {
          const daysUntilRenewal = this.calculateDaysUntil(subscription.currentPeriodEnd);
          
          // Check if we should send a reminder
          if (this.config.renewalReminderDays.includes(daysUntilRenewal)) {
            await this.sendRenewalReminderNotification(subscription, daysUntilRenewal);
          }
        }
      }

    } catch (error) {
      console.error('Error sending renewal reminders:', error);
    }
  }

  /**
   * Send trial ending reminders
   */
  async sendTrialEndingReminders() {
    try {
      const trialingSubscriptions = await subscriptionManager.getSubscriptionsByStatus('trialing');
      
      for (const subscription of trialingSubscriptions) {
        if (subscription.trialEnd) {
          const daysUntilTrialEnd = this.calculateDaysUntil(subscription.trialEnd);
          
          // Check if we should send a reminder
          if (this.config.trialEndingReminderDays.includes(daysUntilTrialEnd)) {
            await this.sendTrialEndingNotification(subscription, daysUntilTrialEnd);
          }
        }
      }

    } catch (error) {
      console.error('Error sending trial ending reminders:', error);
    }
  }

  /**
   * Process pending payment retries
   */
  async processPaymentRetries() {
    try {
      const now = new Date();
      
      for (const [subscriptionId, retryInfo] of this.retrySchedule.entries()) {
        if (retryInfo.nextRetryDate && now >= retryInfo.nextRetryDate) {
          await this.attemptPaymentRetry(subscriptionId, retryInfo);
        }
      }

    } catch (error) {
      console.error('Error processing payment retries:', error);
    }
  }

  /**
   * Attempt payment retry
   */
  async attemptPaymentRetry(subscriptionId, retryInfo) {
    try {
      console.log(`Attempting payment retry ${retryInfo.attempts} for subscription ${subscriptionId}`);

      // TODO: Implement actual payment retry with PayPal
      // For now, simulate the retry attempt
      const retrySuccess = Math.random() > 0.6; // 40% success rate for simulation

      if (retrySuccess) {
        // Payment succeeded
        await this.handlePaymentRetrySuccess(subscriptionId, retryInfo);
      } else {
        // Payment failed again
        await this.handlePaymentRetryFailure(subscriptionId, retryInfo);
      }

    } catch (error) {
      console.error('Error attempting payment retry:', error);
    }
  }

  /**
   * Handle successful payment retry
   */
  async handlePaymentRetrySuccess(subscriptionId, retryInfo) {
    try {
      console.log(`Payment retry successful for subscription ${subscriptionId}`);

      // Clear retry schedule
      this.retrySchedule.delete(subscriptionId);

      // End grace period
      this.gracePeriodsActive.delete(subscriptionId);

      // Stop dunning sequence
      this.dunningSequences.delete(subscriptionId);

      // Update subscription status
      await subscriptionManager.updateSubscriptionStatus(subscriptionId, 'active', {
        gracePeriodActive: false,
        lastSuccessfulPayment: new Date()
      });

      // Send success notification
      await this.sendPaymentSuccessNotification(subscriptionId, retryInfo);

      // Log successful payment
      subscriptionMonitor.logSuccessfulPayment({
        subscriptionId,
        paymentId: `retry_${Date.now()}`,
        amount: retryInfo.amount,
        planId: retryInfo.planId,
        retryAttempt: retryInfo.attempts
      });

      this.emit('payment.retry_success', { subscriptionId, attempts: retryInfo.attempts });

    } catch (error) {
      console.error('Error handling payment retry success:', error);
    }
  }

  /**
   * Handle failed payment retry
   */
  async handlePaymentRetryFailure(subscriptionId, retryInfo) {
    try {
      console.log(`Payment retry ${retryInfo.attempts} failed for subscription ${subscriptionId}`);

      if (retryInfo.attempts >= this.config.maxRetryAttempts) {
        await this.handleMaxRetriesReached(retryInfo);
      } else {
        // Schedule next retry
        const nextRetryDays = this.config.retryIntervals[retryInfo.attempts];
        const nextRetryDate = new Date();
        nextRetryDate.setDate(nextRetryDate.getDate() + nextRetryDays);

        retryInfo.nextRetryDate = nextRetryDate;
        this.retrySchedule.set(subscriptionId, retryInfo);

        // Send retry failure notification
        await this.sendPaymentRetryFailureNotification(subscriptionId, retryInfo);
      }

      // Log failed payment
      subscriptionMonitor.logFailedPayment({
        subscriptionId,
        paymentId: `retry_${Date.now()}`,
        amount: retryInfo.amount,
        planId: retryInfo.planId,
        failureReason: 'retry_failed',
        retryAttempt: retryInfo.attempts
      });

      this.emit('payment.retry_failed', { subscriptionId, attempts: retryInfo.attempts });

    } catch (error) {
      console.error('Error handling payment retry failure:', error);
    }
  }

  /**
   * Handle max retries reached
   */
  async handleMaxRetriesReached(retryInfo) {
    try {
      const { subscriptionId } = retryInfo;
      console.log(`Max payment retries reached for subscription ${subscriptionId}`);

      // Remove from retry schedule
      this.retrySchedule.delete(subscriptionId);

      // End grace period
      this.gracePeriodsActive.delete(subscriptionId);

      // Update subscription status to suspended
      await subscriptionManager.updateSubscriptionStatus(subscriptionId, 'suspended', {
        suspensionReason: 'payment_failure_max_retries',
        suspendedAt: new Date(),
        gracePeriodActive: false
      });

      // Send final suspension notification
      await this.sendSubscriptionSuspensionNotification(subscriptionId, retryInfo);

      // Keep dunning sequence active for a few more days
      // In case user wants to manually update payment method

      this.emit('subscription.suspended', { 
        subscriptionId, 
        reason: 'payment_failure_max_retries',
        totalAttempts: retryInfo.attempts
      });

    } catch (error) {
      console.error('Error handling max retries reached:', error);
    }
  }

  /**
   * Notification sending methods
   */
  async sendPaymentFailureNotification(retryInfo) {
    const notification = {
      type: 'payment_failed',
      subscriptionId: retryInfo.subscriptionId,
      subject: 'Payment Failed - We\'ll Try Again Soon',
      template: 'payment_failed',
      data: {
        amount: retryInfo.amount,
        planId: retryInfo.planId,
        nextRetryDate: retryInfo.nextRetryDate,
        gracePeriodEnd: this.calculateGracePeriodEnd(retryInfo.originalFailureDate),
        attemptNumber: retryInfo.attempts
      }
    };

    await this.queueNotification(notification);
  }

  async sendRenewalReminderNotification(subscription, daysUntilRenewal) {
    const notification = {
      type: 'renewal_reminder',
      subscriptionId: subscription.id,
      subject: `Your PrepBettr subscription renews in ${daysUntilRenewal} ${daysUntilRenewal === 1 ? 'day' : 'days'}`,
      template: 'renewal_reminder',
      data: {
        planName: subscription.planConfig?.name,
        renewalDate: subscription.currentPeriodEnd,
        amount: subscription.planConfig?.price,
        daysUntilRenewal
      }
    };

    await this.queueNotification(notification);
  }

  async sendTrialEndingNotification(subscription, daysUntilTrialEnd) {
    const notification = {
      type: 'trial_ending',
      subscriptionId: subscription.id,
      subject: `Your free trial ends in ${daysUntilTrialEnd} ${daysUntilTrialEnd === 1 ? 'day' : 'days'}`,
      template: 'trial_ending',
      data: {
        planName: subscription.planConfig?.name,
        trialEndDate: subscription.trialEnd,
        billingAmount: subscription.planConfig?.price,
        daysUntilTrialEnd
      }
    };

    await this.queueNotification(notification);
  }

  async sendPaymentSuccessNotification(subscriptionId, retryInfo) {
    const notification = {
      type: 'payment_success_after_retry',
      subscriptionId,
      subject: 'Payment Successful - Your Subscription is Active',
      template: 'payment_success_retry',
      data: {
        amount: retryInfo.amount,
        planId: retryInfo.planId,
        retryAttempts: retryInfo.attempts
      }
    };

    await this.queueNotification(notification);
  }

  async sendPaymentRetryFailureNotification(subscriptionId, retryInfo) {
    const notification = {
      type: 'payment_retry_failed',
      subscriptionId,
      subject: 'Payment Retry Failed - Update Your Payment Method',
      template: 'payment_retry_failed',
      data: {
        amount: retryInfo.amount,
        planId: retryInfo.planId,
        attemptNumber: retryInfo.attempts,
        nextRetryDate: retryInfo.nextRetryDate,
        maxAttempts: this.config.maxRetryAttempts
      }
    };

    await this.queueNotification(notification);
  }

  async sendSubscriptionSuspensionNotification(subscriptionId, retryInfo) {
    const notification = {
      type: 'subscription_suspended',
      subscriptionId,
      subject: 'Your PrepBettr Subscription Has Been Suspended',
      template: 'subscription_suspended',
      data: {
        amount: retryInfo.amount,
        planId: retryInfo.planId,
        totalAttempts: retryInfo.attempts,
        reactivationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/reactivate`
      }
    };

    await this.queueNotification(notification);
  }

  async scheduleDunningNotification(subscriptionId, stepIndex) {
    try {
      const dunning = this.dunningSequences.get(subscriptionId);
      if (!dunning || stepIndex >= dunning.sequence.length) {
        return;
      }

      const step = dunning.sequence[stepIndex];
      const notificationDate = new Date(dunning.startDate);
      notificationDate.setDate(notificationDate.getDate() + step.day);

      // Schedule the notification
      setTimeout(async () => {
        await this.sendDunningNotification(subscriptionId, stepIndex);
        // Schedule next step
        await this.scheduleDunningNotification(subscriptionId, stepIndex + 1);
      }, notificationDate.getTime() - Date.now());

    } catch (error) {
      console.error('Error scheduling dunning notification:', error);
    }
  }

  async sendDunningNotification(subscriptionId, stepIndex) {
    try {
      const dunning = this.dunningSequences.get(subscriptionId);
      if (!dunning) return;

      const step = dunning.sequence[stepIndex];
      const notification = {
        type: step.type,
        subscriptionId,
        subject: this.getDunningSubject(step.type),
        template: step.type,
        severity: step.severity,
        data: {
          stepNumber: stepIndex + 1,
          totalSteps: dunning.sequence.length,
          amount: dunning.retryInfo.amount,
          planId: dunning.retryInfo.planId
        }
      };

      await this.queueNotification(notification);
      dunning.currentStep = stepIndex + 1;

    } catch (error) {
      console.error('Error sending dunning notification:', error);
    }
  }

  getDunningSubject(type) {
    const subjects = {
      'payment_failed': 'Payment Failed - Action Required',
      'payment_retry': 'Payment Retry Failed - Please Update Your Payment Method',
      'final_notice': 'Final Notice - Subscription Will Be Suspended',
      'suspension_notice': 'Your Subscription Has Been Suspended'
    };
    return subjects[type] || 'Subscription Update Required';
  }

  /**
   * Notification queue management
   */
  async queueNotification(notification) {
    try {
      const notificationId = this.generateNotificationId();
      notification.id = notificationId;
      notification.status = 'queued';
      notification.createdAt = new Date();

      this.notificationQueue.set(notificationId, notification);

      // Process immediately in this implementation
      // In production, you might use a queue system like Redis/BullMQ
      await this.processNotification(notification);

    } catch (error) {
      console.error('Error queueing notification:', error);
    }
  }

  async processNotification(notification) {
    try {
      console.log(`Sending ${notification.type} notification for subscription ${notification.subscriptionId}`);

      // TODO: Implement actual email/SMS sending
      // For now, just log the notification
      this.logNotification(notification);

      // Mark as sent
      notification.status = 'sent';
      notification.sentAt = new Date();

      this.emit('notification.sent', notification);

    } catch (error) {
      console.error('Error processing notification:', error);
      notification.status = 'failed';
      notification.error = error.message;
    }
  }

  logNotification(notification) {
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'subscription-notifications',
      type: notification.type,
      subscriptionId: notification.subscriptionId,
      subject: notification.subject,
      severity: notification.severity || 'medium',
      data: notification.data
    };

    console.log('SUBSCRIPTION_NOTIFICATION:', JSON.stringify(logData));
  }

  /**
   * Utility methods
   */
  calculateGracePeriodEnd(startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + this.config.gracePeriodDays);
    return endDate;
  }

  calculateDaysUntil(targetDate) {
    const now = new Date();
    const diffTime = new Date(targetDate) - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  schedulePeriodicTasks() {
    // Run every hour
    setInterval(async () => {
      await this.processPaymentRetries();
      await this.sendRenewalReminders();
      await this.sendTrialEndingReminders();
    }, 60 * 60 * 1000);

    // Cleanup completed tasks daily
    setInterval(() => {
      this.cleanupCompletedTasks();
    }, 24 * 60 * 60 * 1000);
  }

  cleanupCompletedTasks() {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    // Clean up old notifications
    for (const [id, notification] of this.notificationQueue) {
      if (notification.createdAt.getTime() < cutoff && notification.status === 'sent') {
        this.notificationQueue.delete(id);
      }
    }

    // Clean up expired grace periods
    for (const [subscriptionId, grace] of this.gracePeriodsActive) {
      if (grace.endDate.getTime() < Date.now()) {
        this.gracePeriodsActive.delete(subscriptionId);
      }
    }

    console.log('Completed periodic cleanup of notification tasks');
  }

  /**
   * Event handlers
   */
  onSubscriptionCreated(eventData) {
    // Set up renewal reminders for new subscription
    console.log(`Setting up notifications for new subscription: ${eventData.subscriptionId}`);
  }

  onSubscriptionActivated(eventData) {
    // Clear any grace periods when subscription is activated
    this.gracePeriodsActive.delete(eventData.subscriptionId);
    this.retrySchedule.delete(eventData.subscriptionId);
    this.dunningSequences.delete(eventData.subscriptionId);
  }

  onPaymentFailed(eventData) {
    // Handle payment failure
    this.handlePaymentFailure(eventData);
  }

  onSubscriptionCancelled(eventData) {
    // Clean up all scheduled notifications for cancelled subscription
    this.gracePeriodsActive.delete(eventData.subscriptionId);
    this.retrySchedule.delete(eventData.subscriptionId);
    this.dunningSequences.delete(eventData.subscriptionId);
  }

  /**
   * Public API methods
   */
  async getGracePeriodStatus(subscriptionId) {
    return this.gracePeriodsActive.get(subscriptionId);
  }

  async getRetryStatus(subscriptionId) {
    return this.retrySchedule.get(subscriptionId);
  }

  async getDunningStatus(subscriptionId) {
    return this.dunningSequences.get(subscriptionId);
  }

  async getNotificationHistory(subscriptionId) {
    const notifications = Array.from(this.notificationQueue.values())
      .filter(n => n.subscriptionId === subscriptionId)
      .sort((a, b) => b.createdAt - a.createdAt);
    
    return notifications;
  }
}

// Create singleton instance
const notificationManager = new SubscriptionNotificationManager();

export default notificationManager;

// Export class for testing
export { SubscriptionNotificationManager };