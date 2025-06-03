import { NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

export async function POST(request: Request) {
  try {
    const { idToken, name, email } = await request.json();
    
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
      name: name || email.split('@')[0],
      email,
      image: '/default-avatar.svg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create user account' },
      { status: 500 }
    );
  }
}
