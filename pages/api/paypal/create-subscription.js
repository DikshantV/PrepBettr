// pages/api/paypal/create-subscription.js

import paypalClient, { createSubscriptionPayload, getApprovalUrl } from '../../../lib/paypal-client.js';

/**
 * Create PayPal Subscription API Route
 * 
 * @param {NextApiRequest} req - The request object
 * @param {NextApiResponse} res - The response object
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  try {
    const {
      plan_id,
      user_email,
      user_name,
      return_url,
      cancel_url,
      start_time
    } = req.body;

    // Validation
    if (!plan_id || !user_email || !return_url || !cancel_url) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'plan_id, user_email, return_url, and cancel_url are required',
        required: ['plan_id', 'user_email', 'return_url', 'cancel_url']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user_email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      });
    }

    // Validate URLs
    try {
      new URL(return_url);
      new URL(cancel_url);
    } catch (urlError) {
      return res.status(400).json({
        error: 'Invalid URL format',
        message: 'return_url and cancel_url must be valid URLs'
      });
    }

    // Prepare subscriber information
    const subscriberInfo = {
      email: user_email,
      name: user_name || undefined
    };

    // Create subscription payload
    const subscriptionData = createSubscriptionPayload(
      plan_id,
      subscriberInfo,
      return_url,
      cancel_url
    );

    // Add start_time if provided
    if (start_time) {
      subscriptionData.start_time = start_time;
    }

    console.log(`Creating PayPal subscription for plan: ${plan_id}, user: ${user_email}`);

    // Create subscription through PayPal
    const subscription = await paypalClient.createSubscription(subscriptionData);

    // Extract approval URL
    const approvalUrl = getApprovalUrl(subscription);

    if (!approvalUrl) {
      throw new Error('No approval URL found in subscription response');
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription_id: subscription.id,
        status: subscription.status,
        approval_url: approvalUrl,
        plan_id: plan_id,
        subscriber_email: user_email,
        create_time: subscription.create_time,
        links: subscription.links,
        paypal_subscription: subscription
      }
    });

  } catch (error) {
    console.error('Error creating subscription:', error);

    // Handle PayPal-specific errors
    if (error.message.includes('PayPal')) {
      return res.status(400).json({
        error: 'PayPal API error',
        message: error.message,
        details: 'Please check your plan configuration and user details'
      });
    }

    // Handle validation errors
    if (error.message.includes('Invalid') || error.message.includes('required')) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.message,
        details: 'Please check your request data and try again'
      });
    }

    // Handle general errors
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create subscription',
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
