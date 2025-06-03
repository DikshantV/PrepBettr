import { NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

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

    console.log('Verifying ID token...');
    // Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    console.log('Token verified for user:', decodedToken.uid);
    
    // Check if user exists in Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      console.log('User not found in Firestore, returning 404');
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    console.log('Creating session cookie...');
    // Set session cookie
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 24 * 5 * 1000, // 5 days
    });

    console.log('Session cookie created, setting response...');
    const response = new NextResponse(
      JSON.stringify({ success: true }), 
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );

    // Set the session cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 5, // 5 days
      path: '/',
    };
    
    console.log('Setting session cookie with options:', cookieOptions);
    response.cookies.set('session', sessionCookie, cookieOptions);
    
    console.log('Returning successful response');
    return response;
    
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
