// app/api/license/validate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { licenseKeyService } from '@/lib/services/license-key-service';
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

    // Validate license key
    const validationResult = await licenseKeyService.validateLicenseKey(licenseKey);

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: validationResult.error || 'Invalid license key'
        },
        { status: 400 }
      );
    }

    // Get license key details
    const licenseDetails = await licenseKeyService.getLicenseKeyDetails(licenseKey);

    return NextResponse.json({
      success: true,
      valid: true,
      licenseKey: {
        status: licenseDetails?.status,
        activatedAt: licenseDetails?.activatedAt,
        expiresAt: licenseDetails?.expiresAt,
        activationCount: licenseDetails?.activationCount,
        activationLimit: licenseDetails?.activationLimit
      }
    });

  } catch (error) {
    console.error('License validation error:', error);
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

export async function GET(request: NextRequest) {
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

    // Get user's current license key status from subscription service
    const subscriptionStatus = await subscriptionService.getUserSubscriptionStatus(user.id);

    return NextResponse.json({
      success: true,
      hasLicenseKey: !!subscriptionStatus.licenseKey,
      licenseKey: subscriptionStatus.licenseKey,
      licenseKeyStatus: subscriptionStatus.licenseKeyStatus,
      hasPremium: subscriptionStatus.hasPremium,
      premiumSource: subscriptionStatus.premiumSource
    });

  } catch (error) {
    console.error('License status error:', error);
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
