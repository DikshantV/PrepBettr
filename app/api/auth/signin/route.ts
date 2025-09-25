import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/middleware/authMiddleware';
import { firebaseUserService } from '@/lib/services/firebase-user-service';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_S = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`🔑 [${timestamp}] AUTH SIGNIN POST called - User-Agent: ${request.headers.get('user-agent')?.substring(0, 50)}`);
  try {
    const { email, password, idToken } = await request.json();
    
    console.log(`🔑 [${timestamp}] Signin request details:`, {
      hasEmail: !!email,
      hasPassword: !!password,
      hasIdToken: !!idToken,
      idTokenPrefix: idToken ? idToken.substring(0, 50) + '...' : 'none'
    });

    let authResult;
    let sessionToken = idToken;

    if (idToken) {
      // Handle Firebase ID token flow (for Google Sign-in)
      console.log(`🔐 [${timestamp}] Verifying Firebase ID token for Google Sign-in`);
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
