// app/api/auth/resend-verification/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { emailVerificationService } from '@/lib/services/email-verification-service';

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

    // Check if email is already verified
    const isAlreadyVerified = await emailVerificationService.isEmailVerified(user.id);
    if (isAlreadyVerified) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email is already verified'
        },
        { status: 400 }
      );
    }

    // Resend verification email
    const resendResult = await emailVerificationService.resendVerificationEmail(user.id);

    if (!resendResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: resendResult.error || 'Failed to resend verification email'
        },
        { status: 400 }
      );
    }

    console.log(`Verification email resent for user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully. Please check your inbox.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
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
