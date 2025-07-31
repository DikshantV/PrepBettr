import { NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';
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

    // Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

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
