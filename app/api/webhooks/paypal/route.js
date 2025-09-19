// app/api/webhooks/paypal/route.js

import { NextRequest, NextResponse } from 'next/server';
import paypalClient from '@/lib/paypal-client';
import { sandboxConfig } from '@/lib/paypal-sandbox-config';

/**
 * PayPal Webhook Handler
 * Processes subscription events from PayPal and updates local subscription state
 */

// Enable dynamic route handling
export const dynamic = 'force-dynamic';

// Store webhook payloads for testing and replay
const webhookStore = new Map();

export async function POST(request) {
  try {
    console.log('PayPal webhook received');
    
    // Parse the request body
    const body = await request.text();
    const webhookEvent = JSON.parse(body);
    
    // Log the webhook event for debugging
    console.log('Webhook Event:', JSON.stringify(webhookEvent, null, 2));
    
    // Store webhook payload for testing
    if (sandboxConfig.isTestEnvironment()) {
      webhookStore.set(webhookEvent.id, {
        event: webhookEvent,
        receivedAt: new Date().toISOString(),
        headers: Object.fromEntries(request.headers.entries())
      });
    }
    
    // Verify webhook signature in production/sandbox
    const isSignatureValid = await verifyWebhookSignature(request, body, webhookEvent);
    if (!isSignatureValid && !sandboxConfig.isTestEnvironment()) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Process the webhook event
    const result = await processWebhookEvent(webhookEvent);
    
    // Return success response
    return NextResponse.json({ 
      status: 'success', 
      eventId: webhookEvent.id,
      processed: result
    }, { status: 200 });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Return error response but don't fail webhook
    // PayPal will retry if we return 4xx/5xx
    return NextResponse.json({ 
      error: error.message,
      status: 'error'
    }, { status: 200 }); // Return 200 to prevent retries for now
  }
}

/**
 * Verify PayPal webhook signature
 */
async function verifyWebhookSignature(request, body, webhookEvent) {
  try {
    // Skip verification in test environment without webhook ID
    if (sandboxConfig.isTestEnvironment() && !sandboxConfig.webhookId) {
      console.log('Skipping webhook signature verification in test environment');
      return true;
    }
    
    // Create a mock request object for paypal-client verification
    const mockRequest = {
      headers: Object.fromEntries(request.headers.entries()),
      body: webhookEvent
    };
    
    const isValid = await paypalClient.verifyWebhookSignature(mockRequest, sandboxConfig.webhookId);
    console.log('Webhook signature verification:', isValid ? 'PASSED' : 'FAILED');
    
    return isValid;
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

/**
 * Process individual webhook events
 */
async function processWebhookEvent(webhookEvent) {
  const eventType = webhookEvent.event_type;
  const resource = webhookEvent.resource;
  
  console.log(`Processing webhook event: ${eventType}`);
  
  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.CREATED':
        return await handleSubscriptionCreated(resource);
        
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        return await handleSubscriptionActivated(resource);
        
      case 'BILLING.SUBSCRIPTION.UPDATED':
        return await handleSubscriptionUpdated(resource);
        
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        return await handleSubscriptionCancelled(resource);
        
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        return await handleSubscriptionSuspended(resource);
        
      case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
        return await handleSubscriptionReactivated(resource);
        
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        return await handleSubscriptionExpired(resource);
        
      case 'PAYMENT.SALE.COMPLETED':
        return await handlePaymentCompleted(resource);
        
      case 'PAYMENT.SALE.DENIED':
        return await handlePaymentDenied(resource);
        
      case 'PAYMENT.CAPTURE.COMPLETED':
        return await handlePaymentCaptureCompleted(resource);
        
      case 'PAYMENT.CAPTURE.DENIED':
        return await handlePaymentCaptureDenied(resource);
        
      case 'PAYMENT.CAPTURE.REFUNDED':
        return await handlePaymentRefunded(resource);
        
      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
        return { handled: false, eventType };
    }
  } catch (error) {
    console.error(`Error processing ${eventType}:`, error);
    throw error;
  }
}

/**
 * Webhook event handlers
 */

async function handleSubscriptionCreated(subscription) {
  console.log('Subscription created:', subscription.id);
  
  // TODO: Store subscription in database
  // await storeSubscription({
  //   paypalSubscriptionId: subscription.id,
  //   status: 'created',
  //   planId: subscription.plan_id,
  //   subscriberEmail: subscription.subscriber?.email_address,
  //   createTime: subscription.create_time,
  //   startTime: subscription.start_time
  // });
  
  // TODO: Send welcome email
  // await sendWelcomeEmail(subscription.subscriber?.email_address);
  
  return { 
    action: 'subscription_created', 
    subscriptionId: subscription.id,
    status: 'pending_approval'
  };
}

async function handleSubscriptionActivated(subscription) {
  console.log('Subscription activated:', subscription.id);
  
  // TODO: Update subscription status in database
  // await updateSubscription(subscription.id, {
  //   status: 'active',
  //   activatedAt: new Date(),
  //   nextBillingTime: subscription.billing_info?.next_billing_time
  // });
  
  // TODO: Issue/activate license key based on user rules
  // const user = await getUserByEmail(subscription.subscriber?.email_address);
  // if (user) {
  //   await issueLicenseKey(user.id, subscription.plan_id);
  // }
  
  // TODO: Send activation confirmation email
  // await sendActivationEmail(subscription.subscriber?.email_address, subscription);
  
  return { 
    action: 'subscription_activated', 
    subscriptionId: subscription.id,
    status: 'active'
  };
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);
  
  // TODO: Update subscription details in database
  // await updateSubscription(subscription.id, {
  //   planId: subscription.plan_id,
  //   status: subscription.status,
  //   nextBillingTime: subscription.billing_info?.next_billing_time,
  //   updatedAt: new Date()
  // });
  
  return { 
    action: 'subscription_updated', 
    subscriptionId: subscription.id,
    status: subscription.status
  };
}

async function handleSubscriptionCancelled(subscription) {
  console.log('Subscription cancelled:', subscription.id);
  
  // TODO: Update subscription status and handle cancellation
  // await updateSubscription(subscription.id, {
  //   status: 'cancelled',
  //   cancelledAt: new Date(),
  //   cancelReason: subscription.status_change_note
  // });
  
  // TODO: Suspend license key based on user rules
  // const dbSubscription = await getSubscription(subscription.id);
  // if (dbSubscription?.userId) {
  //   await suspendLicenseKey(dbSubscription.userId);
  // }
  
  // TODO: Send cancellation confirmation email
  // await sendCancellationEmail(subscription.subscriber?.email_address, subscription);
  
  return { 
    action: 'subscription_cancelled', 
    subscriptionId: subscription.id,
    status: 'cancelled'
  };
}

async function handleSubscriptionSuspended(subscription) {
  console.log('Subscription suspended:', subscription.id);
  
  // TODO: Suspend subscription access
  // await updateSubscription(subscription.id, {
  //   status: 'suspended',
  //   suspendedAt: new Date(),
  //   suspensionReason: subscription.status_change_note
  // });
  
  // TODO: Suspend license key
  // const dbSubscription = await getSubscription(subscription.id);
  // if (dbSubscription?.userId) {
  //   await suspendLicenseKey(dbSubscription.userId);
  // }
  
  return { 
    action: 'subscription_suspended', 
    subscriptionId: subscription.id,
    status: 'suspended'
  };
}

async function handleSubscriptionReactivated(subscription) {
  console.log('Subscription reactivated:', subscription.id);
  
  // TODO: Reactivate subscription
  // await updateSubscription(subscription.id, {
  //   status: 'active',
  //   reactivatedAt: new Date(),
  //   nextBillingTime: subscription.billing_info?.next_billing_time
  // });
  
  // TODO: Reactivate license key
  // const dbSubscription = await getSubscription(subscription.id);
  // if (dbSubscription?.userId) {
  //   await reactivateLicenseKey(dbSubscription.userId);
  // }
  
  return { 
    action: 'subscription_reactivated', 
    subscriptionId: subscription.id,
    status: 'active'
  };
}

async function handleSubscriptionExpired(subscription) {
  console.log('Subscription expired:', subscription.id);
  
  // TODO: Handle subscription expiration
  // await updateSubscription(subscription.id, {
  //   status: 'expired',
  //   expiredAt: new Date()
  // });
  
  // TODO: Suspend license key
  // const dbSubscription = await getSubscription(subscription.id);
  // if (dbSubscription?.userId) {
  //   await suspendLicenseKey(dbSubscription.userId);
  // }
  
  return { 
    action: 'subscription_expired', 
    subscriptionId: subscription.id,
    status: 'expired'
  };
}

async function handlePaymentCompleted(payment) {
  console.log('Payment completed:', payment.id);
  
  // TODO: Record successful payment
  // await recordPayment({
  //   paymentId: payment.id,
  //   subscriptionId: payment.billing_agreement_id,
  //   amount: payment.amount?.total,
  //   currency: payment.amount?.currency,
  //   status: 'completed',
  //   completedAt: new Date()
  // });
  
  return { 
    action: 'payment_completed', 
    paymentId: payment.id,
    amount: payment.amount?.total
  };
}

async function handlePaymentDenied(payment) {
  console.log('Payment denied:', payment.id);
  
  // TODO: Handle payment failure
  // await recordPayment({
  //   paymentId: payment.id,
  //   subscriptionId: payment.billing_agreement_id,
  //   status: 'failed',
  //   failureReason: payment.reason_code,
  //   failedAt: new Date()
  // });
  
  // TODO: Send payment failure notification
  // await sendPaymentFailureNotification(payment.billing_agreement_id);
  
  return { 
    action: 'payment_denied', 
    paymentId: payment.id,
    reason: payment.reason_code
  };
}

async function handlePaymentCaptureCompleted(payment) {
  console.log('Payment capture completed:', payment.id);
  
  return { 
    action: 'payment_capture_completed', 
    paymentId: payment.id
  };
}

async function handlePaymentCaptureDenied(payment) {
  console.log('Payment capture denied:', payment.id);
  
  return { 
    action: 'payment_capture_denied', 
    paymentId: payment.id
  };
}

async function handlePaymentRefunded(payment) {
  console.log('Payment refunded:', payment.id);
  
  // TODO: Handle refund
  // await recordRefund({
  //   paymentId: payment.id,
  //   refundAmount: payment.amount?.total,
  //   refundedAt: new Date()
  // });
  
  return { 
    action: 'payment_refunded', 
    paymentId: payment.id,
    refundAmount: payment.amount?.total
  };
}

/**
 * Development/testing endpoints
 */

// GET endpoint for webhook testing
export async function GET(request) {
  if (!sandboxConfig.isTestEnvironment()) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }
  
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  
  if (eventId) {
    const storedEvent = webhookStore.get(eventId);
    return NextResponse.json(storedEvent || { error: 'Event not found' });
  }
  
  // Return all stored events
  const allEvents = Array.from(webhookStore.entries()).map(([id, data]) => ({
    id,
    ...data
  }));
  
  return NextResponse.json({ 
    events: allEvents,
    count: allEvents.length,
    sandbox: true
  });
}

// Export webhook store for testing
export { webhookStore };