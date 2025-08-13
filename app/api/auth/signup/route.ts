import { NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';
import { azureFunctionsClient } from '@/lib/services/azure-functions-client';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { emailVerificationService } from '@/lib/services/email-verification-service';

export async function POST(request: Request) {
  try {
    const { idToken, name, email } = await request.json();
    const userName = name || email.split('@')[0];
    
    if (!idToken || !email) {
      return NextResponse.json(
        { error: 'ID token and email are required' },
        { status: 400 }
      );
    }

    // Verify the ID token using Azure Functions first, fallback to Firebase
    let decodedToken;
    let uid;
    
    try {
      // Try Azure Function verification first
      const azureResult = await azureFunctionsClient.verifyToken(idToken);
      
      if (azureResult.valid && azureResult.decoded) {
        decodedToken = azureResult.decoded;
        uid = decodedToken.uid;
        console.log('Token verified successfully via Azure Function for signup');
      } else {
        throw new Error(azureResult.error || 'Azure Function verification failed');
      }
    } catch (azureError) {
      console.warn('Azure Function verification failed for signup, falling back to Firebase:', azureError);
      
      try {
        // Fallback to Firebase Admin SDK
        decodedToken = await auth.verifyIdToken(idToken);
        uid = decodedToken.uid;
        console.log('Token verified successfully via Firebase Admin SDK (fallback)');
      } catch (firebaseError) {
        console.error('Both Azure and Firebase token verification failed for signup:', firebaseError);
        return NextResponse.json(
          { error: 'Token verification failed' },
          { status: 401 }
        );
      }
    }

    // Check if user already exists
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (userDoc.exists) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Create user in Firestore
    await db.collection('users').doc(uid).set({
      id: uid,
      name: userName,
      email,
      image: '/default-avatar.svg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      emailVerified: false
    });

    const verificationUrl = `${process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'}/api/auth/verify-email?token`;
    const { success, error } = await emailVerificationService.sendVerificationEmail(uid, email, userName);

    if (!success) {
      return NextResponse.json(
        { error: `Failed to send verification email: ${error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Verification email sent. Please check your inbox.' });
    
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create user account' },
      { status: 500 }
    );
  }
}
