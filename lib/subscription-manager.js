// lib/subscription-manager.js

import paypalClient from '@/lib/paypal-client';
import { PAYPAL_PLANS } from '@/lib/paypal-config';
import { SANDBOX_PLAN_IDS } from '@/lib/paypal-sandbox-config';
import { SubscriptionData } from '@/lib/subscription-utils';
import { EventEmitter } from 'events';

/**
 * Subscription Management System
 * Handles subscription lifecycle, plan changes, billing updates, and status tracking
 */

class SubscriptionManager extends EventEmitter {
  constructor() {
    super();
    this.activeSubscriptions = new Map(); // In-memory cache for active subscriptions
    this.planChangeQueue = new Map(); // Queue for pending plan changes
  }

  /**
   * Create a new subscription
   */
  async createSubscription(userId, planData, userInfo = {}) {
    try {
      console.log(`Creating subscription for user ${userId}, plan: ${planData.planId}`);

      // Validate plan configuration
      const planConfig = PAYPAL_PLANS[planData.planId];
      if (!planConfig) {
        throw new Error(`Invalid plan: ${planData.planId}`);
      }

      // Get PayPal plan ID
      const paypalPlanId = SANDBOX_PLAN_IDS[planData.planId];
      if (!paypalPlanId) {
        throw new Error(`PayPal plan ID not configured for: ${planData.planId}`);
      }

      // Create subscription payload
      const subscriptionPayload = {
        plan_id: paypalPlanId,
        subscriber: {
          name: userInfo.name ? {
            given_name: userInfo.name.split(' ')[0] || '',
            surname: userInfo.name.split(' ').slice(1).join(' ') || ''
          } : undefined,
          email_address: userInfo.email
        },
        application_context: {
          brand_name: 'PrepBettr',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
          },
          return_url: planData.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success`,
          cancel_url: planData.cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/subscription/cancel`
        },
        custom_id: userId,
        plan: {
          id: paypalPlanId
        }
      };

      // Create subscription via PayPal
      const paypalSubscription = await paypalClient.createSubscription(subscriptionPayload);

      // Create local subscription record
      const subscription = {
        id: this.generateSubscriptionId(),
        userId,
        paypalSubscriptionId: paypalSubscription.id,
        planId: planData.planId,
        status: 'pending_approval',
        paypalStatus: paypalSubscription.status,
        planConfig,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalUrl: this.getApprovalUrl(paypalSubscription),
        trialEnd: this.calculateTrialEnd(planConfig),
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.calculatePeriodEnd(planConfig, new Date())
      };

      // Store in cache
      this.activeSubscriptions.set(subscription.id, subscription);

      // TODO: Store in database
      // await this.saveSubscriptionToDb(subscription);

      // Emit subscription created event
      this.emit('subscription.created', {
        subscriptionId: subscription.id,
        userId,
        planId: planData.planId,
        paypalSubscriptionId: paypalSubscription.id
      });

      console.log(`Subscription created successfully: ${subscription.id}`);
      return {
        success: true,
        subscription,
        approvalUrl: subscription.approvalUrl
      };

    } catch (error) {
      console.error('Subscription creation failed:', error);
      
      this.emit('subscription.creation_failed', {
        userId,
        planId: planData.planId,
        error: error.message
      });

      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Get user's active subscription
   */
  async getUserActiveSubscription(userId) {
    try {
      // First check cache
      for (const [subscriptionId, subscription] of this.activeSubscriptions.entries()) {
        if (subscription.userId === userId && ['active', 'trialing'].includes(subscription.status)) {
          return subscription;
        }
      }

      // TODO: Query database
      // const dbSubscription = await this.getSubscriptionFromDb(userId);
      // if (dbSubscription) {
      //   this.activeSubscriptions.set(dbSubscription.id, dbSubscription);
      //   return dbSubscription;
      // }

      return null;
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      return null;
    }
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(subscriptionId, status, metadata = {}) {
    try {
      const subscription = this.activeSubscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      const oldStatus = subscription.status;
      subscription.status = status;
      subscription.updatedAt = new Date();
      
      // Update additional metadata
      Object.assign(subscription, metadata);

      // Update cache
      this.activeSubscriptions.set(subscriptionId, subscription);

      // TODO: Update database
      // await this.updateSubscriptionInDb(subscriptionId, { status, ...metadata });

      // Emit status change event
      this.emit('subscription.status_changed', {
        subscriptionId,
        userId: subscription.userId,
        oldStatus,
        newStatus: status,
        metadata
      });

      console.log(`Subscription ${subscriptionId} status updated: ${oldStatus} → ${status}`);
      return { success: true, subscription };

    } catch (error) {
      console.error('Subscription status update failed:', error);
      throw error;
    }
  }

  /**
   * Change subscription plan
   */
  async changePlan(subscriptionId, newPlanId, options = {}) {
    try {
      const { 
        prorationMode = 'immediate',
        effectiveDate = null,
        reason = 'User requested plan change'
      } = options;

      const subscription = this.activeSubscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      const currentPlan = PAYPAL_PLANS[subscription.planId];
      const newPlan = PAYPAL_PLANS[newPlanId];

      if (!newPlan) {
        throw new Error(`Invalid new plan: ${newPlanId}`);
      }

      console.log(`Plan change requested: ${subscription.planId} → ${newPlanId} (${prorationMode})`);

      // Validate plan change
      const changeValidation = this.validatePlanChange(currentPlan, newPlan);
      if (!changeValidation.valid) {
        throw new Error(changeValidation.error);
      }

      // Calculate proration if immediate
      let prorationAmount = 0;
      if (prorationMode === 'immediate') {
        prorationAmount = this.calculateProration(subscription, newPlan);
      }

      // For PayPal, we need to cancel current and create new subscription
      const planChangeResult = await this.executePlanChange(
        subscription,
        newPlanId,
        prorationMode,
        prorationAmount
      );

      // Update subscription record
      const updatedSubscription = {
        ...subscription,
        planId: newPlanId,
        planConfig: newPlan,
        previousPlanId: subscription.planId,
        planChangeDate: new Date(),
        prorationAmount,
        updatedAt: new Date()
      };

      this.activeSubscriptions.set(subscriptionId, updatedSubscription);

      // Emit plan change event
      this.emit('subscription.plan_changed', {
        subscriptionId,
        userId: subscription.userId,
        oldPlanId: subscription.planId,
        newPlanId,
        prorationAmount,
        effectiveDate: effectiveDate || new Date()
      });

      console.log(`Plan change completed: ${subscription.planId} → ${newPlanId}`);
      return {
        success: true,
        subscription: updatedSubscription,
        prorationAmount,
        ...planChangeResult
      };

    } catch (error) {
      console.error('Plan change failed:', error);
      
      this.emit('subscription.plan_change_failed', {
        subscriptionId,
        newPlanId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Change billing cycle (monthly ↔ yearly)
   */
  async changeBillingCycle(subscriptionId, newCycle, options = {}) {
    try {
      const subscription = this.activeSubscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      const currentPlan = PAYPAL_PLANS[subscription.planId];
      const planType = subscription.planId.includes('INDIVIDUAL') ? 'INDIVIDUAL' : 'ENTERPRISE';
      const newPlanId = `${planType}_${newCycle.toUpperCase()}`;

      console.log(`Billing cycle change: ${subscription.planId} → ${newPlanId}`);

      // Use plan change functionality
      return await this.changePlan(subscriptionId, newPlanId, {
        ...options,
        reason: `Billing cycle change to ${newCycle}`
      });

    } catch (error) {
      console.error('Billing cycle change failed:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId, options = {}) {
    try {
      const { 
        reason = 'User requested cancellation',
        immediate = false,
        refundAmount = 0
      } = options;

      const subscription = this.activeSubscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      console.log(`Cancelling subscription: ${subscriptionId} (immediate: ${immediate})`);

      // Cancel via PayPal
      const cancelResult = await paypalClient.cancelSubscription(
        subscription.paypalSubscriptionId,
        reason
      );

      if (!cancelResult) {
        throw new Error('PayPal cancellation failed');
      }

      // Update subscription status
      const cancelData = {
        status: immediate ? 'cancelled' : 'cancel_at_period_end',
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelAtPeriodEnd: !immediate,
        refundAmount
      };

      await this.updateSubscriptionStatus(subscriptionId, cancelData.status, cancelData);

      // Emit cancellation event
      this.emit('subscription.cancelled', {
        subscriptionId,
        userId: subscription.userId,
        planId: subscription.planId,
        immediate,
        reason,
        refundAmount
      });

      console.log(`Subscription cancelled successfully: ${subscriptionId}`);
      return {
        success: true,
        subscription: this.activeSubscriptions.get(subscriptionId),
        immediate,
        refundAmount
      };

    } catch (error) {
      console.error('Subscription cancellation failed:', error);
      throw error;
    }
  }

  /**
   * Reactivate suspended subscription
   */
  async reactivateSubscription(subscriptionId, reason = 'User requested reactivation') {
    try {
      const subscription = this.activeSubscriptions.get(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (!['suspended', 'cancelled'].includes(subscription.status)) {
        throw new Error(`Cannot reactivate subscription in status: ${subscription.status}`);
      }

      console.log(`Reactivating subscription: ${subscriptionId}`);

      // Reactivate via PayPal
      const reactivateResult = await paypalClient.activateSubscription(
        subscription.paypalSubscriptionId,
        reason
      );

      if (!reactivateResult) {
        throw new Error('PayPal reactivation failed');
      }

      // Update subscription status
      await this.updateSubscriptionStatus(subscriptionId, 'active', {
        reactivatedAt: new Date(),
        reactivationReason: reason
      });

      // Emit reactivation event
      this.emit('subscription.reactivated', {
        subscriptionId,
        userId: subscription.userId,
        planId: subscription.planId,
        reason
      });

      console.log(`Subscription reactivated successfully: ${subscriptionId}`);
      return {
        success: true,
        subscription: this.activeSubscriptions.get(subscriptionId)
      };

    } catch (error) {
      console.error('Subscription reactivation failed:', error);
      throw error;
    }
  }

  /**
   * Get subscription analytics
   */
  async getSubscriptionAnalytics(userId = null) {
    try {
      let subscriptions;
      
      if (userId) {
        subscriptions = Array.from(this.activeSubscriptions.values())
          .filter(sub => sub.userId === userId);
      } else {
        subscriptions = Array.from(this.activeSubscriptions.values());
      }

      const analytics = {
        total: subscriptions.length,
        byStatus: {},
        byPlan: {},
        byBillingCycle: { monthly: 0, yearly: 0 },
        conversionRates: this.calculateConversionRates(subscriptions),
        churnRate: this.calculateChurnRate(subscriptions),
        averageLifespan: this.calculateAverageLifespan(subscriptions),
        totalRevenue: this.calculateTotalRevenue(subscriptions)
      };

      // Count by status
      subscriptions.forEach(sub => {
        analytics.byStatus[sub.status] = (analytics.byStatus[sub.status] || 0) + 1;
        analytics.byPlan[sub.planId] = (analytics.byPlan[sub.planId] || 0) + 1;
        
        if (sub.planId.includes('MONTHLY')) {
          analytics.byBillingCycle.monthly++;
        } else {
          analytics.byBillingCycle.yearly++;
        }
      });

      return analytics;

    } catch (error) {
      console.error('Analytics calculation failed:', error);
      throw error;
    }
  }

  // Helper methods
  generateSubscriptionId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  getApprovalUrl(paypalSubscription) {
    const approvalLink = paypalSubscription.links?.find(link => link.rel === 'approve');
    return approvalLink?.href || null;
  }

  calculateTrialEnd(planConfig) {
    if (!planConfig.trial_period?.duration) return null;
    
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + planConfig.trial_period.duration);
    return trialEnd;
  }

  calculatePeriodEnd(planConfig, startDate) {
    const endDate = new Date(startDate);
    
    if (planConfig.billing_cycle === 'YEARLY') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    
    return endDate;
  }

  validatePlanChange(currentPlan, newPlan) {
    // Validate plan change business rules
    if (currentPlan.id === newPlan.id) {
      return { valid: false, error: 'Cannot change to the same plan' };
    }

    // Add any business rules for plan changes
    // For example, prevent downgrades during trial period, etc.
    
    return { valid: true };
  }

  calculateProration(subscription, newPlan) {
    // Calculate prorated amount for plan changes
    const currentPlan = subscription.planConfig;
    const daysRemaining = Math.ceil(
      (subscription.currentPeriodEnd - new Date()) / (1000 * 60 * 60 * 24)
    );
    
    const totalDaysInPeriod = currentPlan.billing_cycle === 'YEARLY' ? 365 : 30;
    const proratedRefund = (currentPlan.price / totalDaysInPeriod) * daysRemaining;
    const proratedCharge = (newPlan.price / totalDaysInPeriod) * daysRemaining;
    
    return proratedCharge - proratedRefund;
  }

  async executePlanChange(subscription, newPlanId, prorationMode, prorationAmount) {
    // For PayPal subscriptions, we typically need to cancel and create new
    // This is a simplified implementation
    
    try {
      if (prorationMode === 'end_of_period') {
        // Schedule plan change for end of period
        this.planChangeQueue.set(subscription.id, {
          newPlanId,
          effectiveDate: subscription.currentPeriodEnd,
          prorationAmount
        });
        
        return { 
          scheduled: true, 
          effectiveDate: subscription.currentPeriodEnd 
        };
      } else {
        // Immediate plan change - would require cancelling current and creating new
        // For now, just update the plan configuration
        return { 
          immediate: true, 
          effectiveDate: new Date() 
        };
      }
    } catch (error) {
      console.error('Plan change execution failed:', error);
      throw error;
    }
  }

  calculateConversionRates(subscriptions) {
    const monthly = subscriptions.filter(s => s.planId.includes('MONTHLY')).length;
    const yearly = subscriptions.filter(s => s.planId.includes('YEARLY')).length;
    const total = monthly + yearly;
    
    return {
      monthlyToYearly: total > 0 ? yearly / total : 0,
      yearlyToMonthly: total > 0 ? monthly / total : 0
    };
  }

  calculateChurnRate(subscriptions) {
    const cancelled = subscriptions.filter(s => 
      ['cancelled', 'expired'].includes(s.status)
    ).length;
    
    return subscriptions.length > 0 ? cancelled / subscriptions.length : 0;
  }

  calculateAverageLifespan(subscriptions) {
    const completedSubscriptions = subscriptions.filter(s => 
      s.cancelledAt || s.expiredAt
    );
    
    if (completedSubscriptions.length === 0) return 0;
    
    const totalDays = completedSubscriptions.reduce((sum, sub) => {
      const endDate = sub.cancelledAt || sub.expiredAt;
      const days = (endDate - sub.createdAt) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    
    return totalDays / completedSubscriptions.length;
  }

  calculateTotalRevenue(subscriptions) {
    return subscriptions.reduce((sum, sub) => {
      if (['active', 'cancelled', 'expired'].includes(sub.status)) {
        return sum + (sub.planConfig?.price || 0);
      }
      return sum;
    }, 0);
  }
}

// Create singleton instance
const subscriptionManager = new SubscriptionManager();

export default subscriptionManager;

// Export specific functions for easier importing
export {
  subscriptionManager,
  SubscriptionManager
};