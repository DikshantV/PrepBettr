// app/api/payments/portal-link/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { subscriptionService } from '@/lib/services/subscription-service';
import { DodoPayments } from 'dodopayments';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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

    // Get user's subscription to get customer ID
    const currentSubscription = await subscriptionService.getUserSubscription(user.id);
    let dodoCustomerId = currentSubscription?.dodoCustomerId;

    // If no customer ID exists, create one first
    if (!dodoCustomerId) {
      try {
        const customer = await dodo.customers.create({
          email: user.email,
          name: user.name || user.email.split('@')[0]
        });
        
        dodoCustomerId = customer.customer_id;
        
        // Store the customer ID in user's subscription record
        await subscriptionService.updateUserSubscription(user.id, {
          dodoCustomerId: dodoCustomerId
        });
        
        console.log(`Created new Dodo customer for portal access: ${dodoCustomerId} for user: ${user.id}`);
      } catch (error) {
        console.error('Error creating Dodo customer for portal:', error);
        return NextResponse.json(
          { error: 'Failed to create customer account for portal access' },
          { status: 500 }
        );
      }
    }

    // Create customer portal session
    const baseUrl = process.env.NEXTAUTH_URL || request.url.replace('/api/payments/portal-link', '');
    const returnUrl = `${baseUrl}/dashboard`;

    try {
      const portalSession = await dodo.customers.customerPortal.create(dodoCustomerId, {
        send_email: false
      });

      console.log(`Created portal session for user ${user.id}: ${portalSession.link}`);

      return NextResponse.json({
        portalUrl: portalSession.link
      });

    } catch (error) {
      console.error('Error creating portal session:', error);
      return NextResponse.json(
        { error: 'Failed to create customer portal session' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Portal link error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
