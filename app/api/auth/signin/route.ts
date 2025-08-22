import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';
import { firebaseService } from '@/services/firebase.service';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_S = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  console.log(`🔑 [${new Date().toISOString()}] AUTH SIGNIN POST called - User-Agent: ${request.headers.get('user-agent')?.substring(0, 50)}`);
  try {
    const { email, password, idToken } = await request.json();

    let authResult;
    let mockIdToken = idToken;

    if (idToken) {
      // Handle Firebase ID token flow (for Google Sign-in)
      authResult = await verifyFirebaseToken(idToken);
      
      if (!authResult.success || !authResult.user) {
        return NextResponse.json(
          { error: 'Invalid ID token' },
          { status: 401 }
        );
      }
    } else if (email && password) {
      // Handle email/password flow
      try {
        const signInResult = await firebaseService.signInWithEmailAndPassword(email, password);
        
        // Create mock auth result
        authResult = {
          success: true,
          user: {
            uid: signInResult.user.uid,
            email: signInResult.user.email,
            name: signInResult.user.displayName,
            email_verified: true
          }
        };

        // Create a mock ID token for session cookie
        mockIdToken = `mock-token-${signInResult.user.uid}-${Date.now()}`;
      } catch (error) {
        console.error('Firebase sign in failed:', error);
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Email and password or ID token is required' },
        { status: 400 }
      );
    }

    // Check if user exists (mock implementation)
    if (!authResult.user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    const existingUser = await firebaseService.getDocument('users', authResult.user.uid);
    
    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, mockIdToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DURATION_S,
      path: '/',
      sameSite: 'lax',
    });

    // Return user data with auth token for localStorage
    return NextResponse.json({
      success: true,
      token: mockIdToken, // Include token for frontend storage
      user: {
        uid: authResult.user.uid,
        email: authResult.user.email,
        name: authResult.user.name,
        email_verified: authResult.user.email_verified,
        ...existingUser?.data
      }
    });

  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
