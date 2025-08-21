#!/usr/bin/env node

/**
 * Enhanced debug script to trace why redirect after Google Sign-In isn't working
 */

const baseUrl = 'https://prepbettr.com';

async function debugRedirectIssue() {
  console.log('🔍 Debugging redirect issue after Google Sign-In...\n');

  try {
    console.log('=== Test 1: Simulate successful auth flow ===');
    
    // First, let's see what happens when we try to access dashboard directly
    console.log('Testing direct dashboard access...');
    const dashboardResponse = await fetch(`${baseUrl}/dashboard`, {
      method: 'HEAD',
      redirect: 'manual'
    });
    
    console.log(`Dashboard status: ${dashboardResponse.status}`);
    console.log(`Redirect to: ${dashboardResponse.headers.get('location')}`);
    console.log(`Set-Cookie headers: ${dashboardResponse.headers.get('set-cookie') || 'None'}`);
    
    console.log('\n=== Test 2: Check if Firebase config is accessible ===');
    const configResponse = await fetch(`${baseUrl}/api/config/firebase`);
    const config = await configResponse.json();
    console.log('Firebase config status:', configResponse.status);
    console.log('Firebase config has API key:', !!config.apiKey);
    
    console.log('\n=== Test 3: Check auth API responses ===');
    // Test signin endpoint with no token (should return 400)
    const signinTest = await fetch(`${baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    console.log(`Signin API status: ${signinTest.status}`);
    const signinData = await signinTest.json().catch(() => null);
    console.log('Signin API response:', signinData?.error || 'No error message');
    
    console.log('\n=== Test 4: Check middleware behavior ===');
    // Test sign-in page to see if it redirects authenticated users
    console.log('Testing sign-in page response...');
    const signInPageResponse = await fetch(`${baseUrl}/sign-in`, {
      method: 'HEAD',
      redirect: 'manual'
    });
    
    console.log(`Sign-in page status: ${signInPageResponse.status}`);
    console.log(`Sign-in redirect: ${signInPageResponse.headers.get('location') || 'None'}`);
    
    console.log('\n=== Debugging Instructions ===');
    console.log('To debug the redirect issue, please:');
    console.log('');
    console.log('1. Open Chrome DevTools (F12) and go to Console tab');
    console.log('2. Go to https://prepbettr.com/sign-in');
    console.log('3. Click "Sign in with Google"');
    console.log('4. Look for these console messages in order:');
    console.log('   ✓ "Starting Google Sign In..."');
    console.log('   ✓ "Firebase auth successful, user: [some-uid]"');
    console.log('   ✓ "Got ID token, attempting sign in..."');
    console.log('   ✓ "Sign in response status: [200 or 404]"');
    console.log('   ✓ "GoogleSignInButton: ... successful, redirecting to dashboard"');
    console.log('   ✓ "GoogleSignInButton: Attempting router.replace to /dashboard"');
    console.log('');
    console.log('5. Check Network tab for:');
    console.log('   - POST request to /api/auth/signin (should be 200)');
    console.log('   - POST request to /api/auth/signup (if user creation needed)');
    console.log('   - Check Response Headers for "set-cookie" header');
    console.log('');
    console.log('6. Check Application tab → Cookies for:');
    console.log('   - Domain: prepbettr.com');
    console.log('   - Cookie name: "session"');
    console.log('   - Cookie value should be a Firebase ID token');
    console.log('');
    console.log('7. After sign-in, try manually navigating to:');
    console.log('   https://prepbettr.com/dashboard');
    console.log('   (This should work if session cookie is set)');
    console.log('');
    console.log('Please run through these steps and report:');
    console.log('- Which step fails or shows unexpected behavior');
    console.log('- Any error messages in console');
    console.log('- Whether the session cookie gets set');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugRedirectIssue();
