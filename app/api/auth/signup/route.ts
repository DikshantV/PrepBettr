import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';
import { firebaseUserService } from '@/lib/services/firebase-user-service';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_S = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`🆕 [${timestamp}] AUTH SIGNUP POST called`);
  
  try {
    const { email, password, name, idToken } = await request.json();
    
    console.log(`🆕 [${timestamp}] Signup request details:`, {
      hasEmail: !!email,
      hasPassword: !!password,
      hasName: !!name,
      hasIdToken: !!idToken,
      idTokenPrefix: idToken ? idToken.substring(0, 50) + '...' : 'none'
    });

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
      console.log(`🔐 [${timestamp}] Verifying Firebase ID token for Google Sign-up`);
      console.log(`🔐 [${timestamp}] ID Token format check:`, {
        length: idToken.length,
        parts: idToken.split('.').length,
        startsCorrectly: idToken.startsWith('eyJ'),
        preview: idToken.substring(0, 100) + '...'
      });
      
      console.log(`🔍 [${timestamp}] Environment check before token verification:`, {
        hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'not set',
        nodeEnv: process.env.NODE_ENV,
        privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0
      });
      
      try {
        console.log(`🔍 [${timestamp}] About to call verifyFirebaseToken with token:`, {
          tokenLength: idToken.length,
          tokenParts: idToken.split('.').length,
          tokenHeader: idToken.split('.')[0] ? 'present' : 'missing',
          tokenPayload: idToken.split('.')[1] ? 'present' : 'missing',
          tokenSignature: idToken.split('.')[2] ? 'present' : 'missing'
        });
        
        authResult = await verifyFirebaseToken(idToken);
        console.log(`🔐 [${timestamp}] Firebase token verification result:`, {
          success: authResult.success,
          hasUser: !!authResult.user,
          uid: authResult.user?.uid,
          error: authResult.error
        });
      } catch (verifyError) {
        console.error(`🔐 [${timestamp}] Firebase token verification threw error:`, {
          error: verifyError instanceof Error ? verifyError.message : 'Unknown error',
          stack: verifyError instanceof Error ? verifyError.stack?.substring(0, 500) + '...' : 'No stack trace',
          code: verifyError instanceof Error ? (verifyError as any).code : 'unknown',
          name: verifyError instanceof Error ? verifyError.name : 'unknown'
        });
        authResult = {
          success: false,
          user: null,
          error: verifyError instanceof Error ? verifyError.message : 'Token verification failed'
        };
      }
      
      if (!authResult.success || !authResult.user) {
        console.error(`❌ [${timestamp}] Firebase ID token verification failed:`, {
          error: authResult.error,
          success: authResult.success,
          hasUser: !!authResult.user
        });
        return NextResponse.json(
          { error: `Invalid ID token: ${authResult.error}` },
          { status: 401 }
        );
      }
      
      console.log(`✅ [${timestamp}] Firebase ID token verified for uid: ${authResult.user.uid}`);
      console.log(`✅ [${timestamp}] Token claims:`, {
        email: authResult.user.email,
        name: authResult.user.name,
        emailVerified: authResult.user.email_verified
      });
      
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
          console.log(`⚠️ Account creation attempt for existing email: ${email}`);
          return NextResponse.json(
            { 
              error: 'This email is already registered. Please sign in instead or use a different email.',
              code: 'email_already_exists',
              action: 'redirect_to_signin'
            },
            { status: 409 }
          );
        }
        
        if (error.code === 'auth/invalid-email') {
          return NextResponse.json(
            { 
              error: 'Please enter a valid email address.',
              code: 'invalid_email'
            },
            { status: 400 }
          );
        }
        
        if (error.code === 'auth/weak-password') {
          return NextResponse.json(
            { 
              error: 'Password must be at least 6 characters long.',
              code: 'weak_password'
            },
            { status: 400 }
          );
        }
        
        // Generic Firebase error handling
        const errorMessage = error.message || 'Failed to create account';
        console.error(`❌ Unhandled Firebase Auth error code: ${error.code}, message: ${errorMessage}`);
        
        return NextResponse.json(
          { 
            error: errorMessage.includes('Firebase') ? 'Authentication service error. Please try again.' : errorMessage,
            code: error.code || 'auth_error'
          },
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

      // Create or ensure user profile exists in Firestore with retry logic
      let userProfile;
      try {
        userProfile = await firebaseUserService.ensureUserProfile(authResult.user.uid, {
          email: authResult.user.email,
          displayName: authResult.user.name || name,
          emailVerified: authResult.user.email_verified,
          plan: 'free'
        });
      } catch (profileError) {
        console.error(`❌ Failed to create user profile for uid: ${authResult.user.uid}:`, profileError);
        
        // If this was a new Firebase Auth user creation and profile creation failed,
        // we should clean up the orphaned Firebase Auth account
        if (isNewUser) {
          console.log(`🧹 Cleaning up orphaned Firebase Auth account for uid: ${authResult.user.uid}`);
          try {
            await firebaseUserService.deleteUser(authResult.user.uid);
            console.log(`✅ Cleaned up orphaned Firebase Auth account`);
          } catch (cleanupError) {
            console.error(`❌ Failed to cleanup orphaned Firebase Auth account:`, cleanupError);
            // Don't fail the request for cleanup errors - log for manual review
          }
        }
        
        throw profileError;
      }
      
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
