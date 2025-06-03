import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth, db as adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

interface UpdateProfileRequest {
  name: string;
  password?: string;
  profilePic: string | null;
  idToken: string;
}

export async function POST(req: NextRequest) {
  try {
    const { name, password, profilePic, idToken } = await req.json() as UpdateProfileRequest;
    
    if (!idToken) {
      return NextResponse.json(
        { success: false, error: 'No ID token provided' }, 
        { status: 401 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Prepare update data for Firebase Auth
    const authUpdate: {
      displayName: string;
      photoURL?: string | null;
      password?: string;
    } = {
      displayName: name.trim()
    };

    // Handle profile picture update
    if (profilePic === null || profilePic === '') {
      authUpdate.photoURL = null;
    } else if (typeof profilePic === 'string') {
      try {
        // Basic URL validation
        new URL(profilePic);
        authUpdate.photoURL = profilePic;
      } catch (e) {
        console.warn('Invalid URL for profile picture, setting to null');
        authUpdate.photoURL = null;
      }
    }

    // Add password to update if provided and not empty
    if (password && password.trim() !== '') {
      // Add password validation
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters long' },
          { status: 400 }
        );
      }
      authUpdate.password = password.trim();
    }

    // Update Firebase Auth
    await adminAuth.updateUser(uid, authUpdate);


    // Prepare Firestore update
    const firestoreUpdate: {
      name: string;
      image?: string | null | FieldValue;
      updatedAt?: FieldValue;
    } = { 
      name,
      updatedAt: FieldValue.serverTimestamp()
    };

    // Handle profile picture for Firestore
    if (!profilePic || profilePic === '/default-avatar.svg' || profilePic.endsWith('default-avatar.svg')) {
      firestoreUpdate.image = FieldValue.delete();
    } else if (profilePic) {
      try {
        // Basic URL validation
        new URL(profilePic);
        firestoreUpdate.image = profilePic;
      } catch (e) {
        console.warn('Invalid profile picture URL, setting to default');
        firestoreUpdate.image = FieldValue.delete();
      }
    }
    
    // Update Firestore
    await adminDb.collection('users').doc(uid).set(firestoreUpdate, { merge: true });

    // Get updated user data
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    
    return NextResponse.json({ 
      success: true,
      user: {
        id: uid,
        name: name,
        email: userData?.email,
        image: userData?.image || '/default-avatar.svg'
      }
    });

  } catch (error: unknown) {
    console.error('Error updating profile:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to update profile';
    const errorCode = error instanceof Error 
      ? error.name 
      : 'unknown_error';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        code: errorCode
      }, 
      { status: 500 }
    );
  }
}
