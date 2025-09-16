/**
 * Common types for PrepBettr application
 * This file exports types that are used across the application
 */

export interface Interview {
  id: string;
  userId: string;
  sessionId?: string;
  title?: string;
  jobTitle?: string; // For backward compatibility
  questions: Question[];
  responses?: string[];
  role?: string;
  company?: string;
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
  level?: 'entry' | 'mid' | 'senior' | 'executive' | 'Junior' | 'Senior' | 'Mid-level' | 'Lead' | 'Principal'; // Alias for experienceLevel with legacy values
  techstack?: string | string[];
  interviewType?: 'behavioral' | 'technical' | 'mixed';
  type?: string; // For backward compatibility
  status?: 'pending' | 'in-progress' | 'completed' | 'failed' | 'draft' | 'finalized' | 'in_progress';
  createdAt: Date | string; // Allow both Date and string for backward compatibility
  updatedAt?: Date | string;
  finalized?: boolean;
  feedbackGenerated?: boolean;
  duration?: number;
  feedback?: Feedback;
  metadata?: {
    duration?: number;
    aiModel?: string;
    [key: string]: unknown;
  };
  // Additional backward compatibility properties
  jobDescription?: string;
  companyLogo?: string;
  companyName?: string;
}

export interface Question {
  id: string;
  text: string;
  question?: string; // For backward compatibility
  category: string;
  difficulty: string;
  type?: 'behavioral' | 'technical';
  expectedAnswer?: string;
  followUp?: string[];
}

// Feedback types
export interface Feedback {
  id: string;
  interviewId: string;
  overallScore?: number;
  totalScore?: number; // For backward compatibility
  categories?: FeedbackCategory[];
  categoryScores?: FeedbackCategory[]; // For backward compatibility
  strengths?: string[];
  improvementAreas?: string[];
  areasForImprovement?: string[]; // For backward compatibility  
  recommendations?: string[];
  detailedAnalysis?: string;
  finalAssessment?: string; // For backward compatibility
  createdAt: Date;
}

export interface FeedbackCategory {
  name: string;
  score: number;
  feedback?: string;
  comment?: string; // For backward compatibility
  suggestions?: string[];
}

export interface SessionState {
  id: string;
  status: 'active' | 'completed' | 'failed';
  phases: InterviewPhase[];
  metadata: Record<string, unknown>;
}

export interface InterviewPhase {
  id: string;
  name: string;
  agentType: string;
  questionCount: number;
  agentConfig: Record<string, unknown>;
}

export interface InterviewConfig {
  sessionId: string;
  phases: InterviewPhase[];
  companyInfo?: {
    name: string;
    industry: string;
    size: string;
  };
  context?: {
    jobRole: string;
    experienceLevel: string;
    skills: string[];
  };
}

// Extended Error interface for application errors
export interface ExtendedError extends Error {
  code?: string;
  status?: number;
  recoverable?: boolean;
}

// Common utility types
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type AsyncResult<T, E = Error> = {
  success: boolean;
  data?: T;
  error?: E | string;
};

// User profile types
export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  emailVerified: boolean;
  plan: 'free' | 'premium';
  profilePictureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Firebase user types
export interface FirebaseUser {
  uid: string;
  email: string;
  name?: string;
  email_verified: boolean;
}

// General User interface
export interface User {
  id: string;
  uid: string;
  email: string;
  name?: string;
  image?: string;
  emailVerified?: boolean;
  metadata?: {
    creationTime: string;
    lastSignInTime: string;
  };
}

// Voice session types
export interface VoiceSessionMetadata {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  quality?: 'low' | 'medium' | 'high';
}

// Telemetry service types
export interface VoiceTelemetryService {
  trackSessionStart: (metadata: VoiceSessionMetadata) => void;
  trackSessionEnd: (metadata: VoiceSessionMetadata) => void;
  trackSessionReady: (metadata: VoiceSessionMetadata) => void;
  trackError: (error: Error, context?: Record<string, unknown>) => void;
  trackTranscript: (data: { sessionId: string; transcript: string }) => void;
  trackAudioResponse: (data: { sessionId: string; audioData: string }) => void;
  trackConfigUpdate: (data: { sessionId: string; config: Record<string, unknown> }) => void;
}

// Test utility types
export type MockedFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T>;
export type MockedObject<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? MockedFunction<T[K]> : T[K];
};

// Next.js route handler types
export type RouteContext<T = Record<string, string>> = {
  params: Promise<T>;
};

export type NextRouteHandler<T = Record<string, string>, R = Response> = (
  request: Request,
  context: RouteContext<T>
) => Promise<R>;

// Common configurations
export interface ConfigOptions {
  inputAudioFormat?: string;
  inputSampleRate?: number;
  language?: string;
  outputAudioFormat?: string;
  outputSampleRate?: number;
  voice?: string;
}

// Component prop types
export interface InterviewCardProps {
  interview?: Interview;
  interviewId?: string;
  userId?: string;
  role?: string;
  type?: string;
  techstack?: string | string[];
  createdAt?: Date | string;
  onSelect?: (interview: Interview) => void;
  className?: string;
}

// Form types
export type FormType = 'sign-in' | 'sign-up' | 'signin' | 'signup' | 'forgot-password';

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
