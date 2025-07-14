// app/api/webhooks/dodo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyDodoWebhook } from '@/lib/dodo-webhook';

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
  metadata?: PaymentIntentMetadata;
  // Add other relevant fields based on your payment provider's API
}

interface WebhookPayload<T = unknown> {
  type: string;
  data: {
    object: T;
  };
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
        const payload = JSON.parse(body) as WebhookPayload<PaymentIntent>;
        const eventType = payload.type;
        const data = payload.data?.object;

        console.log(`Received webhook event: ${eventType}`, data);

        // Handle different webhook events
        switch (eventType) {
            case 'payment_intent.succeeded':
                await handleSuccessfulPayment(data);
                break;

            case 'payment_intent.payment_failed':
                await handleFailedPayment(data);
                break;

            default:
                console.log(`Unhandled event type: ${eventType}`);
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

async function handleSuccessfulPayment(paymentIntent: PaymentIntent) {
    console.log('Payment succeeded:', paymentIntent.id);

    // TODO: Implement your business logic here
    // Example:
    // - Update database
    // - Send confirmation email
    // - Grant access to premium features
}

async function handleFailedPayment(paymentIntent: PaymentIntent) {
    console.log('Payment failed:', paymentIntent.id);

    // TODO: Implement your failure handling logic
    // Example:
    // - Notify the user
    // - Log the failure for review
}