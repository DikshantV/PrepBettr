import { jest } from '@jest/globals';
import { InterviewWorkflow } from '../interview-workflow';
import type { InterviewConfig, ExperienceLevel } from '../workflow-types';

// Mock the agent orchestrator and factory
jest.mock('../../agents/agent-orchestrator', () => ({
  AgentOrchestrator: jest.fn().mockImplementation(() => ({
    createStandardSession: jest.fn().mockReturnValue({
      sessionId: 'test-session',
      phases: [
        {
          id: 'technical',
          name: 'Technical Assessment',
          agentType: 'technical',
          questionCount: 6
        },
        {
          id: 'behavioral', 
          name: 'Behavioral Interview',
          agentType: 'behavioral',
          questionCount: 5
        }
      ],
      context: {
        candidateProfile: { name: 'Test User', skills: ['JavaScript'] },
        jobRole: 'Developer'
      }
    }),
    startSession: jest.fn().mockResolvedValue({
      sessionId: 'test-session',
      allQuestions: [
        { id: 'q1', text: 'What is JavaScript?', category: 'technical', difficulty: 'beginner' },
        { id: 'q2', text: 'Explain closures', category: 'technical', difficulty: 'intermediate' }
      ],
      phaseResults: [{
        phase: { id: 'technical', name: 'Technical Assessment' },
        questions: [],
        agent: 'technical',
        executionTime: 1000,
        success: true
      }],
      metrics: {
        totalExecutionTime: 1000,
        totalCost: 0.05,
        totalTokensUsed: 150,
        phasesCompleted: 1,
        phasesSkipped: 0,
        successRate: 1.0
      },
      finalState: {}
    })
  }))
}));

jest.mock('../../agents/agent-factory', () => ({
  AgentFactory: {
    getInstance: jest.fn().mockReturnValue({
      createAgent: jest.fn().mockReturnValue({
        generateQuestions: jest.fn().mockResolvedValue([
          { id: 'q1', text: 'Sample question', category: 'test', difficulty: 'medium' }
        ])
      })
    })
  }
}));

describe('InterviewWorkflow', () => {
  let workflow: InterviewWorkflow;
  
  beforeEach(() => {
    workflow = new InterviewWorkflow();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper function for full workflow config
  const createFullWorkflowConfig = (): InterviewConfig => ({
    sessionId: 'test-full-workflow',
    role: 'Senior Software Engineer',
    experienceLevel: 'senior',
    candidateProfile: {
      name: 'Full Workflow Test User',
      skills: ['JavaScript', 'Python', 'System Design', 'Leadership'],
      yearsExperience: 8
    },
    customization: {
      enabledStages: ['technical', 'behavioral', 'industry', 'wrap-up'],
      stageDurations: { technical: 15, behavioral: 10, industry: 10, 'wrap-up': 5 }
    }
  });

  describe('Single Agent Session Tests', () => {
    const createBasicConfig = (experienceLevel: ExperienceLevel = 'mid'): InterviewConfig => ({
      sessionId: 'test-single-agent',
      role: 'Frontend Developer',
      experienceLevel,
      candidateProfile: {
        name: 'Test Candidate',
        skills: ['JavaScript', 'React'],
        yearsExperience: 3
      },
      customization: {
        enabledStages: ['technical'], // Single stage only
        stageDurations: { technical: 15 }
      }
    });

    test('should start single technical agent session', async () => {
      const config = createBasicConfig();
      
      const sessionId = await workflow.startMultiAgentInterview(config);
      
      expect(sessionId).toBe('test-single-agent');
      
      const status = await workflow.getStatus(sessionId);
      expect(status.sessionId).toBe(sessionId);
      expect(status.totalStages).toBe(1);
      expect(status.stages[0].stage.agentType).toBe('technical');
      expect(status.state).toBe('in-progress');
    });

    test('should adjust parameters based on experience level', async () => {
      const entryConfig = createBasicConfig('entry');
      const seniorConfig = createBasicConfig('senior');
      
      await workflow.startMultiAgentInterview(entryConfig);
      await workflow.startMultiAgentInterview({ ...seniorConfig, sessionId: 'test-senior' });
      
      const entryStatus = await workflow.getStatus('test-single-agent');
      const seniorStatus = await workflow.getStatus('test-senior');
      
      expect(entryStatus.stages[0].stage.questionCount).toBe(6); // Default technical questions
      expect(seniorStatus.stages[0].stage.questionCount).toBe(6);
    });

    test('should handle single agent completion', async () => {
      const config = createBasicConfig();
      
      const sessionId = await workflow.startMultiAgentInterview(config);
      const result = await workflow.completeInterview(sessionId);
      
      expect(result.sessionId).toBe(sessionId);
      expect(result.outcome).toBe('completed');
      expect(result.summary.stagesCompleted).toBeGreaterThan(0);
      expect(result.stageResults).toHaveLength(1);
      expect(result.stageResults[0].agent).toBe('technical');
    });
  });

  describe('Agent Handoff Tests', () => {
    const createTwoStageConfig = (): InterviewConfig => ({
      sessionId: 'test-handoff',
      role: 'Full Stack Developer',
      experienceLevel: 'mid',
      candidateProfile: {
        name: 'Handoff Test User',
        skills: ['JavaScript', 'Python', 'React'],
        yearsExperience: 4
      },
      customization: {
        enabledStages: ['technical', 'behavioral'],
        stageDurations: { technical: 15, behavioral: 10 }
      }
    });

    test('should simulate agent handoff between two agents', async () => {
      const config = createTwoStageConfig();
      
      const sessionId = await workflow.startMultiAgentInterview(config);
      
      // Get initial status - should be on technical stage
      const initialStatus = await workflow.getStatus(sessionId);
      expect(initialStatus.currentStage).toBe('technical');
      expect(initialStatus.activeAgents).toContain('technical');
      expect(initialStatus.pendingAgents).toContain('behavioral');
      
      // Trigger handoff to next stage
      await workflow.advanceStage(sessionId);
      
      // Check handoff occurred
      const postHandoffStatus = await workflow.getStatus(sessionId);
      expect(postHandoffStatus.currentStage).toBe('behavioral');
      expect(postHandoffStatus.activeAgents).toContain('behavioral');
      expect(postHandoffStatus.metrics.stageSwitches).toBe(2); // Start + handoff
    });

    test('should track handoff metrics', async () => {
      const config = createTwoStageConfig();
      
      const sessionId = await workflow.startMultiAgentInterview(config);
      
      // Initial state
      const status1 = await workflow.getStatus(sessionId);
      expect(status1.metrics.stageSwitches).toBe(1);
      
      // After handoff
      await workflow.advanceStage(sessionId);
      const status2 = await workflow.getStatus(sessionId);
      expect(status2.metrics.stageSwitches).toBe(2);
      expect(status2.progressPercentage).toBeGreaterThan(status1.progressPercentage);
    });

    test('should handle multiple sequential handoffs', async () => {
      const fullConfig: InterviewConfig = {
        sessionId: 'test-multiple-handoffs',
        role: 'Senior Engineer',
        experienceLevel: 'senior',
        candidateProfile: {
          name: 'Multi Stage User',
          skills: ['JavaScript', 'System Design', 'Leadership'],
          yearsExperience: 7
        },
        customization: {
          enabledStages: ['technical', 'behavioral', 'industry'],
          stageDurations: { technical: 15, behavioral: 10, industry: 10 }
        }
      };
      
      const sessionId = await workflow.startMultiAgentInterview(fullConfig);
      
      // Should start with technical
      const status1 = await workflow.getStatus(sessionId);
      expect(status1.currentStage).toBe('technical');
      
      // First handoff: technical → behavioral  
      await workflow.advanceStage(sessionId);
      const status2 = await workflow.getStatus(sessionId);
      expect(status2.currentStage).toBe('behavioral');
      
      // Second handoff: behavioral → industry
      await workflow.advanceStage(sessionId);
      const status3 = await workflow.getStatus(sessionId);
      expect(status3.currentStage).toBe('industry');
      
      // Final completion
      await workflow.advanceStage(sessionId);
      const finalStatus = await workflow.getStatus(sessionId);
      expect(finalStatus.state).toBe('completed');
    });
  });

  describe('Full Three-Agent Workflow Tests', () => {
    const createFullWorkflowConfig = (): InterviewConfig => ({
      sessionId: 'test-full-workflow',
      role: 'Senior Software Engineer',
      experienceLevel: 'senior',
      candidateProfile: {
        name: 'Full Workflow User',
        skills: ['JavaScript', 'Python', 'System Design', 'Leadership'],
        previousRoles: ['Software Engineer', 'Team Lead'],
        yearsExperience: 8
      },
      companyInfo: {
        name: 'Tech Corporation',
        industry: 'technology',
        size: 'large'
      },
      customization: {
        enabledStages: ['technical', 'behavioral', 'industry', 'wrap-up'],
        questionsPerStage: { technical: 8, behavioral: 6, industry: 5, 'wrap-up': 2 },
        focusAreas: ['system design', 'team leadership', 'industry trends']
      }
    });

    test('should run complete three-agent workflow', async () => {
      const config = createFullWorkflowConfig();
      
      const sessionId = await workflow.startMultiAgentInterview(config);
      
      // Verify initial setup
      const initialStatus = await workflow.getStatus(sessionId);
      expect(initialStatus.totalStages).toBe(4);
      expect(initialStatus.currentStage).toBe('technical');
      
      // Execute all stages
      await workflow.advanceStage(sessionId); // technical → behavioral
      await workflow.advanceStage(sessionId); // behavioral → industry 
      await workflow.advanceStage(sessionId); // industry → wrap-up
      
      const finalStatus = await workflow.getStatus(sessionId);
      expect(finalStatus.state).toBe('completed');
      expect(finalStatus.progressPercentage).toBe(100);
    });

    test('should generate comprehensive final feedback', async () => {
      const config = createFullWorkflowConfig();
      
      const sessionId = await workflow.startMultiAgentInterview(config);
      
      // Fast-forward through all stages
      await workflow.advanceStage(sessionId);
      await workflow.advanceStage(sessionId);
      await workflow.advanceStage(sessionId);
      
      const result = await workflow.completeInterview(sessionId);
      
      // Verify comprehensive results
      expect(result.stageResults).toHaveLength(4);
      expect(result.stageResults.map(r => r.agent)).toContain('technical');
      expect(result.stageResults.map(r => r.agent)).toContain('behavioral');
      expect(result.stageResults.map(r => r.agent)).toContain('industry');
      
      // Check feedback structure
      expect(result.feedback.overallAssessment).toBeDefined();
      expect(result.feedback.roleFitAssessment.overallFit).toBeGreaterThanOrEqual(0);
      expect(result.feedback.recommendations.hiring).toBeDefined();
      
      // Check analytics
      expect(result.analytics.metrics).toBeDefined();
      expect(result.analytics.patterns).toBeDefined();
      
      // Check metadata
      expect(result.metadata.aiModelsUsed).toContain('technical');
      expect(result.metadata.aiModelsUsed).toContain('behavioral');
      expect(result.metadata.aiModelsUsed).toContain('industry');
    });

    test('should handle workflow customization', async () => {
      const customConfig: InterviewConfig = {
        ...createFullWorkflowConfig(),
        sessionId: 'test-customization',
        customization: {
          enabledStages: ['technical', 'behavioral'], // Skip industry and wrap-up
          stageDurations: { technical: 20, behavioral: 15 }, // Custom durations
          agentOverrides: {
            technical: { temperature: 0.8, maxTokens: 2000 },
            behavioral: { temperature: 0.6, maxTokens: 1200 }
          }
        }
      };
      
      const sessionId = await workflow.startMultiAgentInterview(customConfig);
      
      const status = await workflow.getStatus(sessionId);
      expect(status.totalStages).toBe(2); // Only technical and behavioral
      expect(status.timing.totalEstimatedMinutes).toBe(35); // 20 + 15
      
      // Complete the custom workflow
      await workflow.advanceStage(sessionId);
      const result = await workflow.completeInterview(sessionId);
      
      expect(result.stageResults).toHaveLength(2);
      expect(result.outcome).toBe('completed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle session not found', async () => {
      await expect(workflow.getStatus('nonexistent-session')).rejects.toThrow('Session not found');
      await expect(workflow.completeInterview('nonexistent-session')).rejects.toThrow('Session not found');
    });

    test('should handle invalid configuration', async () => {
      const invalidConfig = {
        sessionId: 'test-invalid',
        role: '', // Invalid empty role
        experienceLevel: 'invalid-level' as any,
        candidateProfile: {
          name: '',
          skills: []
        }
      };
      
      // Should handle gracefully or throw appropriate error
      try {
        await workflow.startMultiAgentInterview(invalidConfig);
      } catch (error: any) {
        expect(error.code).toBeDefined();
      }
    });

    test('should handle premature completion', async () => {
      const config = createFullWorkflowConfig();
      config.sessionId = 'test-premature';
      
      const sessionId = await workflow.startMultiAgentInterview(config);
      
      // Try to complete without finishing all stages
      const result = await workflow.completeInterview(sessionId);
      
      expect(result.outcome).toBe('completed');
      // Should mark unfinished stages as skipped
      const skippedStages = result.stageResults.filter(r => r.status === 'skipped');
      expect(skippedStages.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Timing', () => {
    test('should track accurate timing', async () => {
      const config = createFullWorkflowConfig();
      config.sessionId = 'test-timing';
      
      const startTime = Date.now();
      const sessionId = await workflow.startMultiAgentInterview(config);
      
      const status = await workflow.getStatus(sessionId);
      expect(status.timing.startTime).toBeGreaterThanOrEqual(startTime);
      expect(status.timing.elapsedMinutes).toBeGreaterThanOrEqual(0);
      expect(status.timing.totalEstimatedMinutes).toBe(40); // 15+10+10+5
    });

    test('should update progress correctly', async () => {
      const config: InterviewConfig = {
        sessionId: 'test-progress',
        role: 'Developer',
        experienceLevel: 'mid',
        candidateProfile: { name: 'Test', skills: ['JS'] },
        customization: { enabledStages: ['technical', 'behavioral'] }
      };
      
      const sessionId = await workflow.startMultiAgentInterview(config);
      
      const status1 = await workflow.getStatus(sessionId);
      expect(status1.progressPercentage).toBe(50); // 1/2 stages completed
      
      await workflow.advanceStage(sessionId);
      const status2 = await workflow.getStatus(sessionId);
      expect(status2.progressPercentage).toBe(100); // 2/2 stages completed
    });
  });
});
