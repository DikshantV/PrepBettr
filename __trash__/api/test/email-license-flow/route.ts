// app/api/test/email-license-flow/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { testUtils } from '@/lib/test-utils/email-license-test-utils';
import { emailVerificationService } from '@/lib/services/email-verification-service';
import { mockLicenseKeyService as licenseKeyService } from '@/lib/services/mock-license-key-service';
import { subscriptionService } from '@/lib/services/subscription-service';

// Only allow this in development
const isDevelopment = process.env.NODE_ENV !== 'production';

export async function POST(request: NextRequest) {
  if (!isDevelopment) {
    return NextResponse.json(
      { error: 'Test endpoints only available in development' },
      { status: 403 }
    );
  }

  try {
    const { action, userId, email, licenseKey } = await request.json();

    switch (action) {
      case 'setup_test_user':
        return await setupTestUser(userId, email);
      
      case 'send_verification':
        return await sendVerification(userId, email);
      
      case 'verify_email':
        return await verifyEmail(userId);
      
      case 'create_license_key':
        return await createLicenseKey(userId, email);
      
      case 'activate_license':
        return await activateLicense(userId, licenseKey);
      
      case 'check_status':
        return await checkStatus(userId);
      
      case 'test_usage_limits':
        return await testUsageLimits(userId);
      
      case 'cleanup':
        return await cleanup(userId);
      
      case 'full_flow_test':
        return await fullFlowTest(userId, email);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function setupTestUser(userId: string, email: string) {
  await testUtils.createTestUser(userId, email, 'Test User', false);
  const status = await testUtils.getUserStatus(userId);
  
  return NextResponse.json({
    success: true,
    message: 'Test user created successfully',
    data: {
      userId,
      email,
      status
    }
  });
}

async function sendVerification(userId: string, email: string) {
  // Create verification record in database
  const { token } = await testUtils.createTestEmailVerification(userId, email);
  
  // Also trigger the service to send verification
  const result = await emailVerificationService.sendVerificationEmail(userId, email, 'Test User');
  
  return NextResponse.json({
    success: true,
    message: 'Email verification created',
    data: {
      token,
      verificationUrl: `http://localhost:3000/api/auth/verify-email?token=${token}`,
      serviceResult: result
    }
  });
}

async function verifyEmail(userId: string) {
  // Get the latest verification token
  const status = await testUtils.getUserStatus(userId);
  const token = status?.emailVerification?.latest?.token;
  
  if (!token) {
    return NextResponse.json(
      { error: 'No verification token found. Run send_verification first.' },
      { status: 400 }
    );
  }
  
  const result = await emailVerificationService.verifyEmail(token);
  
  return NextResponse.json({
    success: true,
    message: 'Email verification attempted',
    data: result
  });
}

async function createLicenseKey(userId: string, email: string) {
  const { licenseKey } = await testUtils.createTestLicenseKey(userId, email);
  
  return NextResponse.json({
    success: true,
    message: 'Test license key created',
    data: {
      licenseKey,
      instructions: 'Use this license key to test activation'
    }
  });
}

async function activateLicense(userId: string, licenseKey: string) {
  const result = await licenseKeyService.activateLicenseKey(userId, licenseKey);
  
  return NextResponse.json({
    success: true,
    message: 'License activation attempted',
    data: result
  });
}

async function checkStatus(userId: string) {
  const status = await testUtils.getUserStatus(userId);
  const subscriptionStatus = await subscriptionService.getUserSubscriptionStatus(userId);
  
  return NextResponse.json({
    success: true,
    data: {
      testUtilsStatus: status,
      subscriptionStatus
    }
  });
}

async function testUsageLimits(userId: string) {
  // Test all features at their limits
  await testUtils.simulateUsage(userId, 'interviews', 3);
  await testUtils.simulateUsage(userId, 'resumeTailor', 3);
  await testUtils.simulateUsage(userId, 'autoApply', 3);
  
  const status = await testUtils.getUserStatus(userId);
  
  return NextResponse.json({
    success: true,
    message: 'Usage limits reached for all features',
    data: status
  });
}

async function cleanup(userId: string) {
  await testUtils.cleanupTestData(userId);
  
  return NextResponse.json({
    success: true,
    message: 'Test data cleaned up'
  });
}

async function fullFlowTest(userId: string, email: string) {
  const results: any[] = [];
  
  try {
    // Step 1: Create test user
    await testUtils.createTestUser(userId, email, 'Test User', false);
    results.push({ step: 'create_user', success: true });
    
    // Step 2: Check that user cannot access premium features without verification
    const canUseBeforeVerification = await subscriptionService.canPerformAction(userId, 'interviews', true);
    results.push({ 
      step: 'check_access_before_verification', 
      success: true,
      canUse: canUseBeforeVerification
    });
    
    // Step 3: Send email verification
    const { token } = await testUtils.createTestEmailVerification(userId, email);
    results.push({ step: 'send_verification', success: true, token });
    
    // Step 4: Verify email
    const verificationResult = await emailVerificationService.verifyEmail(token);
    results.push({ step: 'verify_email', success: verificationResult.success, result: verificationResult });
    
    // Step 5: Check access after verification but before license
    const canUseAfterVerification = await subscriptionService.canPerformAction(userId, 'interviews', true);
    results.push({ 
      step: 'check_access_after_verification', 
      success: true,
      canUse: canUseAfterVerification
    });
    
    // Step 6: Create license key
    const { licenseKey } = await testUtils.createTestLicenseKey(userId, email);
    results.push({ step: 'create_license_key', success: true, licenseKey });
    
    // Step 7: Activate license
    const activationResult = await licenseKeyService.activateLicenseKey(userId, licenseKey);
    results.push({ step: 'activate_license', success: activationResult.success, result: activationResult });
    
    // Step 8: Check premium access
    const finalStatus = await subscriptionService.getUserSubscriptionStatus(userId);
    results.push({ step: 'check_premium_access', success: true, status: finalStatus });
    
    // Step 9: Test usage after premium
    const canUsePremium = await subscriptionService.canPerformAction(userId, 'interviews', true);
    results.push({ 
      step: 'check_premium_usage', 
      success: true,
      canUse: canUsePremium
    });
    
    return NextResponse.json({
      success: true,
      message: 'Full flow test completed',
      data: {
        userId,
        email,
        licenseKey,
        results,
        finalStatus
      }
    });
    
  } catch (error) {
    results.push({ 
      step: 'error', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json({
      success: false,
      message: 'Full flow test failed',
      data: {
        userId,
        email,
        results
      }
    });
  }
}

export async function GET(request: NextRequest) {
  if (!isDevelopment) {
    return NextResponse.json(
      { error: 'Test endpoints only available in development' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    message: 'Email Verification and License Key Test Endpoint',
    availableActions: [
      'setup_test_user',
      'send_verification', 
      'verify_email',
      'create_license_key',
      'activate_license',
      'check_status',
      'test_usage_limits',
      'cleanup',
      'full_flow_test'
    ],
    usage: {
      method: 'POST',
      body: {
        action: 'action_name',
        userId: 'test-user-123',
        email: 'test@example.com',
        licenseKey: 'TEST-LICENSE-KEY' // only for activate_license
      }
    }
  });
}
