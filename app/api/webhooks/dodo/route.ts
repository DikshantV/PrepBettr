// app/api/webhooks/dodo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyDodoWebhook } from '@/lib/dodo-webhook';
import { subscriptionService } from '@/lib/services/subscription-service';
import { licenseKeyService } from '@/lib/services/license-key-service';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { PlanType, PlanStatus } from '@/types/subscription';

interface PaymentIntentMetadata {
  userId: string;
  plan: string;
  [key: string]: unknown; // For any additional properties
}

interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  current_period_end?: number; // Optional for payment intents
  metadata?: PaymentIntentMetadata;
  // Add other relevant fields based on your payment provider's API
}

interface SubscriptionData {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
  plan?: {
    id: string;
    nickname?: string;
  };
  metadata?: PaymentIntentMetadata;
}

interface WebhookPayload<T = unknown> {
  id: string; // Event ID for idempotency
  type: string;
  data: {
    object: T;
  };
  created?: number; // Event creation timestamp
  // Add other relevant fields from the webhook payload
}

export async function POST(request: NextRequest) {
    try {
        const webhookSecret = process.env.DODO_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error('DODO_WEBHOOK_SECRET is not set');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        // Read the raw body
        const body = await request.text();

        // Verify the webhook signature
        const isValid = verifyDodoWebhook(request, body, webhookSecret);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid signature' },
                { status: 401 }
            );
        }

        // Parse the webhook payload
        const payload = JSON.parse(body) as WebhookPayload<any>;
        const eventType = payload.type;
        const eventId = payload.id;
        const data = payload.data?.object;

        console.log(`Received webhook event: ${eventType} (ID: ${eventId})`, data);

        // Check for idempotency - ensure we haven't processed this event before
        const existingEvent = await subscriptionService.getEventById(eventId);
        if (existingEvent) {
            console.log(`Event ${eventId} already processed, returning success`);
            return NextResponse.json({ received: true, duplicate: true });
        }

        // Handle different webhook events
        switch (eventType) {
            case 'payment_intent.succeeded':
                await handleSuccessfulPayment(data as PaymentIntent, body, eventId);
                break;

            case 'payment_intent.payment_failed':
                await handleFailedPayment(data as PaymentIntent, body, eventId);
                break;

            case 'subscription.created':
            case 'subscription.updated':
            case 'subscription.canceled':
                await handleSubscriptionEvent(eventType, data as SubscriptionData, body, eventId);
                break;

            default:
                console.log(`Unhandled event type: ${eventType}`);
                // Still log unhandled events for tracking
                await subscriptionService.logSubscriptionEvent({
                    eventId,
                    userId: 'unknown',
                    eventType,
                    rawWebhookData: JSON.parse(body),
                    parsedData: {},
                    processed: false
                });
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook handler failed', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 400 }
        );
    }
}

async function handleSuccessfulPayment(paymentIntent: PaymentIntent, rawBody: string, eventId: string) {
    console.log('Payment succeeded:', paymentIntent.id);

    if (!paymentIntent.metadata || !paymentIntent.metadata.userId) {
        console.error('Missing user ID in metadata');
        await subscriptionService.logSubscriptionEvent({
            eventId,
            userId: 'unknown',
            eventType: 'payment_intent.succeeded',
            rawWebhookData: JSON.parse(rawBody),
            parsedData: { error: 'Missing user ID in metadata' },
            processed: false
        });
        return;
    }

    const userId = paymentIntent.metadata.userId;
    const plan = paymentIntent.metadata.plan as PlanType;

    try {
        // Get user data for email and name
        const db = getAdminFirestore();
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error('User not found');
        }
        
        const userData = userDoc.data();
        const userEmail = userData?.email;
        const userName = userData?.name;
        
        if (!userEmail) {
            throw new Error('User email not found');
        }

        // Generate license key instead of direct subscription
        const licenseResult = await licenseKeyService.generateLicenseKey(
            userId,
            userEmail,
            1, // activation limit
            365 // expires in 1 year
        );

        if (!licenseResult.success || !licenseResult.licenseKey) {
            throw new Error('Failed to generate license key: ' + licenseResult.error);
        }

        // Send license key via email
        await licenseKeyService.sendLicenseKeyEmail(
            userEmail,
            licenseResult.licenseKey,
            userName
        );

        console.log(`License key generated and sent for user ${userId}: ${licenseResult.licenseKey}`);

        // Log successful event
        await subscriptionService.logSubscriptionEvent({
            eventId,
            userId,
            eventType: 'payment_intent.succeeded',
            rawWebhookData: JSON.parse(rawBody),
            parsedData: {
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                plan: plan,
                status: 'active'
            },
            processed: true
        });
    } catch (error) {
        console.error('Error processing successful payment:', error);
        await subscriptionService.logSubscriptionEvent({
            eventId,
            userId,
            eventType: 'payment_intent.succeeded',
            rawWebhookData: JSON.parse(rawBody),
            parsedData: {
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            processed: false
        });
        throw error;
    }
}

async function handleFailedPayment(paymentIntent: PaymentIntent, rawBody: string, eventId: string) {
    console.log('Payment failed:', paymentIntent.id);

    const userId = paymentIntent.metadata?.userId;
    console.log(`Payment failed for user ID: ${userId}`);

    // Log failure event (Not updating subscription in failed event)
    await subscriptionService.logSubscriptionEvent({
        eventId,
        userId: userId || 'unknown',
        eventType: 'payment_intent.payment_failed',
        rawWebhookData: JSON.parse(rawBody),
        parsedData: {
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
        },
        processed: true // We successfully handled the failure
    });
}

async function handleSubscriptionEvent(eventType: string, subscription: SubscriptionData, rawBody: string, eventId: string) {
    const { id, customer, status, current_period_end, plan, metadata } = subscription;
    const userId = metadata?.userId;
    
    if (!userId) {
        console.error('User ID not found in subscription metadata');
        await subscriptionService.logSubscriptionEvent({
            eventId,
            userId: 'unknown',
            eventType,
            rawWebhookData: JSON.parse(rawBody),
            parsedData: { error: 'Missing user ID in subscription metadata' },
            processed: false
        });
        return;
    }

    console.log(`Processing ${eventType} event for user: ${userId}`);

    try {
        // Get current user subscription for comparison
        const currentSubscription = await subscriptionService.getUserSubscription(userId);
        const currentPlan = currentSubscription?.plan || 'free';
        
        let planType: PlanType;
        let planStatus: PlanStatus;
        
        // Handle different subscription events
        switch (eventType) {
            case 'subscription.created':
            case 'subscription.updated':
                planType = plan?.nickname as PlanType || 'free';
                planStatus = status as PlanStatus;
                
                // Check if this is an upgrade/downgrade and reset counters
                const shouldResetCounters = currentPlan !== planType;
                
                await subscriptionService.updateUserSubscription(userId, {
                    plan: planType,
                    planStatus,
                    currentPeriodEnd: new Date(current_period_end * 1000),
                    dodoCustomerId: customer,
                    dodoSubscriptionId: id
                });
                
                // Reset usage counters on plan change (upgrade/downgrade)
                if (shouldResetCounters) {
                    console.log(`Plan changed from ${currentPlan} to ${planType}, resetting counters`);
                    await subscriptionService.resetUsageCounters(userId);
                }
                
                console.log(`Subscription ${eventType} completed for user ${userId}: ${planType}`);
                break;
                
            case 'subscription.canceled':
                // Set to free plan and canceled status
                planType = 'free';
                planStatus = 'canceled';
                
                await subscriptionService.updateUserSubscription(userId, {
                    plan: planType,
                    planStatus,
                    currentPeriodEnd: new Date(current_period_end * 1000),
                    dodoCustomerId: customer,
                    dodoSubscriptionId: id
                });
                
                // Reset to free plan limits
                console.log(`Subscription canceled for user ${userId}, resetting to free plan limits`);
                await subscriptionService.resetUsageCounters(userId);
                
                console.log(`Subscription canceled for user ${userId}`);
                break;
                
            default:
                throw new Error(`Unhandled subscription event type: ${eventType}`);
        }

        // Log successful subscription event
        await subscriptionService.logSubscriptionEvent({
            eventId,
            userId,
            eventType,
            rawWebhookData: JSON.parse(rawBody),
            parsedData: {
                customerId: customer,
                subscriptionId: id,
                plan: planType,
                status: planStatus,
                currentPeriodEnd: new Date(current_period_end * 1000),
                previousPlan: currentPlan
            },
            processed: true
        });
        
    } catch (error) {
        console.error(`Error processing subscription event ${eventType}:`, error);
        await subscriptionService.logSubscriptionEvent({
            eventId,
            userId,
            eventType,
            rawWebhookData: JSON.parse(rawBody),
            parsedData: {
                customerId: customer,
                subscriptionId: id,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            processed: false
        });
        throw error;
    }
}
