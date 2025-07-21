import { NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { cloudFunctionsVerification } from '@/lib/services/cloud-functions-verification';

export async function POST(request: Request) {
  console.log('Starting sign in process...');
  try {
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const { idToken } = body;
    
    if (!idToken) {
      console.error('No ID token provided');
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    console.log('Verifying ID token on server-side...');
    
    // Verify the token using our comprehensive verification service
    const verificationResult = await firebaseVerification.verifyIdToken(idToken);
    
    if (!verificationResult.success) {
      console.error('Token verification failed:', verificationResult.error);
      return NextResponse.json(
        { 
          error: 'Token verification failed',
          details: verificationResult.error 
        },
        { status: 401 }
      );
    }
    
    const decodedToken = verificationResult.decodedToken;
    
    // Additional server-side validation
    const validationResult = await firebaseVerification.validateTokenClaims(decodedToken);
    if (!validationResult.isValid) {
      console.error('Token validation failed:', validationResult.errors);
      return NextResponse.json(
        { 
          error: 'Invalid token claims',
          details: validationResult.errors 
        },
        { status: 401 }
      );
    }
    
    console.log(`Token verified successfully for user: ${decodedToken.uid} (${verificationResult.method})`);
    
    // Try to create a proper session cookie if Admin SDK is available
    const sessionCookieResult = await firebaseVerification.createSessionCookie(idToken);
    let sessionToken = idToken; // fallback to ID token
    let sessionType = 'id_token'; // default to ID token
    
    if (sessionCookieResult.success && sessionCookieResult.sessionCookie) {
      sessionToken = sessionCookieResult.sessionCookie;
      sessionType = 'session_cookie';
      console.log('Created Firebase session cookie');
    } else {
      console.log('Using ID token as session (Admin SDK unavailable):', sessionCookieResult.error);
    }
    
    // Cookie options for both session and session_type cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 5, // 5 days
      path: '/',
    };
    
    console.log(`Setting session token as cookie (type: ${sessionType})`);
    
    // Helper function to serialize cookies
    const serializeCookie = (name: string, value: string, options: any) => {
      const optionParts = [
        `${name}=${value}`,
        `Path=${options.path}`,
        `Max-Age=${options.maxAge}`,
        `SameSite=${options.sameSite}`
      ];
      
      if (options.httpOnly) optionParts.push('HttpOnly');
      if (options.secure) optionParts.push('Secure');
      
      return optionParts.join('; ');
    };
    
    // Create Set-Cookie headers for both session and session_type
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    });
    
    // Always set BOTH session and session_type cookies
    headers.append('Set-Cookie', serializeCookie('session', sessionToken, cookieOptions));
    headers.append('Set-Cookie', serializeCookie('session_type', sessionType, cookieOptions));
    
    console.log('Returning successful response with standardized cookies');
    
    // Return NextResponse with headers to guarantee cookies flush before client redirect
    return new NextResponse(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers
      }
    );
    
  } catch (error) {
    console.error('Error in sign-in route:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sign in with Google',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
