"use server";

import { getCurrentUser } from "@/lib/actions/auth.action";
import { azureCosmosService } from "@/lib/services/azure-cosmos-service";
import { dummyInterviews } from "@/constants";
import { createMockInterview } from "@/lib/services/mock-interview.service";

// Get user's interviews
export async function getUserInterviews(): Promise<Interview[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // Use Azure Cosmos DB to get user interviews
    const interviews = await azureCosmosService.getUserInterviews(user.id);
    
    return interviews.map(interview => ({
      id: interview.id,
      userId: interview.userId,
      jobTitle: interview.jobTitle,
      company: interview.company,
      jobDescription: interview.jobDescription,
      questions: interview.questions,
      createdAt: interview.createdAt.toISOString(),
      updatedAt: interview.updatedAt.toISOString(),
      finalized: interview.finalized,
      feedbackGenerated: interview.feedbackGenerated
    }));
    
  } catch (error) {
    console.error('Error fetching user interviews:', error);
    // Return empty array on any error to prevent page crash
    return [];
  }
}

// Ensure mock interviews exist and return consistent data
export async function ensureMockInterviews(count: number): Promise<Interview[]> {
  try {
    // Query for existing public interviews using Azure Cosmos DB
    const existingInterviews = await azureCosmosService.getPublicInterviews('public', count);
    
    // If we have enough interviews, return them
    if (existingInterviews.length >= count) {
      return existingInterviews.slice(0, count).map(interview => ({
        id: interview.id,
        userId: interview.userId,
        jobTitle: interview.jobTitle,
        company: interview.company,
        jobDescription: interview.jobDescription,
        questions: interview.questions,
        createdAt: interview.createdAt.toISOString(),
        updatedAt: interview.updatedAt.toISOString(),
        finalized: interview.finalized,
        feedbackGenerated: interview.feedbackGenerated
      }));
    }
    
    // Calculate how many new interviews we need
    const needed = count - existingInterviews.length;
    console.log(`Creating ${needed} new mock interviews (existing: ${existingInterviews.length})`);
    
    // Create new mock interviews
    const newInterviews: Interview[] = [];
    
    for (let i = 0; i < needed; i++) {
      try {
        // Generate a new mock interview
        const mockInterview = await createMockInterview('public');
        
        // Save to Azure Cosmos DB
        await azureCosmosService.createInterview({
          userId: mockInterview.userId,
          jobTitle: mockInterview.jobTitle,
          company: mockInterview.company,
          jobDescription: mockInterview.jobDescription,
          questions: Array.isArray(mockInterview.questions) && typeof mockInterview.questions[0] === 'string' 
            ? mockInterview.questions.map(q => ({ question: q, category: 'general', difficulty: 'medium' as const }))
            : mockInterview.questions as any,
          createdAt: typeof mockInterview.createdAt === 'string' ? new Date(mockInterview.createdAt) : new Date(),
          updatedAt: typeof mockInterview.updatedAt === 'string' ? new Date(mockInterview.updatedAt) : new Date(),
          finalized: mockInterview.finalized,
          feedbackGenerated: mockInterview.feedbackGenerated
        });
        
        newInterviews.push(mockInterview);
      } catch (error) {
        console.error(`Error creating mock interview ${i + 1}:`, error);
        // Continue with other interviews even if one fails
      }
    }
    
    console.log(`Successfully created ${newInterviews.length} mock interviews`);
    
    // Combine existing and new interviews
    const allInterviews = [...existingInterviews.map(interview => ({
      id: interview.id,
      userId: interview.userId,
      jobTitle: interview.jobTitle,
      company: interview.company,
      jobDescription: interview.jobDescription,
      questions: interview.questions,
      createdAt: interview.createdAt.toISOString(),
      updatedAt: interview.updatedAt.toISOString(),
      finalized: interview.finalized,
      feedbackGenerated: interview.feedbackGenerated
    })), ...newInterviews];
    
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

    // Use Azure Cosmos DB to get public interviews excluding user's own
    const interviews = await azureCosmosService.getPublicInterviewsExcludingUser(user.id, 20);
    
    // Use mock data if no interviews found
    if (interviews.length === 0) {
      return await ensureMockInterviews(8);
    }
    
    return interviews.map(interview => ({
      id: interview.id,
      userId: interview.userId,
      jobTitle: interview.jobTitle,
      company: interview.company,
      jobDescription: interview.jobDescription,
      questions: interview.questions,
      createdAt: interview.createdAt.toISOString(),
      updatedAt: interview.updatedAt.toISOString(),
      finalized: interview.finalized,
      feedbackGenerated: interview.feedbackGenerated
    }));
    
  } catch (error) {
    console.error('Error fetching public interviews:', error);
    // Return mock data on error as fallback
    return await ensureMockInterviews(8);
  }
}

