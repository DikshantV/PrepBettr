"use server";

import { getCurrentUser } from './auth.action';
import { azureCosmosService } from '@/lib/services/azure-cosmos-service';

export async function getFeedbackByInterviewId(interviewId: string) {
  try {
    // Get the authenticated user from server session
    const user = await getCurrentUser();
    
    if (!user) {
      console.error('No authenticated user found');
      return { success: false, error: 'Authentication required' };
    }

    console.log(`Fetching feedback for interview ${interviewId} by user ${user.id}`);

    // Query feedback using Azure Cosmos DB
    const feedback = await azureCosmosService.getFeedbackByInterview(interviewId, user.id);

    if (!feedback) {
      console.log('No feedback found for this interview');
      return { success: true, feedback: null };
    }

    // Convert FeedbackDocument to Feedback interface
    const mappedFeedback: Feedback = {
      id: feedback.id,
      interviewId: feedback.interviewId,
      totalScore: feedback.overallScore,
      categoryScores: [],
      strengths: feedback.strengths,
      areasForImprovement: feedback.improvements,
      finalAssessment: feedback.detailedFeedback,
      createdAt: feedback.createdAt.toISOString()
    };

    console.log('Feedback fetched successfully via server action');
    return { success: true, feedback: mappedFeedback };

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

    const interviews = await azureCosmosService.getUserInterviews(user.id);

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
