"use server";

import { getCurrentUser } from './auth.action';
import { db } from '@/firebase/admin';

export async function getFeedbackByInterviewId(interviewId: string) {
  try {
    // Get the authenticated user from server session
    const user = await getCurrentUser();
    
    if (!user) {
      console.error('No authenticated user found');
      return { success: false, error: 'Authentication required' };
    }

    console.log(`Fetching feedback for interview ${interviewId} by user ${user.id}`);

    // Query feedback collection using server-side Firebase Admin
    const feedbackQuery = db.collection('feedback')
      .where('interviewId', '==', interviewId)
      .where('userId', '==', user.id)
      .limit(1);

    const querySnapshot = await feedbackQuery.get();

    if (querySnapshot.empty) {
      console.log('No feedback found for this interview');
      return { success: true, feedback: null };
    }

    const feedbackDoc = querySnapshot.docs[0];
    const feedback = {
      id: feedbackDoc.id,
      ...feedbackDoc.data()
    };

    console.log('Feedback fetched successfully via server action');
    return { success: true, feedback };

  } catch (error) {
    console.error('Error fetching feedback:', error);
    return { 
      success: false, 
      error: 'Failed to fetch feedback',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getUserInterviews() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const interviewsQuery = db.collection('interviews')
      .where('userId', '==', user.id)
      .orderBy('createdAt', 'desc');

    const querySnapshot = await interviewsQuery.get();
    
    const interviews = querySnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, interviews };

  } catch (error) {
    console.error('Error fetching user interviews:', error);
    return { 
      success: false, 
      error: 'Failed to fetch interviews',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
