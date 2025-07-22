// app/api/usage/check/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { subscriptionService } from '@/lib/services/subscription-service';

export async function POST(req: NextRequest) {
  try {
    // Get session cookie from request
    const sessionCookie = req.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the session token
    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid session',
          details: verificationResult.error 
        },
        { status: 401 }
      );
    }

    const userId = verificationResult.decodedToken.uid;
    const { feature } = await req.json();

    if (!feature || !['interviews', 'resumeTailor', 'autoApply'].includes(feature)) {
      return NextResponse.json(
        { error: 'Invalid feature specified' },
        { status: 400 }
      );
    }

    // Check if user can use the feature
    const canUse = await subscriptionService.canUseFeature(userId, feature);
    
    // Get current usage stats
    const usage = await subscriptionService.getUserUsage(userId);
    const subscription = await subscriptionService.getUserSubscription(userId);

    return NextResponse.json({
      success: true,
      canUse,
      feature,
      currentUsage: usage?.[feature] || { count: 0, limit: 0, updatedAt: new Date() },
      plan: subscription?.plan || 'free'
    });

  } catch (error) {
    console.error('Usage check error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
