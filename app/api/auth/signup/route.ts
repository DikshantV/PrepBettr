import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';
import { firebaseService } from '@/services/firebase.service';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_S = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, idToken } = await request.json();

    let authResult;
    let mockIdToken = idToken;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (idToken) {
      // Handle Firebase ID token flow (for Google Sign-in)
      authResult = await verifyFirebaseToken(idToken);
      
      if (!authResult.success || !authResult.user) {
        return NextResponse.json(
          { error: 'Invalid ID token' },
          { status: 401 }
        );
      }
    } else if (password) {
      // Handle email/password flow
      try {
        const signUpResult = await firebaseService.createUserWithEmailAndPassword(email, password);
        
        // Create mock auth result
        authResult = {
          success: true,
          user: {
            uid: signUpResult.user.uid,
            email: signUpResult.user.email,
            name: name || signUpResult.user.displayName,
            email_verified: false
          }
        };

        // Create a mock ID token for session cookie
        mockIdToken = `mock-token-${signUpResult.user.uid}-${Date.now()}`;
      } catch (error) {
        console.error('Firebase signup failed:', error);
        return NextResponse.json(
          { error: 'Failed to create account' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Password or ID token is required' },
        { status: 400 }
      );
    }

    // Check if user already exists (mock implementation)
    if (!authResult.user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    const existingUser = await firebaseService.getDocument('users', authResult.user.uid);
    
    if (existingUser?.data && Object.keys(existingUser.data).length > 2) { // More than createdAt/updatedAt
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Create new user in storage (mock implementation)
    await firebaseService.setDocument('users', authResult.user.uid, {
      email: email,
      displayName: name || email.split('@')[0],
      createdAt: new Date(),
      emailVerified: authResult.user.email_verified
    });

    // Set session cookie after successful user creation
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, mockIdToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DURATION_S,
      path: '/',
      sameSite: 'lax',
    });

    // Return success with user data and token for localStorage
    return NextResponse.json({
      success: true,
      token: mockIdToken, // Include token for frontend storage
      user: {
        uid: authResult.user.uid,
        email: email,
        name: name || email.split('@')[0],
        email_verified: authResult.user.email_verified
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
