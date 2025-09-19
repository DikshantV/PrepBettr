// pages/api/paypal/get-subscription.js

import paypalClient from '../../../lib/paypal-client.js';

/**
 * Get PayPal Subscription Details API Route
 * 
 * @param {NextApiRequest} req - The request object
 * @param {NextApiResponse} res - The response object
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts GET requests'
    });
  }

  try {
    const { subscription_id } = req.query;

    // Validation
    if (!subscription_id) {
      return res.status(400).json({
        error: 'Missing subscription ID',
        message: 'subscription_id query parameter is required'
      });
    }

    console.log(`Fetching PayPal subscription: ${subscription_id}`);

    // Get subscription details from PayPal
    const subscription = await paypalClient.getSubscription(subscription_id);

    // Return subscription details
    res.status(200).json({
      success: true,
      message: 'Subscription retrieved successfully',
      data: {
        subscription_id: subscription.id,
        status: subscription.status,
        plan_id: subscription.plan_id,
        subscriber_email: subscription.subscriber?.email_address,
        subscriber_name: subscription.subscriber?.name,
        start_time: subscription.start_time,
        create_time: subscription.create_time,
        update_time: subscription.update_time,
        billing_info: subscription.billing_info,
        links: subscription.links,
        paypal_subscription: subscription
      }
    });

  } catch (error) {
    console.error('Error getting subscription:', error);

    // Handle subscription not found errors
    if (error.message.includes('not found') || error.message.includes('404')) {
      return res.status(404).json({
        error: 'Subscription not found',
        message: 'The specified subscription could not be found'
      });
    }

    // Handle PayPal-specific errors
    if (error.message.includes('PayPal')) {
      return res.status(400).json({
        error: 'PayPal API error',
        message: error.message
      });
    }

    // Handle general errors
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve subscription',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
}

/**
 * API Route Configuration
 */
export const config = {
  api: {
    responseLimit: false,
  },
};
