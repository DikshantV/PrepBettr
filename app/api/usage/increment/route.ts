// app/api/usage/increment/route.ts

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

    // Try to increment usage
    const incremented = await subscriptionService.incrementUsage(userId, feature);
    
    if (!incremented) {
      // Get current usage to show in response
      const usage = await subscriptionService.getUserUsage(userId);
      const currentUsage = usage?.[feature];
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Usage limit reached',
          feature,
          currentUsage
        },
        { status: 403 }
      );
    }

    // Get updated usage stats
    const usage = await subscriptionService.getUserUsage(userId);
    const subscription = await subscriptionService.getUserSubscription(userId);

    return NextResponse.json({
      success: true,
      message: 'Usage incremented successfully',
      feature,
      currentUsage: usage?.[feature] || { count: 1, limit: 0, updatedAt: new Date() },
      plan: subscription?.plan || 'free'
    });

  } catch (error) {
    console.error('Usage increment error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      // User's usage counters haven't been initialized
      return NextResponse.json(
        { 
          error: 'Usage counters not initialized',
          details: 'Please contact support'
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
