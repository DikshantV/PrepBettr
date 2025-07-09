import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth, db as adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

interface UpdateProfileRequest {
  name: string;
  password?: string;
  profilePic: string | null;
  about?: string;
  phone?: string;
  workplace?: string;
  skills?: string[];
  experience?: string;
  dateOfBirth?: string;
  idToken: string;
}

export async function POST(req: NextRequest) {
  try {
    const { 
      name, 
      password, 
      profilePic, 
      idToken, 
      about, 
      phone, 
      workplace, 
      skills, 
      experience, 
      dateOfBirth 
    } = await req.json() as UpdateProfileRequest;
    
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
      } catch {
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
      about?: string;
      phone?: string;
      workplace?: string;
      skills?: string[];
      experience?: string;
      dateOfBirth?: string;
      image?: string | null | FieldValue;
      updatedAt: FieldValue;
    } = { 
      name: name.trim(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Add optional fields if they exist
    if (about !== undefined) firestoreUpdate.about = about;
    if (phone !== undefined) firestoreUpdate.phone = phone;
    if (workplace !== undefined) firestoreUpdate.workplace = workplace;
    if (skills !== undefined) firestoreUpdate.skills = skills;
    if (experience !== undefined) firestoreUpdate.experience = experience;
    if (dateOfBirth !== undefined) firestoreUpdate.dateOfBirth = dateOfBirth;

    // Handle profile picture for Firestore
    if (!profilePic || profilePic === '/default-avatar.svg' || profilePic.endsWith('default-avatar.svg')) {
      firestoreUpdate.image = FieldValue.delete();
    } else if (profilePic) {
      try {
        // Basic URL validation
        new URL(profilePic);
        firestoreUpdate.image = profilePic;
      } catch {
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
    
    if (error instanceof Error) {
      if (error.message.includes('auth/weak-password')) {
        return NextResponse.json(
          { error: 'Password should be at least 6 characters' },
          { status: 400 }
        );
      } else if (error.message.includes('auth/email-already-exists')) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      } else if (error.message.includes('auth/invalid-id-token')) {
        return NextResponse.json(
          { error: 'Invalid or expired session. Please sign in again.' },
          { status: 401 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update profile. Please try again.',
        code: 'update_failed'
      },
      { status: 500 }
    );
  }
}
