import { NextRequest, NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';
import { FirebaseService } from '@/services/firebase.service';

export async function POST(request: NextRequest) {
  try {
    const { idToken, name, email } = await request.json();

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
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
    
    // Check if user already exists
    const existingUser = await firebaseService.getUser(authResult.user.uid);
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Create new user in Firestore
    await firebaseService.createUser(authResult.user.uid, {
      email: email,
      displayName: name || email.split('@')[0]
    });

    // Return success with user data
    return NextResponse.json({
      success: true,
      user: {
        uid: authResult.user.uid,
        email: email,
        name: name || email.split('@')[0],
        picture: authResult.user.picture
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
