import { AgentFactory, AgentType } from '../agents/agent-factory';
import { AgentOrchestrator } from '../agents/agent-orchestrator';
import type { InterviewContext } from '../types/agent-types';
import type {
  InterviewConfig,
  WorkflowStatus,
  InterviewResult,
  SessionId,
  InterviewStage,
  InterviewStageConfig,
  ExperienceLevel,
  SessionState as WorkflowSessionState
} from './workflow-types';

/**
 * In-memory session store for simplicity. Replace with Redis/Firestore in production.
 */
const sessionStore: Map<SessionId, WorkflowSessionState> = new Map();

/**
 * Default stage durations (minutes)
 */
const DEFAULT_STAGE_DURATIONS: Record<InterviewStage, number> = {
  technical: 15,
  behavioral: 10,
  industry: 10,
  'wrap-up': 5
};

/**
 * Default questions per stage
 */
const DEFAULT_QUESTIONS_PER_STAGE: Record<InterviewStage, number> = {
  technical: 6,
  behavioral: 5,
  industry: 4,
  'wrap-up': 0
};

/**
 * Map experience level to agent parameter adjustments
 */
function getExperienceAdjustments(level: ExperienceLevel): { temperature: number; maxTokens: number } {
  switch (level) {
    case 'entry':
      return { temperature: 0.3, maxTokens: 1200 };
    case 'senior':
      return { temperature: 0.6, maxTokens: 1800 };
    case 'executive':
      return { temperature: 0.7, maxTokens: 2000 };
    case 'mid':
    default:
      return { temperature: 0.5, maxTokens: 1500 };
  }
}

/**
 * Build interview phases based on configuration
 */
function buildPhases(config: InterviewConfig): InterviewStageConfig[] {
  const stages: InterviewStage[] = config.customization?.enabledStages ?? ['technical', 'behavioral', 'industry', 'wrap-up'];
  const durations = { ...DEFAULT_STAGE_DURATIONS, ...(config.customization?.stageDurations || {}) };
  const questionCounts = { ...DEFAULT_QUESTIONS_PER_STAGE, ...(config.customization?.questionsPerStage || {}) };

  const base: InterviewStageConfig[] = [
    {
      id: 'technical',
      name: 'Technical Assessment',
      agentType: 'technical',
      duration: durations.technical,
      questionCount: questionCounts.technical,
      required: true,
      conditions: { minExperienceLevel: 'entry' },
      instructions: `Focus on ${config.role} fundamentals and practical problem solving.`
    },
    {
      id: 'behavioral',
      name: 'Behavioral Evaluation',
      agentType: 'behavioral',
      duration: durations.behavioral,
      questionCount: questionCounts.behavioral,
      required: true,
      instructions: 'Assess teamwork, leadership potential, and communication.'
    },
    {
      id: 'industry',
      name: 'Industry Knowledge Check',
      agentType: 'industry',
      duration: durations.industry,
      questionCount: questionCounts.industry,
      required: false,
      conditions: { minExperienceLevel: 'mid' },
      instructions: `Tailor to ${config.industry || config.companyInfo?.industry || 'the target'} industry.`
    },
    {
      id: 'wrap-up',
      name: 'Wrap-up and Feedback',
      agentType: 'behavioral',
      duration: durations['wrap-up'],
      questionCount: questionCounts['wrap-up'],
      required: true,
      instructions: 'Summarize key insights and provide feedback.'
    }
  ];

  return base.filter(s => stages.includes(s.id));
}

/**
 * InterviewWorkflow orchestrates a multi-agent interview using AgentOrchestrator
 */
export class InterviewWorkflow {
  private factory = AgentFactory.getInstance();
  private orchestrator = new AgentOrchestrator();

  /**
   * Start a multi-agent interview and return a session ID
   */
  async startMultiAgentInterview(config: InterviewConfig): Promise<SessionId> {
    // Build phases and select agents
    const phases = buildPhases(config);

    // Adjust agent configs by experience level and apply any overrides
    const adjustments = getExperienceAdjustments(config.experienceLevel);

    // Transform candidateProfile to match CandidateProfile interface
    const transformedCandidateProfile = {
      name: config.candidateProfile.name,
      experience: `${config.experienceLevel} level`, // Map experienceLevel to experience string
      skills: config.candidateProfile.skills,
      targetRole: config.role, // Map role to targetRole
      industry: config.industry || config.companyInfo?.industry || 'Technology', // Default to Technology if not specified
      previousRoles: config.candidateProfile.previousRoles,
      yearsExperience: config.candidateProfile.yearsExperience,
      education: config.candidateProfile.education,
      certifications: config.candidateProfile.certifications
    };

    // Build orchestrator session config
    const orchestratorConfig = this.orchestrator.createStandardSession({
      sessionId: config.sessionId,
      candidateProfile: transformedCandidateProfile,
      jobRole: config.role,
      companyInfo: config.companyInfo,
      experienceLevel: config.experienceLevel,
      includePhases: {
        technical: !!phases.find(p => p.id === 'technical'),
        behavioral: !!phases.find(p => p.id === 'behavioral'),
        industry: !!phases.find(p => p.id === 'industry')
      }
    });

    // Override default phase question counts and temps where applicable
    orchestratorConfig.phases = orchestratorConfig.phases.map(phase => {
      const def = phases.find(p => p.id === (phase.id as InterviewStage));
      if (!def) return phase;
      return {
        ...phase,
        questionCount: def.questionCount,
        agentConfig: {
          ...(phase.agentConfig || {}),
          temperature: config.customization?.agentOverrides?.[def.agentType]?.temperature ?? adjustments.temperature,
          maxTokens: config.customization?.agentOverrides?.[def.agentType]?.maxTokens ?? adjustments.maxTokens
        }
      };
    });

    // Compose InterviewContext with focus areas and metadata
    const interviewContext: InterviewContext = {
      candidateProfile: transformedCandidateProfile,
      jobRole: config.role,
      companyInfo: config.companyInfo,
      sessionHistory: undefined,
      focusAreas: config.customization?.focusAreas
    } as any;

    // Initialize session state
    const startTime = Date.now();
    const totalEstimatedMinutes = phases.reduce((sum, p) => sum + p.duration, 0);

    const state: WorkflowSessionState = {
      config,
      interviewContext,
      allQuestions: [],
      stageHistory: [],
      notes: [],
      persistence: {
        createdAt: startTime,
        updatedAt: startTime,
        version: '1.0.0',
        checkpoints: []
      },
      status: {
        sessionId: config.sessionId,
        state: 'initializing',
        currentStageIndex: 0,
        totalStages: phases.length,
        stages: phases.map(p => ({
          stage: p,
          status: 'pending',
          questionsGenerated: 0,
          questionsAnswered: 0
        })),
        progressPercentage: 0,
        timing: {
          startTime,
          currentTime: startTime,
          elapsedMinutes: 0,
          estimatedRemainingMinutes: totalEstimatedMinutes,
          totalEstimatedMinutes
        },
        activeAgents: [],
        pendingAgents: phases.map(p => p.agentType),
        metrics: {
          totalQuestionsGenerated: 0,
          totalQuestionsAnswered: 0,
          averageResponseTime: 0,
          stageSwitches: 0,
          agentHandoffs: 0
        }
      }
    };

    sessionStore.set(config.sessionId, state);

    // Start first phase immediately (no parallelism yet)
    await this.advanceStage(config.sessionId, orchestratorConfig);

    return config.sessionId;
  }

  /**
   * Get current workflow status
   */
  async getStatus(sessionId: SessionId): Promise<WorkflowStatus> {
    const state = sessionStore.get(sessionId);
    if (!state) throw this.makeError('SESSION_NOT_FOUND', sessionId, 'Session not found', false);

    // Update timing
    const now = Date.now();
    const elapsedMinutes = Math.floor((now - state.status.timing.startTime) / 60000);
    const completedDurations = state.status.stages
      .filter(s => s.status === 'completed' || s.status === 'skipped')
      .reduce((sum, s) => sum + s.stage.duration, 0);

    const remaining = Math.max(state.status.timing.totalEstimatedMinutes - completedDurations, 0);

    state.status.timing.currentTime = now;
    state.status.timing.elapsedMinutes = elapsedMinutes;
    state.status.timing.estimatedRemainingMinutes = remaining;

    return state.status;
  }

  /**
   * Complete interview and return result
   */
  async completeInterview(sessionId: SessionId): Promise<InterviewResult> {
    const state = sessionStore.get(sessionId);
    if (!state) throw this.makeError('SESSION_NOT_FOUND', sessionId, 'Session not found', false);

    // If not all stages are completed, mark remaining as skipped
    const remainingStages = state.status.stages.filter(s => s.status === 'pending' || s.status === 'in-progress');
    remainingStages.forEach(s => (s.status = 'skipped'));

    state.status.state = 'completed';

    // Build simple result (can be enhanced with AI-generated feedback later)
    const totalDuration = Math.floor((state.status.timing.currentTime - state.status.timing.startTime) / 60000);

    const stageResults = state.status.stages.map(s => ({
      stage: s.stage,
      agent: s.stage.agentType,
      status: s.status,
      duration: s.stage.duration,
      questionsAsked: state.allQuestions.filter(q => (q as any).stageId === s.stage.id),
      questionsAnswered: 0,
      keyInsights: [],
      recommendations: [],
      strengths: [],
      concerns: []
    }));

    const result: InterviewResult = {
      sessionId,
      outcome: 'completed',
      summary: {
        totalDurationMinutes: totalDuration,
        stagesCompleted: state.status.stages.filter(s => s.status === 'completed').length,
        totalStages: state.status.totalStages,
        questionsAsked: state.allQuestions.length,
        questionsAnswered: 0
      },
      stageResults,
      feedback: {
        overallAssessment: 'Interview completed. AI-generated detailed assessment pending integration.',
        strengths: [],
        improvementAreas: [],
        roleFitAssessment: {
          technicalFit: 0,
          behavioralFit: 0,
          industryKnowledge: 0,
          overallFit: 0,
          reasoning: 'Scoring to be computed by analysis pipeline.'
        },
        recommendations: {
          hiring: 'maybe',
          reasoning: 'Requires further analysis.',
          nextSteps: ['Review responses', 'Schedule follow-up if needed']
        }
      },
      analytics: {
        metrics: {
          averageResponseTime: 0,
          questionDifficulty: 'medium',
          knowledgeAreas: {},
          confidenceLevel: 0,
          communicationClarity: 0
        },
        patterns: {
          responseLength: 'detailed',
          questioningStyle: 'deep-diving',
          confidenceIndicators: [],
          stressIndicators: []
        }
      },
      exports: {
        reportAvailable: false
      },
      metadata: {
        generatedAt: Date.now(),
        generationDuration: 0,
        aiModelsUsed: Array.from(new Set(state.status.stages.map(s => s.stage.agentType))),
        totalCost: 0,
        totalTokensUsed: 0,
        qualityScore: 80
      }
    };

    return result;
  }

  /**
   * Advance to the next stage or execute current one if pending
   */
  async advanceStage(sessionId: SessionId, orchestratorConfig?: ReturnType<AgentOrchestrator['createStandardSession']>): Promise<void> {
    const state = sessionStore.get(sessionId);
    if (!state) throw this.makeError('SESSION_NOT_FOUND', sessionId, 'Session not found', false);

    const s = state.status;
    const currentIdx = s.currentStageIndex;
    const current = s.stages[currentIdx];

    // If all stages complete, update status
    if (currentIdx >= s.totalStages) {
      s.state = 'completed';
      return;
    }

    if (current.status === 'pending') {
      console.log(`[InterviewWorkflow] Starting stage: ${current.stage.name}`);
      current.status = 'in-progress';
      current.startTime = Date.now();
      s.state = 'in-progress';
      s.currentStage = current.stage.id;
      s.activeAgents = [current.stage.agentType];
      s.pendingAgents = s.stages.slice(currentIdx + 1).map(x => x.stage.agentType);

      // Execute via orchestrator
      const runConfig = orchestratorConfig ?? this.orchestrator.createStandardSession({
        sessionId,
        candidateProfile: state.interviewContext.candidateProfile,
        jobRole: state.interviewContext.jobRole!,
        companyInfo: state.interviewContext.companyInfo,
        experienceLevel: state.config.experienceLevel,
        includePhases: {
          technical: current.stage.id === 'technical',
          behavioral: current.stage.id === 'behavioral' || current.stage.id === 'wrap-up',
          industry: current.stage.id === 'industry'
        }
      });

      const result = await this.orchestrator.startSession(runConfig);

      // Track generated questions
      const stageQuestions = result.allQuestions.map(q => ({ ...q, stageId: current.stage.id }));
      state.allQuestions.push(...(stageQuestions as any));

      current.questionsGenerated += stageQuestions.length;
      s.metrics.totalQuestionsGenerated += stageQuestions.length;

      // Mark complete
      current.status = 'completed';
      current.endTime = Date.now();
      s.metrics.stageSwitches += 1;

      // Progress
      s.currentStageIndex += 1;
      s.progressPercentage = Math.round((s.currentStageIndex / s.totalStages) * 100);

      // Move to next stage if exists
      if (s.currentStageIndex < s.totalStages) {
        const next = s.stages[s.currentStageIndex];
        s.currentStage = next.stage.id;
        s.activeAgents = [next.stage.agentType];
        s.pendingAgents = s.stages.slice(s.currentStageIndex + 1).map(x => x.stage.agentType);
      } else {
        s.currentStage = undefined;
        s.activeAgents = [];
        s.pendingAgents = [];
        s.state = 'completed';
      }

      state.persistence.updatedAt = Date.now();
    }
  }

  /** Utility to build standardized errors */
  private makeError(code: any, sessionId: SessionId, message: string, recoverable: boolean) {
    const err = new Error(message) as any;
    err.code = code;
    err.sessionId = sessionId;
    err.recoverable = recoverable;
    return err;
  }
}

