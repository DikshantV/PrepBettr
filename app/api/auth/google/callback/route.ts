import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID_SUFFIX;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🌐 Google OAuth callback: Processing response');
    
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('🌐 Google OAuth callback: OAuth error:', error);
      return NextResponse.redirect(`${NEXTAUTH_URL}/sign-in?error=oauth_error`);
    }

    if (!code || !state) {
      console.error('🌐 Google OAuth callback: Missing code or state');
      return NextResponse.redirect(`${NEXTAUTH_URL}/sign-in?error=missing_params`);
    }

    // Verify state parameter
    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_state')?.value;
    
    if (storedState !== state) {
      console.error('🌐 Google OAuth callback: Invalid state parameter');
      return NextResponse.redirect(`${NEXTAUTH_URL}/sign-in?error=invalid_state`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${NEXTAUTH_URL}/api/auth/google/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('🌐 Google OAuth callback: Token exchange failed:', tokenError);
      return NextResponse.redirect(`${NEXTAUTH_URL}/sign-in?error=token_exchange_failed`);
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();
    console.log('🌐 Google OAuth callback: Tokens received successfully');

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('🌐 Google OAuth callback: Failed to fetch user info');
      return NextResponse.redirect(`${NEXTAUTH_URL}/sign-in?error=user_info_failed`);
    }

    const googleUser: GoogleUserInfo = await userResponse.json();
    console.log('🌐 Google OAuth callback: User info received:', googleUser.email);

    // Create a simple JWT-like token for session (mock Firebase token structure)
    const mockJwtPayload = {
      uid: `google-${googleUser.id}`,
      email: googleUser.email,
      email_verified: googleUser.verified_email,
      name: googleUser.name,
      picture: googleUser.picture,
      provider: 'google.com',
      iss: 'prepbettr-server-auth',
      aud: 'prepbettr',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      iat: Math.floor(Date.now() / 1000),
    };

    // Create a simple base64 encoded token (not secure for production, but works for development)
    const mockToken = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${btoa(JSON.stringify(mockJwtPayload))}.server-auth-signature`;

    // Set session cookie
    cookieStore.set('session', mockToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
      sameSite: 'lax',
    });

    // Clear the OAuth state cookie
    cookieStore.delete('oauth_state');

    console.log('🌐 Google OAuth callback: Authentication successful, redirecting to dashboard');
    
    // Redirect to dashboard
    return NextResponse.redirect(`${NEXTAUTH_URL}/dashboard`);

  } catch (error) {
    console.error('🌐 Google OAuth callback error:', error);
    return NextResponse.redirect(`${NEXTAUTH_URL}/sign-in?error=callback_error`);
  }
}