import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { FieldValue } from 'firebase-admin/firestore';

const DEFAULT_USAGE_LIMITS = {
  free: {
    interviews: { count: 0, limit: 3 },
    resumeTailor: { count: 0, limit: 2 },
    autoApply: { count: 0, limit: 1 },
  },
  premium: {
    interviews: { count: 0, limit: -1 },
    resumeTailor: { count: 0, limit: -1 },
    autoApply: { count: 0, limit: -1 },
  },
};

export async function POST(request: NextRequest) {
  try {
    // Get session cookie from request
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the session token
    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid session',
          details: verificationResult.error 
        },
        { status: 401 }
      );
    }

    const userId = verificationResult.decodedToken.uid;
    const db = getAdminFirestore();

    // Get user's current plan
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userPlan = userData?.plan || 'free';

    // Check if usage counters already exist
    const countersSnapshot = await db
      .collection('usage')
      .doc(userId)
      .collection('counters')
      .get();

    if (!countersSnapshot.empty) {
      return NextResponse.json({ 
        message: 'Usage counters already exist',
        initialized: false
      });
    }

    // Initialize usage counters
    const defaultCounters = DEFAULT_USAGE_LIMITS[userPlan as keyof typeof DEFAULT_USAGE_LIMITS];
    const batch = db.batch();

    Object.entries(defaultCounters).forEach(([feature, counter]) => {
      const counterRef = db
        .collection('usage')
        .doc(userId)
        .collection('counters')
        .doc(feature);
      
      batch.set(counterRef, {
        ...counter,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    return NextResponse.json({ 
      message: 'Usage counters initialized successfully',
      initialized: true,
      plan: userPlan
    });

  } catch (error) {
    console.error('Error initializing usage counters:', error);
    return NextResponse.json(
      { error: 'Failed to initialize usage counters' },
      { status: 500 }
    );
  }
}
