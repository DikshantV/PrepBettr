// app/api/auth/verify-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { emailVerificationService } from '@/lib/services/email-verification-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(
        new URL('/auth/verification-failed?error=missing-token', request.url)
      );
    }

    // Verify the email using the token
    const verificationResult = await emailVerificationService.verifyEmail(token);

    if (!verificationResult.success) {
      const errorParam = encodeURIComponent(verificationResult.error || 'verification-failed');
      return NextResponse.redirect(
        new URL(`/auth/verification-failed?error=${errorParam}`, request.url)
      );
    }

    console.log(`Email verified successfully for user ${verificationResult.userId}`);

    // Redirect to success page
    return NextResponse.redirect(
      new URL('/auth/verification-success', request.url)
    );

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.redirect(
      new URL('/auth/verification-failed?error=server-error', request.url)
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Verification token is required'
        },
        { status: 400 }
      );
    }

    // Verify the email using the token
    const verificationResult = await emailVerificationService.verifyEmail(token);

    if (!verificationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: verificationResult.error || 'Email verification failed'
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      userId: verificationResult.userId
    });

  } catch (error) {
    console.error('Email verification error:', error);
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
