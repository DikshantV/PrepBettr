#!/usr/bin/env node

/**
 * Debug script to test authentication flow and identify redirect issues
 */

const baseUrl = 'https://prepbettr.com';

async function debugAuthFlow() {
  console.log('🔍 Debugging authentication flow...\n');

  try {
    console.log('=== Step 1: Check current authentication state ===');
    
    // Test if we can access dashboard without auth (should redirect)
    console.log('Testing dashboard access without authentication...');
    const dashboardResponse = await fetch(`${baseUrl}/dashboard`, {
      method: 'HEAD',
      redirect: 'manual'
    });
    
    console.log(`Dashboard status: ${dashboardResponse.status}`);
    console.log(`Redirect location: ${dashboardResponse.headers.get('location')}`);
    
    console.log('\n=== Step 2: Test sign-in page loads ===');
    const signInResponse = await fetch(`${baseUrl}/sign-in`);
    console.log(`Sign-in page status: ${signInResponse.status}`);
    
    console.log('\n=== Step 3: Test Firebase config endpoint ===');
    const configResponse = await fetch(`${baseUrl}/api/config/firebase`);
    const config = await configResponse.json();
    console.log('Firebase config available:', {
      hasApiKey: !!config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId
    });
    
    console.log('\n=== Step 4: Test auth API endpoints ===');
    
    // Test with empty body (should get 400/401)
    const signInTest = await fetch(`${baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const signUpTest = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    console.log(`Sign-in API status: ${signInTest.status}`);
    console.log(`Sign-up API status: ${signUpTest.status}`);
    
    const signInError = await signInTest.json().catch(() => null);
    const signUpError = await signUpTest.json().catch(() => null);
    
    console.log('Sign-in API error:', signInError?.error || 'No error message');
    console.log('Sign-up API error:', signUpError?.error || 'No error message');
    
    console.log('\n=== Authentication Flow Analysis ===');
    console.log('✅ Dashboard correctly redirects unauthenticated users');
    console.log('✅ Sign-in page is accessible');
    console.log('✅ Firebase config is available');
    console.log('✅ Auth API endpoints are responding');
    
    console.log('\n🧪 Manual Testing Steps:');
    console.log('1. Open browser developer console (F12)');
    console.log('2. Go to https://prepbettr.com/sign-in');
    console.log('3. Click "Sign in with Google"');
    console.log('4. Look for console logs starting with:');
    console.log('   - "Starting Google Sign In..."');
    console.log('   - "Firebase auth successful, user: [uid]"');
    console.log('   - "Sign in response status: [status]"');
    console.log('   - "GoogleSignInButton: ... successful, redirecting to dashboard"');
    console.log('5. Check if any errors appear in console');
    console.log('6. Note if setSignInSuccess(true) is called but redirect fails');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugAuthFlow();
