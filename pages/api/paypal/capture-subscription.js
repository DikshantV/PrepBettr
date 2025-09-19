// pages/api/paypal/capture-subscription.js

import paypalClient from '../../../lib/paypal-client.js';

/**
 * Capture PayPal Subscription API Route
 * Handles subscription approval callback and verifies subscription status
 * 
 * @param {NextApiRequest} req - The request object
 * @param {NextApiResponse} res - The response object
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Allow both POST and GET requests
  if (!['POST', 'GET'].includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint accepts POST and GET requests'
    });
  }

  try {
    // Extract subscription ID from request
    const subscription_id = req.method === 'POST' 
      ? req.body.subscription_id 
      : req.query.subscription_id;
    
    const token = req.method === 'POST'
      ? req.body.token
      : req.query.token;

    // Validation
    if (!subscription_id) {
      return res.status(400).json({
        error: 'Missing subscription ID',
        message: 'subscription_id is required',
        required: ['subscription_id']
      });
    }

    console.log(`Capturing PayPal subscription: ${subscription_id}`);

    // Get subscription details from PayPal
    const subscription = await paypalClient.getSubscription(subscription_id);

    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found',
        message: `Subscription ${subscription_id} not found in PayPal`,
        subscription_id
      });
    }

    // Check subscription status
    const isActive = ['ACTIVE', 'APPROVED'].includes(subscription.status);
    const isApprovalPending = subscription.status === 'APPROVAL_PENDING';

    // TODO: Update subscription in your database
    // This is where you would typically:
    // 1. Save subscription details to your database
    // 2. Update user's subscription status
    // 3. Grant access to premium features
    // 4. Send confirmation email
    
    /*
    Example database update:
    
    import { updateUserSubscription } from '../../../lib/database';
    
    const subscriptionData = {
      userId: req.body.user_id || req.query.user_id,
      paypalSubscriptionId: subscription.id,
      paypalPlanId: subscription.plan_id,
      status: subscription.status,
      startTime: subscription.start_time,
      nextBillingTime: subscription.billing_info?.next_billing_time,
      subscriberEmail: subscription.subscriber?.email_address,
      provider: 'paypal'
    };
    
    await updateUserSubscription(subscriptionData);
    */

    // Determine success status
    const success = isActive || isApprovalPending;
    const statusCode = success ? 200 : 400;

    // Prepare response data
    const responseData = {
      success,
      subscription_id: subscription.id,
      status: subscription.status,
      plan_id: subscription.plan_id,
      subscriber_email: subscription.subscriber?.email_address,
      start_time: subscription.start_time,
      create_time: subscription.create_time,
      update_time: subscription.update_time,
      billing_info: subscription.billing_info,
      links: subscription.links
    };

    // Add status-specific information
    if (isActive) {
      responseData.message = 'Subscription activated successfully';
      responseData.next_billing_time = subscription.billing_info?.next_billing_time;
      responseData.last_payment = subscription.billing_info?.last_payment;
    } else if (isApprovalPending) {
      responseData.message = 'Subscription approval is pending';
      responseData.approval_required = true;
    } else {
      responseData.message = `Subscription status: ${subscription.status}`;
      responseData.error = 'Subscription is not active';
    }

    // Log subscription capture event
    console.log(`Subscription ${subscription_id} capture result:`, {
      status: subscription.status,
      success,
      email: subscription.subscriber?.email_address
    });

    res.status(statusCode).json(responseData);

  } catch (error) {
    console.error('Error capturing subscription:', error);

    // Handle PayPal-specific errors
    if (error.message.includes('PayPal')) {
      return res.status(400).json({
        error: 'PayPal API error',
        message: error.message,
        details: 'Failed to retrieve subscription details from PayPal'
      });
    }

    // Handle subscription not found errors
    if (error.message.includes('not found') || error.message.includes('404')) {
      return res.status(404).json({
        error: 'Subscription not found',
        message: 'The specified subscription could not be found',
        details: 'Please verify the subscription ID and try again'
      });
    }

    // Handle general errors
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to capture subscription',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
}

/**
 * API Route Configuration
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: false,
  },
};
