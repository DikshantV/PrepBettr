import { NextRequest, NextResponse } from 'next/server';

/**
 * Firebase Auth Proxy Route
 * 
 * This route acts as a server-side proxy for Firebase authentication
 * to bypass browser network connectivity issues with Firebase services.
 * 
 * It handles Google OAuth flow entirely on the server side.
 */

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`🌐 [${timestamp}] Firebase Auth Proxy called`);
  
  try {
    const { action, data } = await request.json();
    
    switch (action) {
      case 'initiate-google-auth':
        return await initiateGoogleAuth(request);
        
      case 'complete-google-auth':
        return await completeGoogleAuth(data);
        
      case 'test-firebase-connection':
        return await testFirebaseConnection();
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error(`❌ Firebase proxy error:`, error);
    return NextResponse.json(
      { error: 'Firebase proxy error' },
      { status: 500 }
    );
  }
}

/**
 * Initiate Google OAuth flow - returns authorization URL
 */
async function initiateGoogleAuth(request: NextRequest) {
  try {
    // Get Google OAuth client configuration
    const clientId = '660242808945-' + // Your actual Google OAuth client ID
      (process.env.GOOGLE_CLIENT_ID_SUFFIX || 'YOUR_CLIENT_ID.apps.googleusercontent.com');
    
    const baseUrl = request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/auth/firebase-proxy/callback`;
    
    const scope = encodeURIComponent('openid profile email');
    const state = Math.random().toString(36).substring(2, 15);
    
    // Store state in session for security (you might want to use a more robust storage)
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${scope}&` +
      `state=${state}&` +
      `prompt=select_account`;
    
    console.log(`🔐 Generated Google auth URL`);
    
    return NextResponse.json({
      success: true,
      authUrl,
      state
    });
    
  } catch (error) {
    console.error('❌ Failed to initiate Google auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}

/**
 * Complete Google OAuth and create Firebase token
 */
async function completeGoogleAuth(data: any) {
  try {
    const { code, state } = data;
    
    if (!code) {
      throw new Error('Authorization code is required');
    }
    
    // Exchange code for tokens using server-side request
    const clientId = '660242808945-' + 
      (process.env.GOOGLE_CLIENT_ID_SUFFIX || 'YOUR_CLIENT_ID.apps.googleusercontent.com');
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret';
    const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/firebase-proxy/callback`;
    
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }
    
    const tokenData = await tokenResponse.json();
    
    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    if (!userResponse.ok) {
      throw new Error('Failed to get user info from Google');
    }
    
    const googleUser = await userResponse.json();
    
    // Create a mock Firebase ID token (since we can't use Firebase client-side)
    const mockFirebaseToken = createMockFirebaseIdToken(googleUser);
    
    console.log(`✅ Google OAuth completed for user: ${googleUser.email}`);
    
    return NextResponse.json({
      success: true,
      user: {
        uid: googleUser.id,
        email: googleUser.email,
        displayName: googleUser.name,
        photoURL: googleUser.picture,
        emailVerified: googleUser.verified_email
      },
      idToken: mockFirebaseToken
    });
    
  } catch (error) {
    console.error('❌ Failed to complete Google auth:', error);
    return NextResponse.json(
      { error: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * Test Firebase connection from server-side
 */
async function testFirebaseConnection() {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'prepbettr';
    
    // Test Firebase Identity Toolkit from server-side
    const testUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}:getConfig?key=${apiKey}`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`🔥 Firebase connection test: ${response.status}`);
    
    if (response.ok) {
      const config = await response.json();
      return NextResponse.json({
        success: true,
        message: 'Firebase connection successful',
        config: {
          projectId: config.projectId,
          authDomain: config.authDomain,
          providers: config.signIn || {}
        }
      });
    } else {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `Firebase test failed: ${errorText}`
      });
    }
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Firebase connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

/**
 * Create a mock Firebase-compatible ID token
 */
function createMockFirebaseIdToken(googleUser: any) {
  const header = {
    alg: 'RS256',
    kid: 'server-proxy',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/prepbettr',
    aud: 'prepbettr',
    auth_time: now,
    user_id: googleUser.id,
    uid: googleUser.id,
    sub: googleUser.id,
    iat: now,
    exp: now + (60 * 60), // 1 hour
    email: googleUser.email,
    email_verified: googleUser.verified_email || true,
    name: googleUser.name,
    picture: googleUser.picture,
    firebase: {
      identities: {
        'google.com': [googleUser.id],
        email: [googleUser.email]
      },
      sign_in_provider: 'google.com'
    }
  };
  
  // Create JWT without signature (for development/server-side proxy)
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  return `${encodedHeader}.${encodedPayload}.server-proxy-signature`;
}