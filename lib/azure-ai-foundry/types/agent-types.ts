/**
 * Agent Types for Azure AI Foundry
 * 
 * Unified type definitions for interview agents and questions
 */

// ===== CORE INTERFACES =====

export interface Question {
  id: string;
  text: string;
  type: 'technical' | 'behavioral' | 'industry' | 'general';
  category?: 'technical' | 'behavioral' | 'industry' | 'general'; // alias for compatibility
  difficulty: 'easy' | 'medium' | 'hard';
  expectedDuration?: number; // in seconds
  expectedAnswer?: string;
  followUpQuestions?: string[];
  tags?: string[];
  metadata?: {
    skill?: string;
    topic?: string;
    scenario?: string;
    category?: string;
    keywords?: string[];
    estimatedTime?: number;
  };
}

export interface CandidateProfile {
  name?: string;
  experience: string;
  skills: string[];
  targetRole: string;
  industry: string;
  resumeContent?: string;
  previousRoles?: string[];
  yearsExperience?: number;
  education?: string;
  certifications?: string[];
}

export interface CompanyInfo {
  name?: string;
  industry?: string;
  size?: string;
  description?: string;
}

export interface SessionHistory {
  previousQuestions: Question[];
  previousAnswers?: Array<{
    questionId: string;
    answer: string;
    timestamp: number;
  }>;
}

export interface InterviewContext {
  sessionId: string;
  candidateName: string;
  role: string;
  experienceLevel: 'entry' | 'mid' | 'senior' | 'executive';
  industry?: string;
  resumeContent?: string;
  candidateProfile: CandidateProfile;
  jobRole?: string;
  companyInfo?: CompanyInfo;
  sessionHistory?: SessionHistory;
  interviewConfig: {
    duration: number; // total interview duration in minutes
    focusAreas: string[];
    difficulty: 'entry' | 'mid' | 'senior' | 'expert';
    includeFollowUps: boolean;
  };
  previousQuestions: Question[];
  previousAnswers: Array<{
    questionId: string;
    answer: string;
    timestamp: number;
  }>;
  currentPhase: 'technical' | 'behavioral' | 'industry' | 'wrap-up';
  responses?: {
    questionId: string;
    response: string;
    timestamp: Date;
  }[];
  metadata: Record<string, any>;
}

export interface SessionState {
  sessionId: string;
  currentAgent: string;
  phase: 'technical' | 'behavioral' | 'industry' | 'completed';
  startTime: Date;
  lastActivity: Date;
  context: InterviewContext;
  agentQueue: string[];
  completedAgents: string[];
  metadata: {
    totalQuestions: number;
    averageResponseTime: number;
    completionPercentage: number;
  };
}

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  supportedPhases: string[];
  capabilities: string[];
  modelRequirements: {
    minimumTokens: number;
    preferredModels: string[];
  };
  tags: string[];
  // Legacy compatibility fields
  specialty?: string;
  modelPreference?: string;
  maxQuestions?: number;
  averageDuration?: number; // in minutes
}

export interface AgentConfig {
  agentId: string;
  model: string;
  systemInstructions: string;
  temperature: number;
  maxTokens: number;
}

export interface FoundryAgent {
  id: string;
  name: string;
  type: 'technical' | 'behavioral' | 'industry' | 'general';
  metadata: AgentMetadata;
  generateQuestions(context: InterviewContext): Promise<Question[]>;
  processResponse(response: string, context: InterviewContext): Promise<string>;
  isComplete(context: InterviewContext): boolean;
}
