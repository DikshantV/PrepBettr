import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { subscriptionService } from '@/lib/services/subscription-service';

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

    // Get user's subscription information
    const subscription = await subscriptionService.getUserSubscription(user.id);

    if (!subscription) {
      // If no subscription found, return default free subscription
      return NextResponse.json({
        subscription: {
          plan: 'free',
          planStatus: 'active',
          currentPeriodEnd: null,
          dodoCustomerId: null,
          dodoSubscriptionId: null,
        }
      });
    }

    return NextResponse.json({
      subscription
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
