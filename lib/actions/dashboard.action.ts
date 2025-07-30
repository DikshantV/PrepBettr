"use server";

import { getCurrentUser } from "@/lib/actions/auth.action";
import { db } from "@/firebase/admin";
import { UserUsageCounters, UsageCounter } from "@/types/subscription";

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

// Get user's usage counters
export async function getUserUsage(): Promise<UserUsageCounters | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const countersRef = db.collection('usage').doc(user.id).collection('counters');
    const snapshot = await countersRef.get();
    
    const usageData: Partial<UserUsageCounters> = {};
    
    snapshot.docs.forEach((doc: FirebaseFirestore.DocumentData) => {
      const data = doc.data();
      const counter: UsageCounter = {
        count: data.count || 0,
        limit: data.limit || 0,
        updatedAt: data.updatedAt?.toDate() || new Date()
      };
      
      (usageData as any)[doc.id] = counter;
    });

    // Ensure we have all required counters, even if they don't exist yet
    const completeUsage: UserUsageCounters = {
      interviews: usageData.interviews || { count: 0, limit: 0, updatedAt: new Date() },
      resumeTailor: usageData.resumeTailor || { count: 0, limit: 0, updatedAt: new Date() },
      autoApply: usageData.autoApply || { count: 0, limit: 0, updatedAt: new Date() },
      coverLetterGenerator: usageData.coverLetterGenerator || { count: 0, limit: 0, updatedAt: new Date() },
    };

    return completeUsage;
    
  } catch (error) {
    console.error('Error fetching user usage:', error);
    return null;
  }
}
