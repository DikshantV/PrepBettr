/**
 * Server-Side Google OAuth Implementation
 * 
 * Bypasses Firebase client-side authentication issues by handling
 * Google OAuth directly on the server side
 */

/**
 * Generate Google OAuth URL for server-side authentication
 */
export function getGoogleAuthUrl(baseUrl = 'http://localhost:3000') {
  const clientId = process.env.NEXT_PUBLIC_FIREBASE_API_KEY 
    ? '660242808945-YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com' // You'll need to get this from Google Cloud Console
    : 'demo-client-id';

  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  
  const scope = [
    'openid',
    'email', 
    'profile'
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scope,
    access_type: 'offline',
    prompt: 'consent'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange Google OAuth code for tokens
 */
export async function exchangeGoogleCode(code, baseUrl = 'http://localhost:3000') {
  const clientId = '660242808945-YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
  const clientSecret = 'YOUR_GOOGLE_CLIENT_SECRET'; // You'll need to get this from Google Cloud Console
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
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

    if (!response.ok) {
      throw new Error(`Google OAuth token exchange failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Google OAuth token exchange error:', error);
    throw error;
  }
}

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(accessToken) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Google user info fetch failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Google user info fetch error:', error);
    throw error;
  }
}

/**
 * Create a mock Firebase ID token for server-side auth
 */
export function createMockFirebaseToken(googleUser) {
  const header = {
    alg: 'none',
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
    email_verified: googleUser.verified_email,
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

  // Create a mock JWT without signature (for development)
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  return `${encodedHeader}.${encodedPayload}.mock-signature`;
}