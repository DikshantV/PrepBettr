import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID_SUFFIX;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    console.log('🌐 Server-side Google auth: Starting OAuth flow');
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('🌐 Server-side Google auth: Missing OAuth credentials');
      return NextResponse.json(
        { error: 'OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Generate OAuth URL
    const state = Math.random().toString(36).substring(7);
    const redirectUri = `${NEXTAUTH_URL}/api/auth/google/callback`;
    
    const oauthUrl = new URL('https://accounts.google.com/oauth2/v2/auth');
    oauthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', 'openid email profile');
    oauthUrl.searchParams.set('state', state);

    console.log('🌐 Server-side Google auth: Redirecting to Google OAuth');
    
    // Store state in cookie for validation
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 300, // 5 minutes
      path: '/',
      sameSite: 'lax',
    });

    // Return redirect URL for client to navigate to
    return NextResponse.json({
      success: true,
      redirectUrl: oauthUrl.toString()
    });

  } catch (error) {
    console.error('🌐 Server-side Google auth error:', error);
    return NextResponse.json(
      { error: 'Server-side authentication failed' },
      { status: 500 }
    );
  }
}