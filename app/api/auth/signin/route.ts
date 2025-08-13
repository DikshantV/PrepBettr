import { NextResponse } from 'next/server';
import { azureFunctionsClient } from '@/lib/services/azure-functions-client';
import { firebaseVerification } from '@/lib/services/firebase-verification';

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
    
    // Try Azure Function first, fallback to Firebase verification
    let verificationResult;
    let decodedToken;
    let verificationMethod = 'azure-function';
    
    try {
      // Use Azure Function for token verification
      const azureResult = await azureFunctionsClient.verifyToken(idToken);
      
      if (azureResult.valid && azureResult.decoded) {
        verificationResult = { success: true, error: null };
        decodedToken = azureResult.decoded;
        console.log('Token verified successfully via Azure Function');
      } else {
        throw new Error(azureResult.error || 'Azure Function verification failed');
      }
    } catch (azureError) {
      console.warn('Azure Function verification failed, falling back to Firebase:', azureError);
      verificationMethod = 'firebase-fallback';
      
      // Fallback to Firebase verification
      const firebaseResult = await firebaseVerification.verifyIdToken(idToken);
      
      if (!firebaseResult.success) {
        console.error('Both Azure and Firebase token verification failed:', firebaseResult.error);
        return NextResponse.json(
          { 
            error: 'Token verification failed',
            details: firebaseResult.error 
          },
          { status: 401 }
        );
      }
      
      verificationResult = firebaseResult;
      decodedToken = firebaseResult.decodedToken;
      
      // Additional server-side validation for Firebase tokens
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
    }
    
    console.log(`Token verified successfully for user: ${decodedToken.uid} (${verificationMethod})`);
    
    // Try to create session cookie via Azure Function first, fallback to Firebase
    let sessionToken = idToken; // fallback to ID token
    let sessionType = 'id_token'; // default to ID token
    
    try {
      if (verificationMethod === 'azure-function') {
        // Use Azure Function for session cookie creation
        const azureSessionResult = await azureFunctionsClient.createSessionCookie(idToken);
        
        if (azureSessionResult.sessionCookie && !azureSessionResult.error) {
          sessionToken = azureSessionResult.sessionCookie;
          sessionType = 'session_cookie';
          console.log('Created session cookie via Azure Function');
        } else {
          throw new Error(azureSessionResult.error || 'Azure session creation failed');
        }
      } else {
        throw new Error('Using Firebase fallback for session creation');
      }
    } catch (azureSessionError) {
      console.warn('Azure session creation failed, trying Firebase fallback:', azureSessionError);
      
      // Fallback to Firebase session cookie creation
      const sessionCookieResult = await firebaseVerification.createSessionCookie(idToken);
      
      if (sessionCookieResult.success && sessionCookieResult.sessionCookie) {
        sessionToken = sessionCookieResult.sessionCookie;
        sessionType = 'session_cookie';
        console.log('Created Firebase session cookie (fallback)');
      } else {
        console.log('Using ID token as session (both Azure and Firebase unavailable):', sessionCookieResult.error);
      }
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
