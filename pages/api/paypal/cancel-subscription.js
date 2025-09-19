// pages/api/paypal/cancel-subscription.js

import paypalClient from '../../../lib/paypal-client.js';

/**
 * Cancel PayPal Subscription API Route
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
    const { subscription_id, reason } = req.body;

    // Validation
    if (!subscription_id) {
      return res.status(400).json({
        error: 'Missing subscription ID',
        message: 'subscription_id is required',
        required: ['subscription_id']
      });
    }

    const cancellationReason = reason || 'User requested cancellation';

    console.log(`Cancelling PayPal subscription: ${subscription_id}`);

    // Cancel subscription through PayPal
    const success = await paypalClient.cancelSubscription(subscription_id, cancellationReason);

    if (!success) {
      throw new Error('Failed to cancel subscription');
    }

    // TODO: Update subscription status in your database
    /*
    await updateSubscriptionStatus(subscription_id, 'CANCELLED', {
      cancelReason: cancellationReason,
      cancelTime: new Date().toISOString()
    });
    */

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: {
        subscription_id,
        status: 'CANCELLED',
        cancellation_reason: cancellationReason,
        cancelled_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error cancelling subscription:', error);

    // Handle PayPal-specific errors
    if (error.message.includes('PayPal')) {
      return res.status(400).json({
        error: 'PayPal API error',
        message: error.message,
        details: 'Failed to cancel subscription through PayPal'
      });
    }

    // Handle subscription not found errors
    if (error.message.includes('not found') || error.message.includes('404')) {
      return res.status(404).json({
        error: 'Subscription not found',
        message: 'The specified subscription could not be found'
      });
    }

    // Handle general errors
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to cancel subscription',
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
