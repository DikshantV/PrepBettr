/**
 * Realtime Firestore Hooks Compatibility Layer
 * 
 * SWR-based implementations of realtime Firestore hooks for backward compatibility
 * Components using these should be migrated to Azure services with SignalR
 */

import { useState, useEffect } from 'react';

// Mock data structures
interface Interview {
  id: string;
  userId: string;
  status: 'pending' | 'in-progress' | 'completed';
  questions: string[];
  answers: string[];
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ApplicationStatus {
  id: string;
  userId: string;
  status: 'processing' | 'completed' | 'error';
  progress: number;
  details: {
    stage: string;
    message: string;
    warningMessages?: string[];
  };
  updatedAt: Date;
}

/**
 * Mock useRealtimeInterview hook
 * @param interviewId - Interview ID to watch
 * @returns Realtime interview data
 */
export function useRealtimeInterview(interviewId: string) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interviewId) {
      setLoading(false);
      return;
    }

    // Mock realtime updates
    const timer = setTimeout(() => {
      setInterview({
        id: interviewId,
        userId: 'mock-user',
        status: 'in-progress',
        questions: ['What is your experience?', 'What are your goals?'],
        answers: ['I have 5 years experience', 'I want to grow'],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      setLoading(false);
    }, 1000);

    // Remove periodic updates to prevent polling loops
    // Real implementations should use SignalR or WebSocket connections
    // const updateTimer = setInterval(() => {
    //   setInterview(prev => prev ? {
    //     ...prev,
    //     updatedAt: new Date()
    //   } : null);
    // }, 10000);

    return () => {
      clearTimeout(timer);
      // clearInterval(updateTimer); // Commented out since updateTimer is no longer defined
    };
  }, [interviewId]);

  return {
    interview,
    loading,
    error
  };
}

/**
 * Mock useRealtimeApplicationStatus hook
 * @param applicationId - Application ID to watch
 * @returns Realtime application status
 */
export function useRealtimeApplicationStatus(applicationId: string) {
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) {
      setLoading(false);
      return;
    }

    // Mock realtime status updates
    let progress = 0;
    const stages = [
      'Initializing application',
      'Processing documents',
      'Analyzing requirements',
      'Generating response',
      'Finalizing application'
    ];

    const updateStatus = () => {
      if (progress < 100) {
        progress += 20;
        const stageIndex = Math.floor(progress / 20) - 1;
        
        setStatus({
          id: applicationId,
          userId: 'mock-user',
          status: progress < 100 ? 'processing' : 'completed',
          progress,
          details: {
            stage: stages[stageIndex] || 'Completed',
            message: `Processing... ${progress}% complete`,
            warningMessages: progress > 60 ? ['Quality check passed'] : undefined
          },
          updatedAt: new Date()
        });

        if (progress >= 100) {
          setLoading(false);
        }
      }
    };

    const initialTimer = setTimeout(() => {
      updateStatus();
      setLoading(false);
    }, 500);

    const progressTimer = setInterval(updateStatus, 2000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(progressTimer);
    };
  }, [applicationId]);

  return {
    status,
    loading,
    error
  };
}

// Static mock data for dashboard - no API calls
export function useRealtimeUserInterviews(userId?: string) {
  // Return static mock data immediately, no API calls
  const interviews = userId ? [
    {
      id: 'mock-interview-user',
      userId,
      role: 'Software Engineer',
      type: 'technical',
      techstack: ['React', 'TypeScript'],
      status: 'completed',
      questions: ['Tell me about yourself'],
      answers: ['I am a developer'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ] : [];

  return { 
    data: interviews,
    isLoading: false,
    error: null
  };
}

export function useRealtimePublicInterviews(limit: number = 4) {
  // Return static mock data immediately, no API calls
  const interviews = [
    {
      id: 'public-interview-1',
      userId: 'public-user-1',
      role: 'Frontend Developer',
      type: 'technical',
      techstack: ['React', 'JavaScript'],
      status: 'completed',
      questions: ['How do you handle state management?'],
      answers: ['I use React hooks and context'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'public-interview-2',
      userId: 'public-user-2',
      role: 'Backend Developer',
      type: 'technical', 
      techstack: ['Node.js', 'Python'],
      status: 'completed',
      questions: ['Explain REST API design'],
      answers: ['REST follows HTTP principles with resources'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'public-interview-3',
      userId: 'public-user-3',
      role: 'Data Scientist',
      type: 'technical',
      techstack: ['Python', 'Machine Learning'],
      status: 'completed',
      questions: ['Explain supervised learning'],
      answers: ['Uses labeled data to train models'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ].slice(0, limit);

  return { 
    data: interviews,
    isLoading: false,
    error: null
  };
}

export function useRealtimeFeedback(interviewId: string) {
  const [feedback, setFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interviewId) {
      setLoading(false);
      return;
    }

    // Mock feedback loading
    setTimeout(() => {
      setFeedback({
        id: interviewId,
        score: 85,
        comments: 'Great performance!',
        areas: ['Technical skills', 'Communication'],
        createdAt: new Date()
      });
      setLoading(false);
    }, 1000);
  }, [interviewId]);

  return { feedback, loading, error };
}

export type { Interview, ApplicationStatus };
