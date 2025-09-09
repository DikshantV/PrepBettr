import { FoundryAgent, InterviewContext, SessionState, Question } from '../types/agent-types';
import { AgentFactory, AgentType, AgentFactoryConfig } from './agent-factory';

/**
 * Interview phase configuration
 */
export interface InterviewPhase {
  /** Unique identifier for the phase */
  id: string;
  /** Display name for the phase */
  name: string;
  /** Agent type to use for this phase */
  agentType: AgentType;
  /** Optional agent configuration overrides */
  agentConfig?: AgentFactoryConfig;
  /** Number of questions to generate in this phase */
  questionCount: number;
  /** Whether this phase is optional */
  optional?: boolean;
  /** Conditions that must be met to include this phase */
  conditions?: {
    minExperienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
    requiredIndustry?: string[];
    requiredRoleType?: 'individual-contributor' | 'management' | 'leadership';
  };
}

/**
 * Interview session configuration
 */
export interface InterviewSessionConfig {
  /** Unique session identifier */
  sessionId: string;
  /** Interview phases to execute */
  phases: InterviewPhase[];
  /** Global context for the interview */
  context: InterviewContext;
  /** Maximum total interview duration in minutes */
  maxDurationMinutes?: number;
  /** Whether to allow skipping optional phases */
  allowSkipOptional?: boolean;
  /** Custom session metadata */
  metadata?: Record<string, any>;
}

/**
 * Interview session result
 */
export interface InterviewSessionResult {
  /** Session identifier */
  sessionId: string;
  /** All generated questions across all phases */
  allQuestions: Question[];
  /** Questions organized by phase */
  phaseResults: Array<{
    phase: InterviewPhase;
    questions: Question[];
    agent: FoundryAgent;
    executionTime: number;
    success: boolean;
    error?: string;
  }>;
  /** Session execution metrics */
  metrics: {
    totalExecutionTime: number;
    totalCost: number;
    totalTokensUsed: number;
    phasesCompleted: number;
    phasesSkipped: number;
    successRate: number;
  };
  /** Final session state */
  finalState: SessionState;
}

/**
 * AgentOrchestrator manages multi-agent interview sessions
 * 
 * Coordinates the execution of different interview phases using specialized agents,
 * manages session state, tracks progress, and provides comprehensive reporting.
 */
export class AgentOrchestrator {
  private agentFactory: AgentFactory;
  private activeSessions: Map<string, SessionState> = new Map();

  constructor() {
    this.agentFactory = AgentFactory.getInstance();
  }

  /**
   * Start a new interview session
   * 
   * @param config - Session configuration
   * @returns Promise resolving to session result
   */
  async startSession(config: InterviewSessionConfig): Promise<InterviewSessionResult> {
    const startTime = Date.now();
    console.log(`Starting interview session: ${config.sessionId}`);

    // Initialize session state
    const sessionState: SessionState = {
      sessionId: config.sessionId,
      currentPhase: 0,
      totalPhases: config.phases.length,
      completedQuestions: 0,
      allQuestions: [],
      agentResponses: [],
      startTime,
      lastUpdateTime: startTime,
      metadata: config.metadata || {}
    };

    this.activeSessions.set(config.sessionId, sessionState);

    const phaseResults: InterviewSessionResult['phaseResults'] = [];
    let totalCost = 0;
    let totalTokensUsed = 0;
    let phasesCompleted = 0;
    let phasesSkipped = 0;

    // Execute each phase
    for (let i = 0; i < config.phases.length; i++) {
      const phase = config.phases[i];
      const phaseStartTime = Date.now();

      try {
        // Check if phase should be executed
        if (phase.optional && !this.shouldExecutePhase(phase, config.context)) {
          console.log(`Skipping optional phase: ${phase.name}`);
          phasesSkipped++;
          continue;
        }

        console.log(`Executing phase ${i + 1}/${config.phases.length}: ${phase.name}`);

        // Create agent for this phase
        const agent = this.agentFactory.createAgent(phase.agentType, phase.agentConfig);

        // Update context with session history
        const phaseContext: InterviewContext = {
          ...config.context,
          sessionHistory: {
            previousQuestions: sessionState.allQuestions,
            agentResponses: sessionState.agentResponses,
            currentPhase: i,
            totalPhases: config.phases.length
          }
        };

        // Generate questions for this phase
        const questions = await agent.generateQuestions(phaseContext);

        // Limit questions to requested count
        const limitedQuestions = questions.slice(0, phase.questionCount);

        // Update session state
        sessionState.currentPhase = i + 1;
        sessionState.allQuestions.push(...limitedQuestions);
        sessionState.completedQuestions += limitedQuestions.length;
        sessionState.lastUpdateTime = Date.now();

        const executionTime = Date.now() - phaseStartTime;

        // Track phase result
        phaseResults.push({
          phase,
          questions: limitedQuestions,
          agent,
          executionTime,
          success: true
        });

        phasesCompleted++;

        // Update cost and token tracking (placeholder - would integrate with actual usage tracking)
        totalCost += this.estimatePhaseCost(limitedQuestions.length, phase.agentType);
        totalTokensUsed += this.estimatePhaseTokens(limitedQuestions.length, phase.agentType);

        console.log(`Phase ${phase.name} completed: ${limitedQuestions.length} questions generated in ${executionTime}ms`);

      } catch (error) {
        console.error(`Error executing phase ${phase.name}:`, error);
        
        const executionTime = Date.now() - phaseStartTime;
        phaseResults.push({
          phase,
          questions: [],
          agent: this.agentFactory.createAgent(phase.agentType), // Create agent for consistency
          executionTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Continue with next phase rather than failing entire session
        if (!phase.optional) {
          console.warn(`Required phase ${phase.name} failed, but continuing session`);
        }
      }
    }

    const totalExecutionTime = Date.now() - startTime;

    // Calculate final metrics
    const successfulPhases = phaseResults.filter(r => r.success).length;
    const successRate = config.phases.length > 0 ? successfulPhases / config.phases.length : 0;

    const result: InterviewSessionResult = {
      sessionId: config.sessionId,
      allQuestions: sessionState.allQuestions,
      phaseResults,
      metrics: {
        totalExecutionTime,
        totalCost,
        totalTokensUsed,
        phasesCompleted,
        phasesSkipped,
        successRate
      },
      finalState: sessionState
    };

    // Clean up session from active sessions
    this.activeSessions.delete(config.sessionId);

    console.log(`Interview session ${config.sessionId} completed:`, {
      totalQuestions: result.allQuestions.length,
      phases: phasesCompleted,
      duration: `${totalExecutionTime}ms`,
      successRate: `${(successRate * 100).toFixed(1)}%`
    });

    return result;
  }

  /**
   * Create a standard interview session configuration
   * 
   * @param params - Basic interview parameters
   * @returns Complete session configuration
   */
  createStandardSession(params: {
    sessionId: string;
    candidateProfile: InterviewContext['candidateProfile'];
    jobRole: string;
    companyInfo?: InterviewContext['companyInfo'];
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
    includePhases?: {
      technical?: boolean;
      behavioral?: boolean;
      industry?: boolean;
    };
  }): InterviewSessionConfig {
    const phases: InterviewPhase[] = [];

    // Technical phase (default: included)
    if (params.includePhases?.technical !== false) {
      phases.push({
        id: 'technical',
        name: 'Technical Assessment',
        agentType: 'technical',
        questionCount: params.experienceLevel === 'entry' ? 4 : 6,
        agentConfig: {
          temperature: params.experienceLevel === 'entry' ? 0.3 : 0.5
        }
      });
    }

    // Behavioral phase (default: included)
    if (params.includePhases?.behavioral !== false) {
      phases.push({
        id: 'behavioral',
        name: 'Behavioral Interview',
        agentType: 'behavioral',
        questionCount: 5,
        agentConfig: {
          temperature: 0.7
        }
      });
    }

    // Industry phase (optional for senior+ or specific industries)
    if (params.includePhases?.industry !== false) {
      phases.push({
        id: 'industry',
        name: 'Industry Knowledge',
        agentType: 'industry',
        questionCount: 4,
        optional: true,
        conditions: {
          minExperienceLevel: 'mid'
        },
        agentConfig: {
          temperature: 0.6
        }
      });
    }

    return {
      sessionId: params.sessionId,
      phases,
      context: {
        candidateProfile: params.candidateProfile,
        jobRole: params.jobRole,
        companyInfo: params.companyInfo
      },
      maxDurationMinutes: 60,
      allowSkipOptional: true,
      metadata: {
        experienceLevel: params.experienceLevel,
        createdAt: new Date().toISOString()
      }
    };
  }

  /**
   * Get active session state
   */
  getSessionState(sessionId: string): SessionState | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Cancel an active session
   */
  cancelSession(sessionId: string): boolean {
    return this.activeSessions.delete(sessionId);
  }

  /**
   * Determine if a phase should be executed based on conditions
   */
  private shouldExecutePhase(phase: InterviewPhase, context: InterviewContext): boolean {
    if (!phase.conditions) return true;

    const { conditions } = phase;

    // Check experience level requirement
    if (conditions.minExperienceLevel) {
      const experienceLevels = ['entry', 'mid', 'senior', 'executive'];
      const candidateLevel = context.candidateProfile?.experience?.toLowerCase() || 'mid';
      const candidateIndex = experienceLevels.indexOf(candidateLevel);
      const requiredIndex = experienceLevels.indexOf(conditions.minExperienceLevel);
      
      if (candidateIndex < requiredIndex) {
        return false;
      }
    }

    // Check industry requirement
    if (conditions.requiredIndustry) {
      const candidateIndustry = context.companyInfo?.industry?.toLowerCase();
      const hasRequiredIndustry = conditions.requiredIndustry.some(
        industry => candidateIndustry?.includes(industry.toLowerCase())
      );
      if (!hasRequiredIndustry) {
        return false;
      }
    }

    return true;
  }

  /**
   * Estimate cost for a phase (placeholder implementation)
   */
  private estimatePhaseCost(questionCount: number, agentType: AgentType): number {
    const costPerQuestion = {
      'technical': 0.05, // Higher cost for complex technical questions
      'behavioral': 0.03,
      'industry': 0.04
    };

    return questionCount * (costPerQuestion[agentType] || 0.03);
  }

  /**
   * Estimate token usage for a phase (placeholder implementation)
   */
  private estimatePhaseTokens(questionCount: number, agentType: AgentType): number {
    const tokensPerQuestion = {
      'technical': 150, // More tokens for detailed technical questions
      'behavioral': 100,
      'industry': 120
    };

    return questionCount * (tokensPerQuestion[agentType] || 100);
  }
}
