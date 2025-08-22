#!/usr/bin/env tsx

/**
 * Test script for Google Sign-Up flow validation
 */

import { firebaseUserService } from '@/lib/services/firebase-user-service';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

class GoogleSignUpTester {
  private results: TestResult[] = [];

  private logResult(test: string, passed: boolean, message: string, details?: any) {
    this.results.push({ test, passed, message, details });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message}`);
    if (details) {
      console.log('   Details:', JSON.stringify(details, null, 2));
    }
  }

  /**
   * Test Firebase Admin SDK connectivity
   */
  async testFirebaseConnectivity(): Promise<void> {
    console.log('\n🏥 Testing Firebase Connectivity...');
    
    try {
      const healthResult = await firebaseUserService.healthCheck();
      
      this.logResult(
        'Firebase Health Check',
        healthResult.healthy,
        healthResult.healthy ? 'Firebase connections working' : 'Firebase connectivity issues',
        healthResult.details
      );
    } catch (error) {
      this.logResult(
        'Firebase Health Check',
        false,
        `Firebase health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test signup endpoint behavior
   */
  async testSignupEndpoint(): Promise<void> {
    console.log('\n🚪 Testing Signup API Endpoint...');
    
    const baseUrl = 'http://localhost:3000';
    
    try {
      // Test signup endpoint with invalid token (should return 401)
      const invalidTokenResponse = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'invalid-token', email: 'test@example.com' })
      });
      
      this.logResult(
        'Invalid Token Signup',
        invalidTokenResponse.status === 401,
        `Invalid token signup returned ${invalidTokenResponse.status}`,
      );
      
      // Test signup endpoint without required fields (should return 400)
      const emptySignupResponse = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      this.logResult(
        'Empty Signup Request',
        emptySignupResponse.status === 400,
        `Empty signup request returned ${emptySignupResponse.status}`
      );
      
    } catch (error) {
      this.logResult(
        'Signup Endpoint Test',
        false,
        `Signup endpoint testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test basic user profile operations
   */
  async testUserProfileOperations(): Promise<void> {
    console.log('\n👤 Testing User Profile Operations...');
    
    const testUserId = `test-signup-${Date.now()}`;
    const testEmail = `test-signup-${Date.now()}@example.com`;
    
    try {
      // Test creating a user profile (simulating Google signup)
      const userProfile = await firebaseUserService.ensureUserProfile(testUserId, {
        email: testEmail,
        displayName: 'Test Signup User',
        emailVerified: true,
        plan: 'free'
      });
      
      this.logResult(
        'Create User Profile for Signup',
        true,
        'Successfully created user profile for Google signup simulation',
        { uid: userProfile.uid, email: userProfile.email }
      );
      
      // Test that the same operation doesn't create duplicates
      const duplicateProfile = await firebaseUserService.ensureUserProfile(testUserId, {
        email: testEmail,
        displayName: 'Duplicate Test User',
        emailVerified: true
      });
      
      this.logResult(
        'Prevent Duplicate Profile Creation',
        duplicateProfile.uid === userProfile.uid && duplicateProfile.email === testEmail,
        'Correctly prevented duplicate profile creation'
      );
      
      // Clean up test user profile
      const firestore = await import('@/lib/firebase/admin').then(m => m.getAdminFirestore());
      await firestore.collection('users').doc(testUserId).delete();
      
    } catch (error) {
      this.logResult(
        'User Profile Operations for Signup',
        false,
        `User profile operations failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test Google sign-up specific functionality
   */
  async testGoogleSignupSpecifics(): Promise<void> {
    console.log('\n🔍 Testing Google Sign-up Specific Logic...');
    
    // Test Google-style profile creation (email verified, proper name extraction)
    const googleUserId = `google-signup-${Date.now()}`;
    const googleEmail = `googleuser.${Date.now()}@gmail.com`;
    const googleDisplayName = 'Google Test User';
    
    try {
      const googleProfile = await firebaseUserService.createUserProfile(googleUserId, {
        email: googleEmail,
        displayName: googleDisplayName,
        emailVerified: true, // Google users are always email verified
        plan: 'free'
      });
      
      this.logResult(
        'Google-style Profile Creation',
        googleProfile.emailVerified === true && googleProfile.displayName === googleDisplayName,
        'Successfully created Google-style user profile with correct attributes'
      );
      
      // Clean up
      const firestore = await import('@/lib/firebase/admin').then(m => m.getAdminFirestore());
      await firestore.collection('users').doc(googleUserId).delete();
      
    } catch (error) {
      this.logResult(
        'Google Sign-up Profile Logic',
        false,
        `Google signup profile creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test the sign-up page accessibility
   */
  async testSignUpPageAccess(): Promise<void> {
    console.log('\n📄 Testing Sign-Up Page Access...');
    
    const baseUrl = 'http://localhost:3000';
    
    try {
      const signUpPageResponse = await fetch(`${baseUrl}/sign-up`);
      
      this.logResult(
        'Sign-Up Page Access',
        signUpPageResponse.status === 200,
        `Sign-up page returned ${signUpPageResponse.status}`
      );
      
    } catch (error) {
      this.logResult(
        'Sign-Up Page Access',
        false,
        `Failed to access sign-up page: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Run all tests and report results
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Google Sign-Up Flow Tests...\n');
    
    await this.testFirebaseConnectivity();
    await this.testSignupEndpoint();
    await this.testUserProfileOperations();
    await this.testGoogleSignupSpecifics();
    await this.testSignUpPageAccess();
    
    // Summary
    console.log('\n📊 Test Summary:');
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${total - passed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%`);
    
    if (passed === total) {
      console.log('\n🎉 All tests passed! Google Sign-Up backend is ready.');
      console.log('\n📋 Next Steps for Manual Testing:');
      console.log('1. Navigate to http://localhost:3000/sign-up');
      console.log('2. Click the "Sign up with Google" button');
      console.log('3. Complete the Google OAuth flow');
      console.log('4. Verify account creation and redirect to /dashboard');
      console.log('5. Check browser logs for successful token verification and profile creation');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the errors above.');
      
      // Show failed tests
      const failedTests = this.results.filter(r => !r.passed);
      if (failedTests.length > 0) {
        console.log('\n❌ Failed Tests:');
        failedTests.forEach(test => {
          console.log(`  - ${test.test}: ${test.message}`);
        });
      }
    }
    
    // Exit with appropriate code
    process.exit(passed === total ? 0 : 1);
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new GoogleSignUpTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}
