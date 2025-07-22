// app/api/payments/create-checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { subscriptionService } from '@/lib/services/subscription-service';
import { DodoPayments } from 'dodopayments';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { uid } = body;

    // Validate uid parameter
    if (!uid) {
      return NextResponse.json(
        { error: 'Missing required parameter: uid' },
        { status: 400 }
      );
    }

    // Verify the uid matches the authenticated user
    if (uid !== user.id) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Initialize Dodo SDK
    const dodoApiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!dodoApiKey) {
      console.error('DODO_PAYMENTS_API_KEY is not set');
      return NextResponse.json(
        { error: 'Payment service configuration error' },
        { status: 500 }
      );
    }

    const dodo = new DodoPayments({ bearerToken: dodoApiKey });

    // Get user's current subscription to check for existing customer
    const currentSubscription = await subscriptionService.getUserSubscription(uid);
    let dodoCustomerId = currentSubscription?.dodoCustomerId;

    // Create or get Dodo customer
    if (!dodoCustomerId) {
      try {
        const customer = await dodo.customers.create({
          email: user.email,
          name: user.name || user.email.split('@')[0]
        });
        
        dodoCustomerId = customer.customer_id;
        
        // Store the customer ID in user's subscription record
        await subscriptionService.updateUserSubscription(uid, {
          dodoCustomerId: dodoCustomerId
        });
        
        console.log(`Created new Dodo customer: ${dodoCustomerId} for user: ${uid}`);
      } catch (error) {
        console.error('Error creating Dodo customer:', error);
        return NextResponse.json(
          { error: 'Failed to create customer account' },
          { status: 500 }
        );
      }
    }

    // Create subscription with payment link
    const baseUrl = process.env.NEXTAUTH_URL || request.url.replace('/api/payments/create-checkout', '');
    const successUrl = `${baseUrl}/dashboard?payment=success`;
    const cancelUrl = `${baseUrl}/pricing?payment=cancelled`;

    try {
      // Get the premium product ID from environment
      const premiumProductId = process.env.DODO_PREMIUM_PRODUCT_ID;
      if (!premiumProductId) {
        console.error('DODO_PREMIUM_PRODUCT_ID is not set');
        return NextResponse.json(
          { error: 'Product configuration error' },
          { status: 500 }
        );
      }

      const subscription = await dodo.subscriptions.create({
        customer: {
          customer_id: dodoCustomerId
        } as any,
        product_id: premiumProductId,
        quantity: 1,
        payment_link: true,
        return_url: successUrl,
        metadata: {
          uid: uid,
          plan: 'premium',
          source: 'checkout_flow'
        },
        billing: {
          // Default billing address - can be updated by customer during checkout
          street: '123 Default St',
          city: 'Default City',
          state: 'CA',
          zipcode: '90210',
          country: 'US' // Default to US, customer can change during checkout
        }
      });

      console.log(`Created subscription checkout for user ${uid}: ${subscription.payment_link}`);

      return NextResponse.json({
        checkoutUrl: subscription.payment_link,
        subscriptionId: subscription.subscription_id
      });

    } catch (error) {
      console.error('Error creating subscription checkout:', error);
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Create checkout error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
