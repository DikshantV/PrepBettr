import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';
import { firebaseUserService } from '@/lib/services/firebase-user-service';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_S = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  console.log(`🆕 [${new Date().toISOString()}] AUTH SIGNUP POST called`);
  try {
    const { email, password, name, idToken } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    let authResult;
    let sessionToken = idToken;
    let isNewUser = false;

    if (idToken) {
      // Handle Firebase ID token flow (for Google Sign-in)
      console.log('🔐 Verifying Firebase ID token for Google Sign-up');
      authResult = await verifyFirebaseToken(idToken);
      
      if (!authResult.success || !authResult.user) {
        console.error('❌ Firebase ID token verification failed:', authResult.error);
        return NextResponse.json(
          { error: 'Invalid ID token' },
          { status: 401 }
        );
      }
      
      console.log(`✅ Firebase ID token verified for uid: ${authResult.user.uid}`);
      
      // For Google sign-in, user already exists in Firebase Auth
      // We just need to ensure the profile exists in Firestore
      
    } else if (password) {
      // Handle email/password flow - create new Firebase Auth user
      console.log(`🆕 Creating new Firebase Auth user for: ${email}`);
      try {
        const newUserRecord = await firebaseUserService.createAuthUser({
          email,
          password,
          displayName: name,
          emailVerified: false
        });
        
        authResult = {
          success: true,
          user: {
            uid: newUserRecord.uid,
            email: newUserRecord.email!,
            name: newUserRecord.displayName || name,
            email_verified: newUserRecord.emailVerified
          }
        };

        // Create a custom token for the new user
        const auth = await import('@/lib/firebase/admin').then(m => m.getAdminAuth());
        sessionToken = await auth.createCustomToken(newUserRecord.uid);
        isNewUser = true;
        
        console.log(`✅ Firebase Auth user created for uid: ${authResult.user.uid}`);
      } catch (error: any) {
        console.error('❌ Firebase Auth user creation failed:', error);
        
        // Handle specific Firebase Auth errors
        if (error.code === 'auth/email-already-exists') {
          return NextResponse.json(
            { error: 'Email already in use' },
            { status: 409 }
          );
        }
        
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

    if (!authResult.user || !authResult.user.uid) {
      console.error('❌ Authentication failed - no user data');
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    try {
      // Check if user profile already exists in Firestore
      console.log(`🔍 Checking if user profile exists for uid: ${authResult.user.uid}`);
      const existingProfile = await firebaseUserService.getUserProfile(authResult.user.uid);
      
      if (existingProfile && !isNewUser) {
        console.log(`⚠️ User profile already exists for uid: ${authResult.user.uid}`);
        return NextResponse.json(
          { error: 'User already exists' },
          { status: 409 }
        );
      }

      // Create or ensure user profile exists in Firestore
      const userProfile = await firebaseUserService.ensureUserProfile(authResult.user.uid, {
        email: authResult.user.email,
        displayName: authResult.user.name || name,
        emailVerified: authResult.user.email_verified,
        plan: 'free'
      });
      
      console.log(`✅ User profile ${existingProfile ? 'confirmed' : 'created'} for uid: ${authResult.user.uid}`);

      // Set session cookie
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_DURATION_S,
        path: '/',
        sameSite: 'lax',
      });
      
      console.log(`🍪 Session cookie set for uid: ${authResult.user.uid}`);

      // Return success with user data and token for localStorage
      return NextResponse.json({
        success: true,
        token: sessionToken,
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
        { error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
