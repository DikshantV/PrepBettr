// app/api/subscriptions/route.js

import { NextResponse } from 'next/server';
import { withSubscriptionSecurity, schemas } from '@/lib/subscription-security';
import subscriptionManager from '@/lib/subscription-manager';
import subscriptionMonitor from '@/lib/subscription-monitoring';
import notificationManager from '@/lib/subscription-notifications';

/**
 * Subscription Management API Endpoints
 * Handles all subscription CRUD operations with comprehensive security
 */

/**
 * GET /api/subscriptions
 * Retrieve user's subscriptions or admin dashboard data
 */
export const GET = withSubscriptionSecurity(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = request.userId;
    const isAdmin = searchParams.get('admin') === 'true';
    const includeAnalytics = searchParams.get('analytics') === 'true';

    if (isAdmin) {
      // TODO: Add admin role check
      // const hasAdminRole = await checkAdminRole(userId);
      // if (!hasAdminRole) {
      //   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      // }

      // Return admin dashboard data
      const dashboardData = await subscriptionMonitor.getDashboardData();
      const allSubscriptions = Array.from(subscriptionManager.activeSubscriptions.values());

      return NextResponse.json({
        success: true,
        dashboard: dashboardData,
        subscriptions: allSubscriptions.slice(0, 50), // Limit for performance
        total: allSubscriptions.length
      });
    }

    // Get user's subscriptions
    const userSubscriptions = Array.from(subscriptionManager.activeSubscriptions.values())
      .filter(sub => sub.userId === userId);

    let response = {
      success: true,
      subscriptions: userSubscriptions
    };

    if (includeAnalytics) {
      const analytics = await subscriptionManager.getSubscriptionAnalytics(userId);
      response.analytics = analytics;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error retrieving subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve subscriptions' },
      { status: 500 }
    );
  }
}, {
  limitType: 'management'
});

/**
 * POST /api/subscriptions
 * Create a new subscription
 */
export const POST = withSubscriptionSecurity(async (request) => {
  try {
    const userId = request.userId;
    const user = request.user;
    const planData = request.validatedBody;

    // Check if user already has an active subscription
    const existingSubscription = await subscriptionManager.getUserActiveSubscription(userId);
    if (existingSubscription) {
      return NextResponse.json(
        { 
          error: 'Active subscription exists',
          message: 'You already have an active subscription. Please cancel it first to create a new one.',
          existingSubscription: {
            id: existingSubscription.id,
            planId: existingSubscription.planId,
            status: existingSubscription.status
          }
        },
        { status: 409 }
      );
    }

    // Create subscription
    const result = await subscriptionManager.createSubscription(userId, planData, {
      email: user.email,
      name: user.name
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      );
    }

    // Log successful creation
    subscriptionMonitor.logStructuredEvent('subscription.api_created', {
      subscriptionId: result.subscription.id,
      userId,
      planId: planData.planId,
      billingCycle: planData.billingCycle
    });

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      approvalUrl: result.approvalUrl
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription', details: error.message },
      { status: 500 }
    );
  }
}, {
  schema: schemas.createSubscription,
  validatePlan: true,
  checkEligibility: true,
  limitType: 'subscription_create'
});

/**
 * PUT /api/subscriptions
 * Update subscription (plan changes, billing cycle changes, etc.)
 */
export const PUT = withSubscriptionSecurity(async (request) => {
  try {
    const userId = request.userId;
    const updateData = request.validatedBody;
    const { subscriptionId, action, newPlanId, reason, effectiveDate } = updateData;

    // Verify subscription ownership
    const subscription = subscriptionManager.activeSubscriptions.get(subscriptionId);
    if (!subscription || subscription.userId !== userId) {
      return NextResponse.json(
        { error: 'Subscription not found or unauthorized' },
        { status: 404 }
      );
    }

    let result;

    switch (action) {
      case 'change_plan':
        if (!newPlanId) {
          return NextResponse.json(
            { error: 'newPlanId is required for plan changes' },
            { status: 400 }
          );
        }
        result = await subscriptionManager.changePlan(subscriptionId, newPlanId, {
          reason: reason || 'User requested plan change',
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null
        });
        break;

      case 'cancel':
        result = await subscriptionManager.cancelSubscription(subscriptionId, {
          reason: reason || 'User requested cancellation',
          immediate: false // Cancel at period end by default
        });
        break;

      case 'suspend':
        result = await subscriptionManager.updateSubscriptionStatus(subscriptionId, 'suspended', {
          suspensionReason: reason || 'User requested suspension',
          suspendedAt: new Date()
        });
        break;

      case 'activate':
        if (subscription.status === 'suspended') {
          result = await subscriptionManager.reactivateSubscription(
            subscriptionId,
            reason || 'User requested reactivation'
          );
        } else {
          return NextResponse.json(
            { error: 'Can only activate suspended subscriptions' },
            { status: 400 }
          );
        }
        break;

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: `Failed to ${action} subscription` },
        { status: 500 }
      );
    }

    // Log the action
    subscriptionMonitor.logStructuredEvent(`subscription.${action}`, {
      subscriptionId,
      userId,
      action,
      newPlanId,
      reason
    });

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      action,
      message: `Subscription ${action} successful`
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription', details: error.message },
      { status: 500 }
    );
  }
}, {
  schema: schemas.updateSubscription,
  limitType: 'subscription_update'
});

/**
 * DELETE /api/subscriptions/[id]
 * Cancel/delete subscription
 */
export const DELETE = withSubscriptionSecurity(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('id');
    const userId = request.userId;
    const immediate = searchParams.get('immediate') === 'true';
    const reason = searchParams.get('reason') || 'User requested cancellation';

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

    // Cancel the subscription
    const result = await subscriptionManager.cancelSubscription(subscriptionId, {
      reason,
      immediate
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }

    // Log cancellation
    subscriptionMonitor.logStructuredEvent('subscription.cancelled_via_api', {
      subscriptionId,
      userId,
      immediate,
      reason
    });

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      message: immediate ? 'Subscription cancelled immediately' : 'Subscription will cancel at period end'
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription', details: error.message },
      { status: 500 }
    );
  }
}, {
  limitType: 'subscription_update'
});