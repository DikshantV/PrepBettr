// pages/api/paypal/webhook.js

import paypalClient from '../../../lib/paypal-client.js';

/**
 * PayPal Webhook Handler API Route
 * Handles PayPal subscription lifecycle events
 * 
 * @param {NextApiRequest} req - The request object
 * @param {NextApiResponse} res - The response object
 */
export default async function handler(req, res) {
  // Only allow POST requests for webhooks
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Webhooks only accept POST requests'
    });
  }

  try {
    const webhookEvent = req.body;
    const headers = req.headers;

    // Log incoming webhook for debugging
    console.log('PayPal webhook received:', {
      event_type: webhookEvent.event_type,
      resource_type: webhookEvent.resource_type,
      summary: webhookEvent.summary
    });

    // Verify webhook signature (optional but recommended)
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    
    if (webhookId) {
      const isValid = await paypalClient.verifyWebhookSignature(req, webhookId);
      
      if (!isValid) {
        console.error('Invalid webhook signature');
        return res.status(401).json({
          error: 'Invalid signature',
          message: 'Webhook signature verification failed'
        });
      }
    }

    // Extract event information
    const {
      event_type,
      resource_type,
      resource,
      create_time,
      id: event_id
    } = webhookEvent;

    // Handle different webhook events
    let processResult = null;

    switch (event_type) {
      case 'BILLING.SUBSCRIPTION.CREATED':
        processResult = await handleSubscriptionCreated(resource, event_id);
        break;

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        processResult = await handleSubscriptionActivated(resource, event_id);
        break;

      case 'BILLING.SUBSCRIPTION.UPDATED':
        processResult = await handleSubscriptionUpdated(resource, event_id);
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        processResult = await handleSubscriptionCancelled(resource, event_id);
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        processResult = await handleSubscriptionSuspended(resource, event_id);
        break;

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        processResult = await handlePaymentFailed(resource, event_id);
        break;

      case 'BILLING.SUBSCRIPTION.RENEWAL.SUCCEEDED':
        processResult = await handleRenewalSucceeded(resource, event_id);
        break;

      case 'BILLING.SUBSCRIPTION.EXPIRED':
        processResult = await handleSubscriptionExpired(resource, event_id);
        break;

      default:
        console.log(`Unhandled webhook event type: ${event_type}`);
        processResult = { handled: false, message: 'Event type not handled' };
    }

    // Log the processing result
    console.log(`Webhook ${event_type} processed:`, processResult);

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      event_type,
      event_id,
      processed: processResult?.handled || false,
      details: processResult?.message || 'Event processed'
    });

  } catch (error) {
    console.error('Error processing PayPal webhook:', error);

    // Return error response
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : 'Internal error'
    });
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(resource, eventId) {
  try {
    console.log(`Processing subscription created: ${resource.id}`);

    // TODO: Save initial subscription record to database
    /*
    const subscriptionData = {
      paypalSubscriptionId: resource.id,
      paypalPlanId: resource.plan_id,
      status: resource.status,
      subscriberEmail: resource.subscriber?.email_address,
      createTime: resource.create_time,
      provider: 'paypal',
      eventId
    };
    
    await createUserSubscription(subscriptionData);
    */

    return {
      handled: true,
      message: `Subscription ${resource.id} created successfully`
    };
  } catch (error) {
    console.error('Error handling subscription created:', error);
    throw error;
  }
}

/**
 * Handle subscription activated event
 */
async function handleSubscriptionActivated(resource, eventId) {
  try {
    console.log(`Processing subscription activated: ${resource.id}`);

    // TODO: Update subscription status and grant access
    /*
    await updateSubscriptionStatus(resource.id, 'ACTIVE', {
      startTime: resource.start_time,
      nextBillingTime: resource.billing_info?.next_billing_time,
      eventId
    });
    
    // Grant premium access to user
    await grantPremiumAccess(resource.subscriber?.email_address);
    
    // Send welcome email
    await sendWelcomeEmail(resource.subscriber?.email_address, resource.plan_id);
    */

    return {
      handled: true,
      message: `Subscription ${resource.id} activated successfully`
    };
  } catch (error) {
    console.error('Error handling subscription activated:', error);
    throw error;
  }
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(resource, eventId) {
  try {
    console.log(`Processing subscription updated: ${resource.id}`);

    // TODO: Update subscription details
    /*
    await updateSubscriptionDetails(resource.id, {
      status: resource.status,
      planId: resource.plan_id,
      updateTime: resource.update_time,
      billingInfo: resource.billing_info,
      eventId
    });
    */

    return {
      handled: true,
      message: `Subscription ${resource.id} updated successfully`
    };
  } catch (error) {
    console.error('Error handling subscription updated:', error);
    throw error;
  }
}

/**
 * Handle subscription cancelled event
 */
async function handleSubscriptionCancelled(resource, eventId) {
  try {
    console.log(`Processing subscription cancelled: ${resource.id}`);

    // TODO: Update subscription status and revoke access
    /*
    await updateSubscriptionStatus(resource.id, 'CANCELLED', {
      cancelTime: resource.update_time,
      reason: resource.status_update_time,
      eventId
    });
    
    // Revoke premium access
    await revokePremiumAccess(resource.subscriber?.email_address);
    
    // Send cancellation confirmation
    await sendCancellationEmail(resource.subscriber?.email_address);
    */

    return {
      handled: true,
      message: `Subscription ${resource.id} cancelled successfully`
    };
  } catch (error) {
    console.error('Error handling subscription cancelled:', error);
    throw error;
  }
}

/**
 * Handle subscription suspended event
 */
async function handleSubscriptionSuspended(resource, eventId) {
  try {
    console.log(`Processing subscription suspended: ${resource.id}`);

    // TODO: Suspend user access
    /*
    await updateSubscriptionStatus(resource.id, 'SUSPENDED', {
      suspendTime: resource.update_time,
      eventId
    });
    
    // Temporarily revoke access
    await suspendAccess(resource.subscriber?.email_address);
    */

    return {
      handled: true,
      message: `Subscription ${resource.id} suspended successfully`
    };
  } catch (error) {
    console.error('Error handling subscription suspended:', error);
    throw error;
  }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(resource, eventId) {
  try {
    console.log(`Processing payment failed for subscription: ${resource.id}`);

    // TODO: Handle payment failure
    /*
    await recordPaymentFailure(resource.id, {
      failureTime: resource.update_time,
      failureReason: resource.status_change_note,
      eventId
    });
    
    // Send payment failure notification
    await sendPaymentFailureEmail(resource.subscriber?.email_address);
    */

    return {
      handled: true,
      message: `Payment failure processed for subscription ${resource.id}`
    };
  } catch (error) {
    console.error('Error handling payment failed:', error);
    throw error;
  }
}

/**
 * Handle renewal succeeded event
 */
async function handleRenewalSucceeded(resource, eventId) {
  try {
    console.log(`Processing renewal succeeded for subscription: ${resource.id}`);

    // TODO: Process successful renewal
    /*
    await recordSuccessfulPayment(resource.id, {
      renewalTime: resource.update_time,
      nextBillingTime: resource.billing_info?.next_billing_time,
      lastPaymentAmount: resource.billing_info?.last_payment?.amount,
      eventId
    });
    
    // Ensure continued access
    await maintainPremiumAccess(resource.subscriber?.email_address);
    */

    return {
      handled: true,
      message: `Renewal processed successfully for subscription ${resource.id}`
    };
  } catch (error) {
    console.error('Error handling renewal succeeded:', error);
    throw error;
  }
}

/**
 * Handle subscription expired event
 */
async function handleSubscriptionExpired(resource, eventId) {
  try {
    console.log(`Processing subscription expired: ${resource.id}`);

    // TODO: Handle subscription expiry
    /*
    await updateSubscriptionStatus(resource.id, 'EXPIRED', {
      expireTime: resource.update_time,
      eventId
    });
    
    // Revoke access
    await revokePremiumAccess(resource.subscriber?.email_address);
    
    // Send expiry notification
    await sendExpiryEmail(resource.subscriber?.email_address);
    */

    return {
      handled: true,
      message: `Subscription ${resource.id} expired successfully`
    };
  } catch (error) {
    console.error('Error handling subscription expired:', error);
    throw error;
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
