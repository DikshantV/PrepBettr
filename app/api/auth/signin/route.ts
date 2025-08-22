import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';
import { firebaseUserService } from '@/lib/services/firebase-user-service';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_S = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  console.log(`🔑 [${new Date().toISOString()}] AUTH SIGNIN POST called - User-Agent: ${request.headers.get('user-agent')?.substring(0, 50)}`);
  try {
    const { email, password, idToken } = await request.json();

    let authResult;
    let sessionToken = idToken;

    if (idToken) {
      // Handle Firebase ID token flow (for Google Sign-in)
      console.log('🔐 Verifying Firebase ID token for Google Sign-in');
      authResult = await verifyFirebaseToken(idToken);
      
      if (!authResult.success || !authResult.user) {
        console.error('❌ Firebase ID token verification failed:', authResult.error);
        return NextResponse.json(
          { error: 'Invalid ID token' },
          { status: 401 }
        );
      }
      
      console.log(`✅ Firebase ID token verified for uid: ${authResult.user.uid}`);
      
    } else if (email && password) {
      // Handle email/password flow with real Firebase
      console.log(`🔐 Attempting email/password sign-in for: ${email}`);
      try {
        const signInResult = await firebaseUserService.signInWithEmailAndPassword(email, password);
        
        authResult = {
          success: true,
          user: {
            uid: signInResult.user.uid,
            email: signInResult.user.email,
            name: signInResult.user.displayName,
            email_verified: signInResult.user.emailVerified
          }
        };

        // Use the custom token from Firebase
        sessionToken = signInResult.token;
        console.log(`✅ Email/password sign-in successful for uid: ${authResult.user.uid}`);
      } catch (error) {
        console.error('❌ Firebase email/password sign-in failed:', error);
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

    // Ensure user is properly authenticated
    if (!authResult.user || !authResult.user.uid) {
      console.error('❌ Authentication failed - no user data');
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    try {
      // Ensure user profile exists in Firestore
      console.log(`🔍 Ensuring user profile exists for uid: ${authResult.user.uid}`);
      const userProfile = await firebaseUserService.ensureUserProfile(authResult.user.uid, {
        email: authResult.user.email!,
        displayName: authResult.user.name,
        emailVerified: authResult.user.email_verified
      });
      
      console.log(`✅ User profile confirmed for uid: ${authResult.user.uid}`);
      
      // Set session cookie with the actual token
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_DURATION_S,
        path: '/',
        sameSite: 'lax',
      });
      
      console.log(`🍪 Session cookie set for uid: ${authResult.user.uid}`);

      // Return user data with auth token for localStorage
      return NextResponse.json({
        success: true,
        token: sessionToken, // Include token for frontend storage
        user: {
          uid: userProfile.uid,
          email: userProfile.email,
          name: userProfile.displayName,
          email_verified: userProfile.emailVerified,
          plan: userProfile.plan,
          profilePictureUrl: userProfile.profilePictureUrl,
          createdAt: userProfile.createdAt,
          updatedAt: userProfile.updatedAt
        }
      });
      
    } catch (profileError) {
      console.error('❌ Failed to handle user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to create or retrieve user profile' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Signin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
