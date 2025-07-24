// app/api/license/activate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { licenseKeyService } from '@/lib/services/license-key-service';
import { emailVerificationService } from '@/lib/services/email-verification-service';
import { subscriptionService } from '@/lib/services/subscription-service';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required' 
        },
        { status: 401 }
      );
    }

    // Parse request body
    const { licenseKey } = await request.json();

    if (!licenseKey || typeof licenseKey !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'License key is required'
        },
        { status: 400 }
      );
    }

    // Validate license key format (basic check)
    if (licenseKey.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid license key format'
        },
        { status: 400 }
      );
    }

    // Check email verification first
    const isEmailVerified = await emailVerificationService.isEmailVerified(user.id);
    if (!isEmailVerified) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email verification required',
          message: 'Please verify your email address before activating a license key'
        },
        { status: 403 }
      );
    }

    // Attempt to activate the license key
    const activationResult = await licenseKeyService.activateLicenseKey(user.id, licenseKey);

    if (!activationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: activationResult.error || 'Failed to activate license key'
        },
        { status: 400 }
      );
    }

    // Reset usage counters to premium limits
    await subscriptionService.resetUsageCounters(user.id);

    console.log(`License key activated successfully for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'License key activated successfully! You now have premium access.',
      plan: 'premium'
    });

  } catch (error) {
    console.error('License activation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
