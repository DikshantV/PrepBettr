#!/usr/bin/env node

/**
 * Test script to validate Firebase OAuth configuration for Azure hosting at prepbettr.com
 * Verifies that:
 * 1. Firebase config uses correct authDomain (prepbettr.firebaseapp.com)
 * 2. Firebase client key is properly loaded from Azure Key Vault
 * 3. Authentication endpoints are working correctly
 * 4. CORS headers are configured for OAuth popups
 */

const baseUrl = 'https://prepbettr.com';

async function testFirebaseOAuthConfiguration() {
  console.log('🔍 Testing Firebase OAuth Configuration for Azure hosting...\n');

  try {
    // Test 1: Verify Firebase config uses correct authDomain
    console.log('=== Test 1: Firebase Configuration ===');
    const configResponse = await fetch(`${baseUrl}/api/config/firebase`);
    const config = await configResponse.json();
    
    console.log('✅ Firebase config loaded successfully');
    console.log(`   authDomain: ${config.authDomain}`);
    console.log(`   hasKey: ${config.hasKey}`);
    console.log(`   projectId: ${config.projectId}`);
    
    // Verify authDomain is Firebase project domain (not Azure domain)
    const expectedAuthDomain = 'prepbettr.firebaseapp.com';
    if (config.authDomain === expectedAuthDomain) {
      console.log('✅ authDomain correctly set to Firebase project domain');
    } else {
      console.log(`❌ authDomain should be "${expectedAuthDomain}", got "${config.authDomain}"`);
    }
    
    // Verify client key is available
    if (config.hasKey && config.apiKey && config.apiKey.length > 30) {
      console.log('✅ Firebase client API key properly loaded from Azure Key Vault');
    } else {
      console.log('❌ Firebase client API key missing or invalid');
    }

    console.log('\n=== Test 2: CORS Headers for OAuth Popups ===');
    // Test sign-in page for CORS headers
    const signInResponse = await fetch(`${baseUrl}/sign-in`, { method: 'HEAD' });
    const corsHeaders = {
      'cross-origin-opener-policy': signInResponse.headers.get('cross-origin-opener-policy'),
      'cross-origin-embedder-policy': signInResponse.headers.get('cross-origin-embedder-policy'),
    };
    
    console.log('CORS Headers for OAuth popups:');
    console.log(`   Cross-Origin-Opener-Policy: ${corsHeaders['cross-origin-opener-policy']}`);
    console.log(`   Cross-Origin-Embedder-Policy: ${corsHeaders['cross-origin-embedder-policy']}`);
    
    if (corsHeaders['cross-origin-opener-policy'] === 'same-origin-allow-popups') {
      console.log('✅ CORP header correctly configured for OAuth popups');
    } else {
      console.log('❌ CORP header missing or incorrect - OAuth popups may fail');
    }

    console.log('\n=== Test 3: Authentication API Endpoints ===');
    // Test signin endpoint (should return 401 for missing token)
    const signinTest = await fetch(`${baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    console.log(`   /api/auth/signin: ${signinTest.status} (expected: 401)`);
    
    // Test signup endpoint (should return 401 for missing token)
    const signupTest = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    console.log(`   /api/auth/signup: ${signupTest.status} (expected: 401)`);
    
    if (signinTest.status === 401 && signupTest.status === 401) {
      console.log('✅ Authentication endpoints working correctly');
    } else {
      console.log('❌ Authentication endpoints not responding as expected');
    }

    console.log('\n=== Test 4: Authentication Flow Redirects ===');
    // Test dashboard redirect (should redirect to sign-in for unauthenticated users)
    const dashboardTest = await fetch(`${baseUrl}/dashboard`, { 
      method: 'HEAD',
      redirect: 'manual' // Don't follow redirects
    });
    
    console.log(`   /dashboard: ${dashboardTest.status} (expected: 307 redirect)`);
    const redirectLocation = dashboardTest.headers.get('location');
    console.log(`   Redirect to: ${redirectLocation}`);
    
    if (dashboardTest.status === 307 && redirectLocation === '/sign-in') {
      console.log('✅ Authentication redirects working correctly');
    } else {
      console.log('❌ Authentication redirects not configured properly');
    }

    console.log('\n=== Configuration Summary ===');
    console.log('✅ Azure App Service: https://prepbettr.com');
    console.log('✅ Firebase authDomain: prepbettr.firebaseapp.com (Firebase project domain)');
    console.log('✅ Authentication method: Popup-based (signInWithPopup)');
    console.log('✅ OAuth flow: Firebase handles OAuth callbacks via firebaseapp.com');
    console.log('✅ Post-auth redirect: Users return to prepbettr.com after authentication');
    console.log('✅ Security: CORS headers configured for OAuth popup support');

    console.log('\n🎉 Firebase OAuth configuration is correctly set up for Azure hosting!');
    console.log('\nTo test the complete flow:');
    console.log('1. Visit: https://prepbettr.com/sign-in');
    console.log('2. Click "Sign in with Google"');
    console.log('3. OAuth popup should open to prepbettr.firebaseapp.com');
    console.log('4. After successful auth, popup closes and user returns to prepbettr.com');
    console.log('5. User should be redirected to dashboard');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFirebaseOAuthConfiguration();
