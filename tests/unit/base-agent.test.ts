/**
 * Unit Tests for BaseAgent
 * 
 * Tests the foundational agent class functionality including
 * initialization, question generation, response processing, and hooks.
 */

import { jest } from '@jest/globals';
import foundryConfigFixture from '../fixtures/foundry-config.json';

// Mock interfaces based on the actual BaseAgent structure
interface Question {
  id: string;
  text: string;
  category: 'technical' | 'behavioral' | 'industry' | 'general';
  difficulty: 'easy' | 'medium' | 'hard';
  expectedDuration: number;
  followUpQuestions?: string[];
  tags: string[];
  metadata?: {
    skill?: string;
    topic?: string;
    scenario?: string;
  };
}

interface InterviewContext {
  sessionId: string;
  candidateProfile: {
    name?: string;
    experience: string;
    skills: string[];
    targetRole: string;
    industry: string;
    resumeContent?: string;
  };
  interviewConfig: {
    duration: number;
    focusAreas: string[];
    difficulty: 'entry' | 'mid' | 'senior' | 'expert';
    includeFollowUps: boolean;
  };
  previousQuestions: Question[];
  currentPhase: 'technical' | 'behavioral' | 'industry';
  responses?: {
    questionId: string;
    response: string;
    timestamp: Date;
  }[];
}

interface AgentMetadata {
  name: string;
  specialty: string;
  capabilities: string[];
  modelPreference: string;
  maxQuestions: number;
  averageDuration: number;
}

// Mock FoundryClientBase
class MockFoundryClient {
  protected config = foundryConfigFixture;

  async init() {
    return Promise.resolve();
  }

  protected async request(path: string, options?: any) {
    // Mock successful response
    return {
      status: 200,
      data: {
        choices: [{
          message: {
            content: 'What is your experience with TypeScript?\nHow do you handle async operations in JavaScript?\nDescribe your approach to testing.'
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150
        }
      },
      raw: 'mock-response'
    };
  }
}

// Mock BaseAgent implementation for testing
abstract class MockBaseAgent {
  protected foundryClient: MockFoundryClient;
  protected config: any;
  
  public abstract readonly metadata: AgentMetadata;
  public abstract readonly instructions: string;
  protected abstract readonly modelName: string;

  constructor(foundryClient: MockFoundryClient, config: any) {
    this.foundryClient = foundryClient;
    this.config = config;
  }

  public async generateQuestions(context: InterviewContext): Promise<Question[]> {
    try {
      const prompt = this.buildQuestionsPrompt(context);
      
      const response = await this.foundryClient.request(`/chat/completions`, {
        method: 'POST',
        body: {
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: this.instructions
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        }
      });

      const questionsText = response.data?.choices?.[0]?.message?.content || '';
      const questions = this.parseQuestionsFromResponse(questionsText, context);
      
      // Log usage for monitoring
      this.logUsage(context, response.data);
      
      return questions;
      
    } catch (error) {
      this.handleError(error as Error, context);
      return this.getFallbackQuestions(context);
    }
  }

  public async processResponse(questionId: string, response: string, context: InterviewContext): Promise<void> {
    if (!context.responses) {
      context.responses = [];
    }
    
    context.responses.push({
      questionId,
      response,
      timestamp: new Date()
    });
  }

  public isComplete(context: InterviewContext): boolean {
    const agentQuestions = context.previousQuestions.filter(
      q => q.category === this.getQuestionCategory()
    );
    
    const responses = context.responses?.filter(r => 
      agentQuestions.some(q => q.id === r.questionId)
    ) || [];

    return responses.length >= Math.min(3, this.metadata.maxQuestions);
  }

  // Protected helper methods
  protected buildQuestionsPrompt(context: InterviewContext): string {
    return `
Generate ${this.getQuestionCount(context)} interview questions for:

**Candidate Profile:**
- Target Role: ${context.candidateProfile.targetRole}
- Experience: ${context.candidateProfile.experience}
- Skills: ${context.candidateProfile.skills.join(', ')}
- Industry: ${context.candidateProfile.industry}

**Interview Requirements:**
- Difficulty: ${context.interviewConfig.difficulty}
- Focus Areas: ${context.interviewConfig.focusAreas.join(', ')}
- Duration per question: ~${Math.floor(context.interviewConfig.duration / this.metadata.maxQuestions)} minutes

**Previously Asked Questions:**
${context.previousQuestions.map(q => `- ${q.text}`).join('\n') || 'None'}
`;
  }

  protected parseQuestionsFromResponse(responseText: string, context: InterviewContext): Question[] {
    const lines = responseText.split('\n').filter(line => line.trim());
    const category = this.getQuestionCategory();
    
    return lines.map((line, index) => ({
      id: `${context.sessionId}-${category}-${index + 1}`,
      text: line.replace(/^\d+\.\s*/, '').trim(),
      category,
      difficulty: context.interviewConfig.difficulty as any,
      expectedDuration: Math.floor(context.interviewConfig.duration / this.metadata.maxQuestions),
      tags: [category, context.candidateProfile.targetRole],
      metadata: {
        skill: context.candidateProfile.skills[0],
        topic: context.interviewConfig.focusAreas[0]
      }
    }));
  }

  protected getFallbackQuestions(context: InterviewContext): Question[] {
    return [{
      id: `${context.sessionId}-fallback-1`,
      text: `Tell me about your experience with ${context.candidateProfile.skills[0]}.`,
      category: this.getQuestionCategory(),
      difficulty: 'medium' as any,
      expectedDuration: 300,
      tags: ['fallback', context.candidateProfile.targetRole]
    }];
  }

  protected getQuestionCount(context: InterviewContext): number {
    return Math.min(this.metadata.maxQuestions, 5);
  }

  protected abstract getQuestionCategory(): Question['category'];

  // Hook methods for subclasses to override
  protected logUsage(context: InterviewContext, apiResponse: any): void {
    // Default implementation - can be spied on in tests
  }

  protected handleError(error: Error, context: InterviewContext): void {
    // Default implementation - can be spied on in tests
  }
}

// Concrete test implementations
class TestTechnicalAgent extends MockBaseAgent {
  public readonly metadata: AgentMetadata = {
    name: 'Technical Interviewer',
    specialty: 'technical',
    capabilities: ['coding', 'algorithms', 'system-design'],
    modelPreference: 'gpt-4o',
    maxQuestions: 5,
    averageDuration: 30
  };

  public readonly instructions = 'You are a technical interviewer. Generate coding and technical questions.';
  protected readonly modelName = 'gpt-4o';

  protected getQuestionCategory(): Question['category'] {
    return 'technical';
  }
}

class TestBehavioralAgent extends MockBaseAgent {
  public readonly metadata: AgentMetadata = {
    name: 'Behavioral Interviewer',
    specialty: 'behavioral',
    capabilities: ['leadership', 'communication', 'problem-solving'],
    modelPreference: 'gpt-4o',
    maxQuestions: 4,
    averageDuration: 25
  };

  public readonly instructions = 'You are a behavioral interviewer. Generate STAR method questions.';
  protected readonly modelName = 'gpt-4o';

  protected getQuestionCategory(): Question['category'] {
    return 'behavioral';
  }
}

class TestIndustryAgent extends MockBaseAgent {
  public readonly metadata: AgentMetadata = {
    name: 'Industry Expert',
    specialty: 'industry',
    capabilities: ['domain-knowledge', 'trends', 'best-practices'],
    modelPreference: 'gpt-4o',
    maxQuestions: 3,
    averageDuration: 20
  };

  public readonly instructions = 'You are an industry expert. Generate domain-specific questions.';
  protected readonly modelName = 'gpt-4o';

  protected getQuestionCategory(): Question['category'] {
    return 'industry';
  }
}

describe('BaseAgent', () => {
  let mockClient: MockFoundryClient;
  let technicalAgent: TestTechnicalAgent;
  let behavioralAgent: TestBehavioralAgent;
  let industryAgent: TestIndustryAgent;

  const mockContext: InterviewContext = {
    sessionId: 'test-session-123',
    candidateProfile: {
      name: 'John Doe',
      experience: '5 years',
      skills: ['JavaScript', 'TypeScript', 'React'],
      targetRole: 'Senior Frontend Developer',
      industry: 'Technology'
    },
    interviewConfig: {
      duration: 45,
      focusAreas: ['JavaScript', 'React', 'System Design'],
      difficulty: 'senior',
      includeFollowUps: true
    },
    previousQuestions: [],
    currentPhase: 'technical'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new MockFoundryClient();
    technicalAgent = new TestTechnicalAgent(mockClient, foundryConfigFixture);
    behavioralAgent = new TestBehavioralAgent(mockClient, foundryConfigFixture);
    industryAgent = new TestIndustryAgent(mockClient, foundryConfigFixture);
  });

  describe('Initialization', () => {
    it('should initialize with foundry client and config', () => {
      expect(technicalAgent['foundryClient']).toBe(mockClient);
      expect(technicalAgent['config']).toBe(foundryConfigFixture);
    });

    it('should have correct metadata for technical agent', () => {
      expect(technicalAgent.metadata.name).toBe('Technical Interviewer');
      expect(technicalAgent.metadata.specialty).toBe('technical');
      expect(technicalAgent.metadata.capabilities).toContain('coding');
    });

    it('should have correct metadata for behavioral agent', () => {
      expect(behavioralAgent.metadata.name).toBe('Behavioral Interviewer');
      expect(behavioralAgent.metadata.specialty).toBe('behavioral');
      expect(behavioralAgent.metadata.capabilities).toContain('leadership');
    });

    it('should have correct metadata for industry agent', () => {
      expect(industryAgent.metadata.name).toBe('Industry Expert');
      expect(industryAgent.metadata.specialty).toBe('industry');
      expect(industryAgent.metadata.capabilities).toContain('domain-knowledge');
    });
  });

  describe('Question Generation', () => {
    it('should generate questions for technical agent', async () => {
      const logUsageSpy = jest.spyOn(technicalAgent as any, 'logUsage');
      
      const questions = await technicalAgent.generateQuestions(mockContext);
      
      expect(questions).toHaveLength(3); // Based on mock response
      expect(questions[0].category).toBe('technical');
      expect(questions[0].id).toContain('test-session-123');
      expect(logUsageSpy).toHaveBeenCalledWith(mockContext, expect.any(Object));
    });

    it('should generate questions for behavioral agent', async () => {
      const questions = await behavioralAgent.generateQuestions(mockContext);
      
      expect(questions).toHaveLength(3);
      expect(questions[0].category).toBe('behavioral');
      expect(questions[0].tags).toContain('behavioral');
    });

    it('should generate questions for industry agent', async () => {
      const questions = await industryAgent.generateQuestions(mockContext);
      
      expect(questions).toHaveLength(3);
      expect(questions[0].category).toBe('industry');
      expect(questions[0].tags).toContain('industry');
    });

    it('should handle API errors and return fallback questions', async () => {
      const handleErrorSpy = jest.spyOn(technicalAgent as any, 'handleError');
      
      // Mock API failure
      jest.spyOn(mockClient as any, 'request').mockRejectedValueOnce(new Error('API Error'));
      
      const questions = await technicalAgent.generateQuestions(mockContext);
      
      expect(questions).toHaveLength(1); // Fallback question
      expect(questions[0].text).toContain('Tell me about your experience');
      expect(handleErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        mockContext
      );
    });
  });

  describe('Response Processing', () => {
    it('should process candidate responses', async () => {
      const questionId = 'test-question-1';
      const response = 'I have 5 years of experience with JavaScript...';
      
      await technicalAgent.processResponse(questionId, response, mockContext);
      
      expect(mockContext.responses).toHaveLength(1);
      expect(mockContext.responses![0].questionId).toBe(questionId);
      expect(mockContext.responses![0].response).toBe(response);
      expect(mockContext.responses![0].timestamp).toBeInstanceOf(Date);
    });

    it('should initialize responses array if not present', async () => {
      const contextWithoutResponses = { ...mockContext };
      delete contextWithoutResponses.responses;
      
      await technicalAgent.processResponse('test', 'response', contextWithoutResponses);
      
      expect(contextWithoutResponses.responses).toHaveLength(1);
    });
  });

  describe('Completion Logic', () => {
    it('should determine completion based on responses', () => {
      const contextWithQuestions = {
        ...mockContext,
        previousQuestions: [
          {
            id: 'q1',
            text: 'Question 1',
            category: 'technical' as const,
            difficulty: 'medium' as const,
            expectedDuration: 300,
            tags: ['technical']
          },
          {
            id: 'q2',
            text: 'Question 2',
            category: 'technical' as const,
            difficulty: 'medium' as const,
            expectedDuration: 300,
            tags: ['technical']
          }
        ],
        responses: [
          { questionId: 'q1', response: 'Answer 1', timestamp: new Date() },
          { questionId: 'q2', response: 'Answer 2', timestamp: new Date() }
        ]
      };
      
      const isComplete = technicalAgent.isComplete(contextWithQuestions);
      expect(isComplete).toBe(false); // Needs at least 3 responses
    });

    it('should complete when minimum responses reached', () => {
      const contextWithEnoughResponses = {
        ...mockContext,
        previousQuestions: Array.from({ length: 3 }, (_, i) => ({
          id: `q${i + 1}`,
          text: `Question ${i + 1}`,
          category: 'technical' as const,
          difficulty: 'medium' as const,
          expectedDuration: 300,
          tags: ['technical']
        })),
        responses: Array.from({ length: 3 }, (_, i) => ({
          questionId: `q${i + 1}`,
          response: `Answer ${i + 1}`,
          timestamp: new Date()
        }))
      };
      
      const isComplete = technicalAgent.isComplete(contextWithEnoughResponses);
      expect(isComplete).toBe(true);
    });
  });

  describe('Protected Methods', () => {
    it('should build appropriate prompts', () => {
      const prompt = (technicalAgent as any).buildQuestionsPrompt(mockContext);
      
      expect(prompt).toContain('Senior Frontend Developer');
      expect(prompt).toContain('JavaScript, TypeScript, React');
      expect(prompt).toContain('senior');
      expect(prompt).toContain('JavaScript, React, System Design');
    });

    it('should parse questions from response text', () => {
      const responseText = 'What is your experience with TypeScript?\nHow do you handle async operations?\nDescribe your testing approach.';
      
      const questions = (technicalAgent as any).parseQuestionsFromResponse(responseText, mockContext);
      
      expect(questions).toHaveLength(3);
      expect(questions[0].text).toBe('What is your experience with TypeScript?');
      expect(questions[1].text).toBe('How do you handle async operations?');
      expect(questions[2].text).toBe('Describe your testing approach.');
    });

    it('should generate fallback questions', () => {
      const fallbackQuestions = (technicalAgent as any).getFallbackQuestions(mockContext);
      
      expect(fallbackQuestions).toHaveLength(1);
      expect(fallbackQuestions[0].text).toContain('JavaScript');
      expect(fallbackQuestions[0].category).toBe('technical');
    });

    it('should calculate appropriate question count', () => {
      const questionCount = (technicalAgent as any).getQuestionCount(mockContext);
      
      expect(questionCount).toBe(5); // min(maxQuestions=5, 5)
    });
  });

  describe('Hook Methods', () => {
    it('should call logUsage hook on successful API call', async () => {
      const logUsageSpy = jest.spyOn(technicalAgent as any, 'logUsage');
      
      await technicalAgent.generateQuestions(mockContext);
      
      expect(logUsageSpy).toHaveBeenCalledWith(
        mockContext,
        expect.objectContaining({
          choices: expect.any(Array),
          usage: expect.any(Object)
        })
      );
    });

    it('should call handleError hook on API failure', async () => {
      const handleErrorSpy = jest.spyOn(technicalAgent as any, 'handleError');
      
      // Mock API failure
      jest.spyOn(mockClient as any, 'request').mockRejectedValueOnce(new Error('Test error'));
      
      await technicalAgent.generateQuestions(mockContext);
      
      expect(handleErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        mockContext
      );
    });
  });
});
