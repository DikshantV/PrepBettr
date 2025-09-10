import { jest } from '@jest/globals';
import { TechnicalInterviewer } from '../technical-interviewer';
import { BehavioralInterviewer } from '../behavioral-interviewer';
import { IndustryExpert } from '../industry-expert';
import { AgentFactory } from '../agent-factory';
import { AgentOrchestrator } from '../agent-orchestrator';
import { InterviewContext } from '../../types/agent-types';

// Mock the FoundryClientBase to avoid actual API calls
jest.mock('../../clients/foundry-client', () => ({
  FoundryClientBase: jest.fn().mockImplementation(() => ({
    request: jest.fn().mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  text: 'What is your experience with React?',
                  category: 'frontend',
                  difficulty: 'intermediate',
                  followUps: ['Tell me about state management', 'How do you handle side effects?']
                },
                {
                  text: 'Explain the concept of closures in JavaScript',
                  category: 'javascript',
                  difficulty: 'intermediate',
                  followUps: ['Can you provide an example?', 'When would you use closures?']
                }
              ])
            }
          }
        ],
        usage: {
          total_tokens: 150,
          prompt_tokens: 100,
          completion_tokens: 50
        }
      }
    })
  }))
}));

describe('Agent System Tests', () => {
  // Mock foundry client and config for constructor calls
  const mockFoundryClient = {
    request: jest.fn().mockResolvedValue({
      data: {
        choices: [{
          message: {
            content: JSON.stringify([{
              id: 'mock-q-1',
              text: 'Mock question',
              type: 'technical',
              category: 'technical',
              difficulty: 'medium',
              expectedDuration: 300,
              tags: ['mock'],
              metadata: { topic: 'test' }
            }])
          }
        }]
      }
    })
  } as any;
  
  const mockConfig = {
    apiKey: 'test-api-key',
    endpoint: 'https://test.openai.azure.com',
    models: { 'gpt-4': { name: 'gpt-4', maxTokens: 4096 } }
  } as any;

  const mockContext: InterviewContext = {
    sessionId: 'test-session-123',
    candidateName: 'John Doe',
    role: 'Senior Frontend Developer',
    experienceLevel: 'mid',
    industry: 'technology',
    candidateProfile: {
      name: 'John Doe',
      experience: 'mid-level',
      skills: ['JavaScript', 'React', 'Node.js'],
      targetRole: 'Senior Frontend Developer',
      industry: 'technology',
      previousRoles: ['Software Developer', 'Frontend Developer']
    },
    jobRole: 'Senior Frontend Developer',
    companyInfo: {
      name: 'Tech Corp',
      industry: 'technology',
      size: 'medium'
    },
    interviewConfig: {
      duration: 60,
      focusAreas: ['frontend', 'javascript', 'react'],
      difficulty: 'mid',
      includeFollowUps: true
    },
    previousQuestions: [],
    previousAnswers: [],
    currentPhase: 'technical',
    metadata: {}
  };

  describe('TechnicalInterviewer', () => {
    let technicalAgent: TechnicalInterviewer;

    beforeEach(() => {
      technicalAgent = new TechnicalInterviewer(mockFoundryClient, mockConfig);
    });

    test('should create technical interviewer with correct configuration', () => {
      expect(technicalAgent).toBeInstanceOf(TechnicalInterviewer);
      expect(technicalAgent.id).toBe('technical-interviewer');
      expect(technicalAgent.name).toBe('Technical Interviewer');
      expect(technicalAgent.type).toBe('technical');
    });

    test('should generate technical questions', async () => {
      const questions = await technicalAgent.generateQuestions(mockContext);
      
      expect(questions).toBeDefined();
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
      
      // Verify question structure
      const firstQuestion = questions[0];
      expect(firstQuestion).toHaveProperty('text');
      expect(firstQuestion).toHaveProperty('category');
      expect(firstQuestion).toHaveProperty('difficulty');
      expect(firstQuestion).toHaveProperty('followUps');
    });

    test('should return fallback questions when API fails', async () => {
      // Mock API failure
      const mockFailingClient = {
        request: jest.fn().mockRejectedValue(new Error('API Error'))
      } as any;
      const failingAgent = new TechnicalInterviewer(mockFailingClient, mockConfig);

      const questions = await failingAgent.generateQuestions(mockContext);
      
      expect(questions).toBeDefined();
      expect(questions.length).toBeGreaterThan(0);
      // Should return fallback questions
      expect(questions[0].id).toContain('tech-fallback');
    });
  });

  describe('BehavioralInterviewer', () => {
    let behavioralAgent: BehavioralInterviewer;

    beforeEach(() => {
      behavioralAgent = new BehavioralInterviewer(mockFoundryClient, mockConfig);
    });

    test('should create behavioral interviewer with correct configuration', () => {
      expect(behavioralAgent).toBeInstanceOf(BehavioralInterviewer);
      expect(behavioralAgent.id).toBe('behavioral-interviewer');
      expect(behavioralAgent.name).toBe('Behavioral Interviewer');
      expect(behavioralAgent.type).toBe('behavioral');
    });

    test('should generate behavioral questions', async () => {
      const questions = await behavioralAgent.generateQuestions(mockContext);
      
      expect(questions).toBeDefined();
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    test('should include leadership questions for senior candidates', async () => {
      const seniorContext = {
        ...mockContext,
        candidateProfile: {
          ...mockContext.candidateProfile!,
          experience: 'senior'
        }
      };

      const questions = await behavioralAgent.generateQuestions(seniorContext);
      expect(questions.length).toBeGreaterThan(0);
    });
  });

  describe('IndustryExpert', () => {
    let industryAgent: IndustryExpert;

    beforeEach(() => {
      industryAgent = new IndustryExpert(mockFoundryClient, mockConfig);
    });

    test('should create industry expert with correct configuration', () => {
      expect(industryAgent).toBeInstanceOf(IndustryExpert);
      expect(industryAgent.id).toBe('industry-expert');
      expect(industryAgent.name).toBe('Industry Expert');
      expect(industryAgent.type).toBe('industry');
    });

    test('should generate industry-specific questions', async () => {
      const questions = await industryAgent.generateQuestions(mockContext);
      
      expect(questions).toBeDefined();
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });
  });

  describe('AgentFactory', () => {
    let factory: AgentFactory;

    beforeEach(() => {
      factory = AgentFactory.getInstance(mockFoundryClient, mockConfig);
      factory.clearCache(); // Clear cache between tests
    });

    test('should create agents of different types', () => {
      const technical = factory.createAgent('technical');
      const behavioral = factory.createAgent('behavioral');
      const industry = factory.createAgent('industry');

      expect(technical).toBeInstanceOf(TechnicalInterviewer);
      expect(behavioral).toBeInstanceOf(BehavioralInterviewer);
      expect(industry).toBeInstanceOf(IndustryExpert);
    });

    test('should return cached instances', () => {
      const agent1 = factory.createAgent('technical');
      const agent2 = factory.createAgent('technical');

      expect(agent1).toBe(agent2); // Same instance
    });

    test('should create default agent set', () => {
      const agentSet = factory.createDefaultSet();

      expect(agentSet).toHaveProperty('technical');
      expect(agentSet).toHaveProperty('behavioral');
      expect(agentSet).toHaveProperty('industry');
    });

    test('should create agents based on requirements', () => {
      const agents = factory.createAgentsForRequirements({
        includeTechnical: true,
        includeBehavioral: true,
        includeIndustry: false,
        experienceLevel: 'senior'
      });

      expect(agents).toHaveLength(2);
      expect(agents[0]).toBeInstanceOf(TechnicalInterviewer);
      expect(agents[1]).toBeInstanceOf(BehavioralInterviewer);
    });

    test('should provide agent information', () => {
      const techInfo = factory.getAgentInfo('technical');

      expect(techInfo).toHaveProperty('type', 'technical');
      expect(techInfo).toHaveProperty('name', 'Technical Interviewer');
      expect(techInfo).toHaveProperty('defaultModel', 'gpt-4.5');
      expect(techInfo).toHaveProperty('capabilities');
      expect(Array.isArray(techInfo.capabilities)).toBe(true);
    });
  });

  describe('AgentOrchestrator', () => {
    let orchestrator: AgentOrchestrator;

    beforeEach(() => {
      orchestrator = new AgentOrchestrator();
    });

    test('should create standard session configuration', () => {
      const config = orchestrator.createStandardSession({
        sessionId: 'test-session',
        candidateProfile: mockContext.candidateProfile!,
        jobRole: 'Senior Developer',
        experienceLevel: 'senior'
      });

      expect(config.sessionId).toBe('test-session');
      expect(config.phases).toBeDefined();
      expect(config.phases.length).toBeGreaterThan(0);
      expect(config.context).toBeDefined();
    });

    test('should execute interview session', async () => {
      const config = orchestrator.createStandardSession({
        sessionId: 'test-execution',
        candidateProfile: mockContext.candidateProfile!,
        jobRole: 'Frontend Developer',
        experienceLevel: 'mid'
      });

      const result = await orchestrator.startSession(config);

      expect(result.sessionId).toBe('test-execution');
      expect(result.allQuestions).toBeDefined();
      expect(result.phaseResults).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.metrics.successRate).toBeGreaterThan(0);
    });

    test('should track session state', async () => {
      const config = orchestrator.createStandardSession({
        sessionId: 'state-test',
        candidateProfile: mockContext.candidateProfile!,
        jobRole: 'Developer'
      });

      // Start session in background
      const sessionPromise = orchestrator.startSession(config);

      // Check that session is tracked initially
      expect(orchestrator.getActiveSessions()).toContain('state-test');

      // Wait for completion
      await sessionPromise;

      // Session should be cleaned up
      expect(orchestrator.getActiveSessions()).not.toContain('state-test');
    });
  });

  describe('Integration Tests', () => {
    test('should complete full interview workflow', async () => {
      const factory = AgentFactory.getInstance();
      const orchestrator = new AgentOrchestrator();

      // Create session
      const config = orchestrator.createStandardSession({
        sessionId: 'integration-test',
        candidateProfile: {
          name: 'Jane Smith',
          experience: 'senior',
          skills: ['Python', 'Machine Learning', 'AWS'],
          targetRole: 'Senior Data Scientist',
          industry: 'technology',
          previousRoles: ['Data Scientist', 'ML Engineer']
        },
        jobRole: 'Senior Data Scientist',
        companyInfo: {
          name: 'AI Startup',
          industry: 'technology',
          size: 'startup'
        },
        experienceLevel: 'senior'
      });

      // Execute session
      const result = await orchestrator.startSession(config);

      // Validate results
      expect(result.allQuestions.length).toBeGreaterThan(0);
      expect(result.metrics.successRate).toBeGreaterThan(0);
      expect(result.phaseResults.length).toBeGreaterThan(0);

      // Verify questions from different agents
      const hasVariousCategories = result.allQuestions.some(q => 
        ['technical', 'behavioral', 'industry'].includes(q.category || '')
      );
      expect(hasVariousCategories).toBe(true);

      console.log('Integration test results:', {
        totalQuestions: result.allQuestions.length,
        phases: result.phaseResults.length,
        successRate: result.metrics.successRate,
        executionTime: result.metrics.totalExecutionTime
      });
    });
  });
});
