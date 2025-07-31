"use server";

import { getCurrentUser } from "@/lib/actions/auth.action";
import { db } from "@/firebase/admin";

// Get user's interviews
export async function getUserInterviews(): Promise<Interview[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const interviewsRef = db.collection('interviews');
    const query = interviewsRef
      .where('userId', '==', user.id)
      .orderBy('createdAt', 'desc');
    
    const snapshot = await query.get();
    
    return snapshot.docs.map((doc: FirebaseFirestore.DocumentData) => ({
      id: doc.id,
      ...doc.data()
    })) as Interview[];
    
  } catch (error) {
    console.error('Error fetching user interviews:', error);
    return [];
  }
}

// Get public/finalized interviews (excluding user's own)
export async function getPublicInterviews(): Promise<Interview[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const interviewsRef = db.collection('interviews');
    const query = interviewsRef
      .where('finalized', '==', true)
      .where('userId', '!=', user.id)
      .orderBy('createdAt', 'desc')
      .limit(20);
    
    const snapshot = await query.get();
    
    return snapshot.docs.map((doc: FirebaseFirestore.DocumentData) => ({
      id: doc.id,
      ...doc.data()
    })) as Interview[];
    
  } catch (error) {
    console.error('Error fetching public interviews:', error);
    return [];
  }
}

