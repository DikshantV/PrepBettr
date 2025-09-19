// pages/api/paypal/create-subscription-plan.js

import paypalClient from '../../../lib/paypal-client.js';
import { PAYPAL_PLANS, getPlanById } from '../../../lib/paypal-config.js';

/**
 * Create PayPal Subscription Plan API Route
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
    const { planType, billingCycle, productId } = req.body;

    // Validation
    if (!planType || !billingCycle || !productId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'planType, billingCycle, and productId are required',
        required: ['planType', 'billingCycle', 'productId']
      });
    }

    // Validate plan type
    if (!['INDIVIDUAL', 'ENTERPRISE'].includes(planType.toUpperCase())) {
      return res.status(400).json({
        error: 'Invalid plan type',
        message: 'planType must be either "INDIVIDUAL" or "ENTERPRISE"'
      });
    }

    // Validate billing cycle
    if (!['MONTHLY', 'YEARLY'].includes(billingCycle.toUpperCase())) {
      return res.status(400).json({
        error: 'Invalid billing cycle',
        message: 'billingCycle must be either "MONTHLY" or "YEARLY"'
      });
    }

    // Construct plan key
    const planKey = `${planType.toUpperCase()}_${billingCycle.toUpperCase()}`;
    
    // Get plan configuration
    const planConfig = PAYPAL_PLANS[planKey];
    if (!planConfig) {
      return res.status(400).json({
        error: 'Plan configuration not found',
        message: `No configuration found for ${planKey}`,
        availablePlans: Object.keys(PAYPAL_PLANS)
      });
    }

    // Create the subscription plan
    console.log(`Creating PayPal plan: ${planKey} for product: ${productId}`);
    
    const createdPlan = await paypalClient.createSubscriptionPlan(planKey, productId);

    // Return success response with plan details
    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      data: {
        plan_id: createdPlan.id,
        plan_name: planConfig.name,
        plan_description: planConfig.description,
        plan_type: planType.toUpperCase(),
        billing_cycle: billingCycle.toUpperCase(),
        price: planConfig.price,
        currency: planConfig.currency,
        features: planConfig.features,
        limits: planConfig.limits,
        trial_period: planConfig.trial_period,
        status: createdPlan.status,
        paypal_plan: createdPlan
      }
    });

  } catch (error) {
    console.error('Error creating subscription plan:', error);

    // Handle PayPal-specific errors
    if (error.message.includes('PayPal')) {
      return res.status(400).json({
        error: 'PayPal API error',
        message: error.message,
        details: 'Please check your PayPal configuration and try again'
      });
    }

    // Handle general errors
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create subscription plan',
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
