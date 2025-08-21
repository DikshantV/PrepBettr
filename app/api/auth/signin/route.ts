import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';
import { FirebaseService } from '@/services/firebase.service';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_S = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    // Verify the Firebase ID token
    const authResult = await verifyFirebaseToken(idToken);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Invalid ID token' },
        { status: 401 }
      );
    }

    const firebaseService = new FirebaseService();
    
    // Check if user exists in Firestore
    const existingUser = await firebaseService.getUser(authResult.user.uid);
    
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Set session cookie
    cookies().set(SESSION_COOKIE_NAME, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DURATION_S,
      path: '/',
      sameSite: 'lax',
    });

    // Return user data
    return NextResponse.json({
      success: true,
      user: {
        uid: authResult.user.uid,
        email: authResult.user.email,
        name: authResult.user.name,
        picture: authResult.user.picture,
        ...existingUser
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
