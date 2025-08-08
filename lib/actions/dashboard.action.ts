"use server";

import { getCurrentUser } from "@/lib/actions/auth.action";
import { db } from "@/firebase/admin";
import { dummyInterviews } from "@/constants";
import { createMockInterview } from "@/lib/services/mock-interview.service";

// Get user's interviews
export async function getUserInterviews(): Promise<Interview[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // Add timeout and better error handling for Firestore operations
    const interviewsRef = db.collection('interviews');
    const query = interviewsRef
      .where('userId', '==', user.id)
      .orderBy('createdAt', 'desc');
    
    // Add timeout wrapper to prevent hanging requests
    const snapshotPromise = query.get();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), 10000); // 10 second timeout
    });
    
    const snapshot = await Promise.race([snapshotPromise, timeoutPromise]) as FirebaseFirestore.QuerySnapshot;
    
    return snapshot.docs.map((doc: FirebaseFirestore.DocumentData) => ({
      id: doc.id,
      ...doc.data()
    })) as Interview[];
    
  } catch (error) {
    console.error('Error fetching user interviews:', error);
    // Return empty array on any error to prevent page crash
    return [];
  }
}

// Ensure mock interviews exist and return consistent data
export async function ensureMockInterviews(count: number): Promise<Interview[]> {
  try {
    // Query for existing public interviews
    const interviewsRef = db.collection('interviews');
    const query = interviewsRef
      .where('userId', '==', 'public')
      .where('finalized', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(count);
    
    const snapshot = await query.get();
    const existingInterviews = snapshot.docs.map((doc: FirebaseFirestore.DocumentData) => ({
      id: doc.id,
      ...doc.data()
    })) as Interview[];
    
    // If we have enough interviews, return them
    if (existingInterviews.length >= count) {
      return existingInterviews.slice(0, count);
    }
    
    // Calculate how many new interviews we need
    const needed = count - existingInterviews.length;
    console.log(`Creating ${needed} new mock interviews (existing: ${existingInterviews.length})`);
    
    // Create new mock interviews using batch write
    const batch = db.batch();
    const newInterviews: Interview[] = [];
    
    for (let i = 0; i < needed; i++) {
      try {
        // Generate a new mock interview
        const mockInterview = await createMockInterview('public');
        
        // Add to batch
        const docRef = db.collection('interviews').doc(mockInterview.id);
        batch.set(docRef, mockInterview);
        
        newInterviews.push(mockInterview);
      } catch (error) {
        console.error(`Error creating mock interview ${i + 1}:`, error);
        // Continue with other interviews even if one fails
      }
    }
    
    // Commit the batch write
    if (newInterviews.length > 0) {
      await batch.commit();
      console.log(`Successfully created ${newInterviews.length} mock interviews`);
    }
    
    // Combine existing and new interviews
    const allInterviews = [...existingInterviews, ...newInterviews];
    
    // Return the latest interviews (sorted by createdAt desc)
    return allInterviews
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, count);
    
  } catch (error) {
    console.error('Error in ensureMockInterviews:', error);
    // Return empty array on error to prevent page crash
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
    
    const interviews = snapshot.docs.map((doc: FirebaseFirestore.DocumentData) => ({
      id: doc.id,
      ...doc.data()
    })) as Interview[];
    
    // Use mock data if no interviews found
    if (interviews.length === 0) {
      return await ensureMockInterviews(8);
    }
    return interviews;
    
  } catch (error) {
    console.error('Error fetching public interviews:', error);
    // Return mock data on error as fallback
    return await ensureMockInterviews(8);
  }
}

