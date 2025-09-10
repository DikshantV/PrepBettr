import { Question, InterviewContext } from '../types/agent-types';
import { AgentType } from '../agents/agent-factory';

/**
 * Unique identifier for interview sessions
 */
export type SessionId = string;

/**
 * Interview stage definitions
 */
export type InterviewStage = 'technical' | 'behavioral' | 'industry' | 'wrap-up';

/**
 * Interview stage status
 */
export type StageStatus = 'pending' | 'in-progress' | 'completed' | 'skipped' | 'failed';

/**
 * Overall workflow status
 */
export type WorkflowState = 'initializing' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Experience level mapping for interview customization
 */
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'executive';

/**
 * Role type for interview customization
 */
export type RoleType = 'individual-contributor' | 'team-lead' | 'manager' | 'director' | 'executive';

/**
 * Configuration for starting a multi-agent interview
 */
export interface InterviewConfig {
  /** Unique session identifier */
  sessionId: SessionId;
  
  /** Job role being interviewed for */
  role: string;
  
  /** Candidate experience level */
  experienceLevel: ExperienceLevel;
  
  /** Industry or domain */
  industry?: string;
  
  /** Role type for leadership assessment */
  roleType?: RoleType;
  
  /** Company information */
  companyInfo?: {
    name?: string;
    industry?: string;
    size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
    culture?: string;
  };
  
  /** Candidate profile information */
  candidateProfile: {
    name: string;
    email?: string;
    skills: string[];
    previousRoles?: string[];
    yearsExperience?: number;
    education?: string;
    certifications?: string[];
  };
  
  /** Interview customization options */
  customization?: {
    /** Which stages to include */
    enabledStages?: InterviewStage[];
    
    /** Custom stage durations in minutes */
    stageDurations?: Partial<Record<InterviewStage, number>>;
    
    /** Maximum total interview time in minutes */
    maxDurationMinutes?: number;
    
    /** Custom instructions for specific agents */
    customInstructions?: Partial<Record<AgentType, string>>;
    
    /** Agent configuration overrides */
    agentOverrides?: Partial<Record<AgentType, {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }>>;
    
    /** Question count per stage */
    questionsPerStage?: Partial<Record<InterviewStage, number>>;
    
    /** Priority focus areas */
    focusAreas?: string[];
  };
  
  /** Metadata for tracking and analytics */
  metadata?: {
    source?: string;
    recruiterId?: string;
    jobPostingId?: string;
    interviewType?: 'screening' | 'technical' | 'final' | 'cultural-fit';
    scheduledAt?: string;
    tags?: string[];
  };
}

/**
 * Interview stage configuration
 */
export interface InterviewStageConfig {
  /** Stage identifier */
  id: InterviewStage;
  
  /** Display name */
  name: string;
  
  /** Associated agent type */
  agentType: AgentType;
  
  /** Duration in minutes */
  duration: number;
  
  /** Number of questions to generate */
  questionCount: number;
  
  /** Whether this stage is required */
  required: boolean;
  
  /** Conditions for including this stage */
  conditions?: {
    minExperienceLevel?: ExperienceLevel;
    requiredRoles?: RoleType[];
    requiredIndustries?: string[];
  };
  
  /** Stage-specific instructions */
  instructions?: string;
  
  /** Success criteria for stage completion */
  successCriteria?: {
    minQuestionsAnswered?: number;
    minDurationMinutes?: number;
    requiredTopics?: string[];
  };
}

/**
 * Current workflow status
 */
export interface WorkflowStatus {
  /** Session identifier */
  sessionId: SessionId;
  
  /** Current workflow state */
  state: WorkflowState;
  
  /** Current active stage */
  currentStage?: InterviewStage;
  
  /** Current stage index (0-based) */
  currentStageIndex: number;
  
  /** Total number of stages */
  totalStages: number;
  
  /** All stages with their status */
  stages: Array<{
    stage: InterviewStageConfig;
    status: StageStatus;
    startTime?: number;
    endTime?: number;
    questionsGenerated: number;
    questionsAnswered: number;
    error?: string;
  }>;
  
  /** Overall progress percentage (0-100) */
  progressPercentage: number;
  
  /** Time tracking */
  timing: {
    startTime: number;
    currentTime: number;
    elapsedMinutes: number;
    estimatedRemainingMinutes: number;
    totalEstimatedMinutes: number;
  };
  
  /** Active agents */
  activeAgents: AgentType[];
  
  /** Pending agent handoffs */
  pendingAgents: AgentType[];
  
  /** Error information if failed */
  error?: {
    message: string;
    stage?: InterviewStage;
    timestamp: number;
    recoverable: boolean;
  };
  
  /** Real-time metrics */
  metrics: {
    totalQuestionsGenerated: number;
    totalQuestionsAnswered: number;
    averageResponseTime: number;
    stageSwitches: number;
    agentHandoffs: number;
  };
}

/**
 * Interview session state for persistence
 */
export interface SessionState {
  /** Session configuration */
  config: InterviewConfig;
  
  /** Current workflow status */
  status: WorkflowStatus;
  
  /** Interview context that gets passed between agents */
  interviewContext: InterviewContext;
  
  /** All questions generated across stages */
  allQuestions: Question[];
  
  /** Candidate responses (for future implementation) */
  responses?: Array<{
    questionId: string;
    response: string;
    timestamp: number;
    stage: InterviewStage;
    agent: AgentType;
    metadata?: Record<string, any>;
  }>;
  
  /** Stage transition history */
  stageHistory: Array<{
    fromStage?: InterviewStage;
    toStage: InterviewStage;
    timestamp: number;
    reason: string;
    agentHandoff?: {
      fromAgent: AgentType;
      toAgent: AgentType;
    };
  }>;
  
  /** Real-time notes and observations */
  notes: Array<{
    stage: InterviewStage;
    agent: AgentType;
    timestamp: number;
    note: string;
    type: 'observation' | 'recommendation' | 'concern' | 'highlight';
  }>;
  
  /** Session persistence metadata */
  persistence: {
    createdAt: number;
    updatedAt: number;
    version: string;
    checkpoints: Array<{
      stage: InterviewStage;
      timestamp: number;
      state: 'saved' | 'recovered';
    }>;
  };
}

/**
 * Final interview result and feedback
 */
export interface InterviewResult {
  /** Session identifier */
  sessionId: SessionId;
  
  /** Overall interview outcome */
  outcome: 'completed' | 'incomplete' | 'cancelled' | 'failed';
  
  /** Comprehensive summary */
  summary: {
    totalDurationMinutes: number;
    stagesCompleted: number;
    totalStages: number;
    questionsAsked: number;
    questionsAnswered: number;
    overallScore?: number; // 0-100 scale
  };
  
  /** Stage-specific results */
  stageResults: Array<{
    stage: InterviewStageConfig;
    agent: AgentType;
    status: StageStatus;
    duration: number;
    questionsAsked: Question[];
    questionsAnswered: number;
    keyInsights: string[];
    recommendations: string[];
    score?: number; // 0-100 scale
    strengths: string[];
    concerns: string[];
  }>;
  
  /** AI-generated feedback and recommendations */
  feedback: {
    /** Overall assessment */
    overallAssessment: string;
    
    /** Key strengths identified */
    strengths: Array<{
      category: string;
      description: string;
      evidence: string[];
      stage: InterviewStage;
    }>;
    
    /** Areas for improvement */
    improvementAreas: Array<{
      category: string;
      description: string;
      suggestions: string[];
      priority: 'high' | 'medium' | 'low';
      stage: InterviewStage;
    }>;
    
    /** Role fit assessment */
    roleFitAssessment: {
      technicalFit: number; // 0-100
      behavioralFit: number; // 0-100
      industryKnowledge: number; // 0-100
      overallFit: number; // 0-100
      reasoning: string;
    };
    
    /** Next steps and recommendations */
    recommendations: {
      hiring: 'strong-yes' | 'yes' | 'maybe' | 'no' | 'strong-no';
      reasoning: string;
      nextSteps: string[];
      followUpQuestions?: string[];
      additionalAssessments?: string[];
    };
    
    /** Personalized candidate feedback */
    candidateFeedback?: {
      positives: string[];
      developmentAreas: string[];
      resources: string[];
      encouragement: string;
    };
  };
  
  /** Interview analytics and insights */
  analytics: {
    /** Performance metrics */
    metrics: {
      averageResponseTime: number;
      questionDifficulty: 'easy' | 'medium' | 'hard';
      knowledgeAreas: Record<string, number>; // topic -> score
      confidenceLevel: number; // 0-100
      communicationClarity: number; // 0-100
    };
    
    /** Behavioral patterns */
    patterns: {
      responseLength: 'concise' | 'detailed' | 'verbose';
      questioningStyle: 'clarifying' | 'deep-diving' | 'surface-level';
      confidenceIndicators: string[];
      stressIndicators: string[];
    };
    
    /** Comparative analysis */
    benchmarks?: {
      industryAverage: number;
      roleAverage: number;
      experienceLevelAverage: number;
      percentile: number;
    };
  };
  
  /** Export and sharing options */
  exports: {
    /** PDF report generation metadata */
    reportAvailable: boolean;
    
    /** Shareable summary for candidate */
    candidateSummary?: {
      overallScore: number;
      keyStrengths: string[];
      developmentAreas: string[];
      nextSteps: string[];
    };
    
    /** Detailed recruiter report */
    recruiterReport?: {
      recommendation: string;
      detailedAssessment: string;
      competencyBreakdown: Record<string, number>;
      interviewNotes: string[];
    };
  };
  
  /** Metadata for tracking and analytics */
  metadata: {
    generatedAt: number;
    generationDuration: number;
    aiModelsUsed: AgentType[];
    totalCost: number;
    totalTokensUsed: number;
    qualityScore: number; // Interview process quality 0-100
  };
}

/**
 * Agent handoff information
 */
export interface AgentHandoff {
  /** Session identifier */
  sessionId: SessionId;
  
  /** Source agent */
  fromAgent?: AgentType;
  
  /** Target agent */
  toAgent: AgentType;
  
  /** Handoff context */
  context: {
    /** Completed questions from previous stages */
    previousQuestions: Question[];
    
    /** Key insights to pass along */
    insights: string[];
    
    /** Areas of focus for next agent */
    focusAreas: string[];
    
    /** Continuation instructions */
    instructions?: string;
  };
  
  /** Handoff timestamp */
  timestamp: number;
}

/**
 * Error types for workflow operations
 */
export interface WorkflowError extends Error {
  code: 'SESSION_NOT_FOUND' | 'INVALID_STATE' | 'AGENT_ERROR' | 'TIMEOUT' | 'CONFIGURATION_ERROR';
  sessionId: SessionId;
  stage?: InterviewStage;
  agent?: AgentType;
  recoverable: boolean;
  metadata?: Record<string, any>;
}
