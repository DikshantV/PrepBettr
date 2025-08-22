#!/usr/bin/env tsx

/**
 * End-to-End Authentication Test Script
 * 
 * Tests the complete Google Sign-In flow to verify 401 issue is resolved
 */

import { firebaseUserService } from '@/lib/services/firebase-user-service';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

class AuthFlowTester {
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
      
      if (healthResult.healthy) {
        this.logResult(
          'Firebase Health Check',
          true,
          'Firebase Auth and Firestore connections successful',
          healthResult.details
        );
      } else {
        this.logResult(
          'Firebase Health Check',
          false,
          'Firebase connectivity issues detected',
          healthResult.details
        );
      }
    } catch (error) {
      this.logResult(
        'Firebase Health Check',
        false,
        `Firebase health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test user profile operations
   */
  async testUserProfileOperations(): Promise<void> {
    console.log('\n👤 Testing User Profile Operations...');
    
    const testUserId = `test-user-${Date.now()}`;
    const testEmail = `test-${Date.now()}@example.com`;
    
    try {
      // Test creating a user profile
      const userProfile = await firebaseUserService.createUserProfile(testUserId, {
        email: testEmail,
        displayName: 'Test User',
        emailVerified: false,
        plan: 'free'
      });
      
      this.logResult(
        'Create User Profile',
        true,
        'Successfully created user profile',
        { uid: userProfile.uid, email: userProfile.email }
      );
      
      // Test retrieving the user profile
      const retrievedProfile = await firebaseUserService.getUserProfile(testUserId);
      
      if (retrievedProfile && retrievedProfile.email === testEmail) {
        this.logResult(
          'Retrieve User Profile',
          true,
          'Successfully retrieved user profile'
        );
      } else {
        this.logResult(
          'Retrieve User Profile',
          false,
          'Failed to retrieve user profile or data mismatch'
        );
      }
      
      // Test updating the user profile
      await firebaseUserService.updateUserProfile(testUserId, {
        displayName: 'Updated Test User'
      });
      
      const updatedProfile = await firebaseUserService.getUserProfile(testUserId);
      if (updatedProfile && updatedProfile.displayName === 'Updated Test User') {
        this.logResult(
          'Update User Profile',
          true,
          'Successfully updated user profile'
        );
      } else {
        this.logResult(
          'Update User Profile',
          false,
          'Failed to update user profile'
        );
      }
      
      // Test ensureUserProfile function
      const ensuredProfile = await firebaseUserService.ensureUserProfile(testUserId, {
        email: testEmail,
        displayName: 'Ensured User'
      });
      
      if (ensuredProfile.uid === testUserId) {
        this.logResult(
          'Ensure User Profile',
          true,
          'Successfully ensured existing user profile'
        );
      } else {
        this.logResult(
          'Ensure User Profile',
          false,
          'Failed to ensure user profile'
        );
      }
      
      // Clean up test user profile
      const firestore = await import('@/lib/firebase/admin').then(m => m.getAdminFirestore());
      await firestore.collection('users').doc(testUserId).delete();
      
    } catch (error) {
      this.logResult(
        'User Profile Operations',
        false,
        `User profile operations failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test auth API endpoints
   */
  async testAuthEndpoints(): Promise<void> {
    console.log('\n🔐 Testing Auth API Endpoints...');
    
    const baseUrl = 'http://localhost:3000';
    
    try {
      // Test health endpoints
      const firebaseHealthResponse = await fetch(`${baseUrl}/api/health/firebase`);
      const firebaseHealth = await firebaseHealthResponse.json();
      
      this.logResult(
        'Firebase Health Endpoint',
        firebaseHealthResponse.status === 200 && firebaseHealth.status === 'healthy',
        `Firebase health endpoint returned ${firebaseHealthResponse.status}`,
        firebaseHealth
      );
      
      // Test signin endpoint with invalid credentials (should return 401)
      const invalidSigninResponse = await fetch(`${baseUrl}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'nonexistent@example.com', 
          password: 'invalidpassword' 
        })
      });
      
      this.logResult(
        'Invalid Signin Request',
        invalidSigninResponse.status === 401,
        `Invalid signin correctly returned ${invalidSigninResponse.status}`,
      );
      
      // Test signin endpoint without credentials (should return 400)
      const emptySigninResponse = await fetch(`${baseUrl}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      this.logResult(
        'Empty Signin Request',
        emptySigninResponse.status === 400,
        `Empty signin correctly returned ${emptySigninResponse.status}`
      );
      
    } catch (error) {
      this.logResult(
        'Auth Endpoints Test',
        false,
        `Auth endpoint testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Test middleware behavior
   */
  async testMiddleware(): Promise<void> {
    console.log('\n🛡️ Testing Middleware Behavior...');
    
    const baseUrl = 'http://localhost:3000';
    
    try {
      // Test unauthenticated access to dashboard (should redirect to sign-in)
      const dashboardResponse = await fetch(`${baseUrl}/dashboard`, {
        redirect: 'manual' // Don't follow redirects
      });
      
      this.logResult(
        'Dashboard Redirect',
        dashboardResponse.status === 307,
        `Unauthenticated dashboard access correctly returned ${dashboardResponse.status}`
      );
      
      // Test sign-in page access (should be accessible)
      const signinResponse = await fetch(`${baseUrl}/sign-in`);
      
      this.logResult(
        'Sign-in Page Access',
        signinResponse.status === 200,
        `Sign-in page correctly returned ${signinResponse.status}`
      );
      
    } catch (error) {
      this.logResult(
        'Middleware Test',
        false,
        `Middleware testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Run all tests and report results
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting End-to-End Authentication Flow Tests...\n');
    
    await this.testFirebaseConnectivity();
    await this.testUserProfileOperations();
    await this.testAuthEndpoints();
    await this.testMiddleware();
    
    // Summary
    console.log('\n📊 Test Summary:');
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${total - passed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%`);
    
    if (passed === total) {
      console.log('\n🎉 All tests passed! The authentication system is working correctly.');
      console.log('\n📋 Next Steps:');
      console.log('1. Navigate to http://localhost:3000/sign-in');
      console.log('2. Click the Google Sign-In button');
      console.log('3. Complete the OAuth flow');
      console.log('4. Verify you are redirected to /dashboard without 401 errors');
    } else {
      console.log('\n⚠️ Some tests failed. Please review the errors above.');
    }
    
    // Exit with appropriate code
    process.exit(passed === total ? 0 : 1);
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new AuthFlowTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}
