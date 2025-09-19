// app/api/subscriptions/billing/route.js

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withSubscriptionSecurity, schemas } from '@/lib/subscription-security';
import subscriptionManager from '@/lib/subscription-manager';
import subscriptionMonitor from '@/lib/subscription-monitoring';
import notificationManager from '@/lib/subscription-notifications';

/**
 * Billing Management API Endpoints
 * Handles billing cycle changes, grace periods, and payment retry management
 */

/**
 * POST /api/subscriptions/billing
 * Change billing cycle (monthly ↔ yearly)
 */
export const POST = withSubscriptionSecurity(async (request) => {
  try {
    const userId = request.userId;
    const { subscriptionId, newBillingCycle, prorationMode = 'immediate' } = request.validatedBody;

    // Verify subscription ownership
    const subscription = subscriptionManager.activeSubscriptions.get(subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json(
        { error: 'Subscription not found or unauthorized' },
        { status: 404 }
      );
    }

    // Validate billing cycle change
    const currentCycle = subscription.planId.includes('MONTHLY') ? 'monthly' : 'yearly';
    if (currentCycle === newBillingCycle) {
      return NextResponse.json(
        { error: 'Subscription is already on the requested billing cycle' },
        { status: 400 }
      );
    }

    // Perform billing cycle change
    const result = await subscriptionManager.changeBillingCycle(subscriptionId, newBillingCycle, {
      prorationMode,
      reason: `User requested billing cycle change to ${newBillingCycle}`
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to change billing cycle' },
        { status: 500 }
      );
    }

    // Log billing cycle change
    subscriptionMonitor.logStructuredEvent('subscription.billing_cycle_changed', {
      subscriptionId,
      userId,
      oldCycle: currentCycle,
      newCycle: newBillingCycle,
      prorationAmount: result.prorationAmount,
      prorationMode
    });

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      billingCycle: newBillingCycle,
      prorationAmount: result.prorationAmount,
      effectiveDate: result.effectiveDate,
      message: `Billing cycle changed to ${newBillingCycle}`
    });

  } catch (error) {
    console.error('Error changing billing cycle:', error);
    return NextResponse.json(
      { error: 'Failed to change billing cycle', details: error.message },
      { status: 500 }
    );
  }
}, {
  schema: schemas.planChange,
  limitType: 'subscription_update'
});

/**
 * GET /api/subscriptions/billing/[subscriptionId]
 * Get billing information and payment history
 */
export const GET = withSubscriptionSecurity(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');
    const userId = request.userId;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Verify subscription ownership
    const subscription = subscriptionManager.activeSubscriptions.get(subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json(
        { error: 'Subscription not found or unauthorized' },
        { status: 404 }
      );
    }

    // Get billing information
    const billingInfo = {
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEnd: subscription.trialEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      },
      
      // Get grace period information
      gracePeriod: await notificationManager.getGracePeriodStatus(subscriptionId),
      
      // Get retry status
      retryStatus: await notificationManager.getRetryStatus(subscriptionId),
      
      // Get dunning status
      dunningStatus: await notificationManager.getDunningStatus(subscriptionId),
      
      // Get recent payments (would come from database)
      // paymentHistory: await getPaymentHistory(subscriptionId),
      
      // Get upcoming billing information
      upcomingBilling: {
        nextBillingDate: subscription.currentPeriodEnd,
        amount: subscription.planConfig?.price,
        currency: subscription.planConfig?.currency || 'USD'
      }
    };

    return NextResponse.json({
      success: true,
      billing: billingInfo
    });

  } catch (error) {
    console.error('Error retrieving billing information:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve billing information' },
      { status: 500 }
    );
  }
}, {
  limitType: 'management'
});

/**
 * PUT /api/subscriptions/billing/retry
 * Manual payment retry for failed payments
 */
export const PUT = withSubscriptionSecurity(async (request) => {
  try {
    const userId = request.userId;
    const { subscriptionId, force = false } = request.validatedBody;

    // Verify subscription ownership
    const subscription = subscriptionManager.activeSubscriptions.get(subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json(
        { error: 'Subscription not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if subscription has failed payments
    const retryStatus = await notificationManager.getRetryStatus(subscriptionId);
    if (!retryStatus && !force) {
      return NextResponse.json(
        { error: 'No failed payments found for this subscription' },
        { status: 400 }
      );
    }

    // Manual retry attempt
    const retryResult = await notificationManager.attemptPaymentRetry(subscriptionId, retryStatus);

    // Log manual retry attempt
    subscriptionMonitor.logStructuredEvent('subscription.manual_retry', {
      subscriptionId,
      userId,
      force,
      retryAttempts: retryStatus?.attempts || 0
    });

    return NextResponse.json({
      success: true,
      retryAttempted: true,
      message: 'Payment retry initiated',
      retryStatus: await notificationManager.getRetryStatus(subscriptionId)
    });

  } catch (error) {
    console.error('Error attempting manual retry:', error);
    return NextResponse.json(
      { error: 'Failed to retry payment', details: error.message },
      { status: 500 }
    );
  }
}, {
  schema: z.object({
    subscriptionId: z.string().min(1),
    force: z.boolean().optional()
  }),
  limitType: 'subscription_update'
});