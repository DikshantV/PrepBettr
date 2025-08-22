/**
 * Firestore Hooks Compatibility Layer
 * 
 * Mock implementations of Firestore hooks for backward compatibility
 * Components using these should be migrated to Azure Cosmos DB
 */

import { useState, useEffect } from 'react';

// Mock interview data structure
interface Interview {
  id: string;
  userId: string;
  questions: string[];
  answers: string[];
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mock useInterview hook
 * @param interviewId - Interview ID to fetch
 * @returns Mock interview data
 */
export function useInterview(interviewId: string) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mock loading behavior
    const timer = setTimeout(() => {
      if (interviewId) {
        // Return mock data
        setInterview({
          id: interviewId,
          userId: 'mock-user',
          questions: ['What is your experience?', 'What are your goals?'],
          answers: ['I have 5 years experience', 'I want to grow'],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [interviewId]);

  return {
    interview,
    loading,
    error,
    updateInterview: async (updates: Partial<Interview>) => {
      // Mock update
      if (interview) {
        setInterview({ ...interview, ...updates, updatedAt: new Date() });
      }
    }
  };
}

/**
 * Mock useInterviews hook
 * @param userId - User ID to fetch interviews for
 * @returns Mock interviews list
 */
export function useInterviews(userId: string) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mock loading behavior
    const timer = setTimeout(() => {
      if (userId) {
        // Return mock data
        setInterviews([
          {
            id: 'interview-1',
            userId,
            questions: ['Tell me about yourself'],
            answers: ['I am a software engineer'],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]);
      }
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [userId]);

  return {
    interviews,
    loading,
    error
  };
}

export type { Interview };
