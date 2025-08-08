import { AzureOpenAIService } from './azure-openai-service';
import OpenAI from 'openai';

// Mock OpenAI client
const mockCreateCompletion = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreateCompletion
        }
      }
    }))
  };
});

// Mock the fetchAzureSecrets function
jest.mock('@/lib/azure-config-vercel', () => ({
  fetchAzureSecrets: jest.fn().mockResolvedValue({
    azureOpenAIKey: 'mock-key',
    azureOpenAIEndpoint: 'mock-endpoint',
    azureOpenAIDeployment: 'mock-deployment'
  })
}));

describe('AzureOpenAIService - Unit Tests', () => {
  let service: AzureOpenAIService;

  beforeEach(async () => {
    // Reset mock before each test
    mockCreateCompletion.mockReset();
    mockCreateCompletion.mockResolvedValue({
      choices: [{
        message: {
          content: 'This is a mock interview question response.'
        }
      }]
    });
    
    service = new AzureOpenAIService();
    await service.initialize();
  });

  afterEach(() => {
    service.dispose();
    jest.clearAllMocks();
  });

  describe('Opening Message Behavior', () => {
    it('should include preliminary question when preliminaryCollected is false', async () => {
      // By default, preliminaryCollected is false
      const response = await service.startInterviewConversation();
      
      expect(response.content).toContain("Hello! I'm excited to interview you today");
      expect(response.content).toContain("tell me about your current role, your years of experience, and the main technologies or skills you work with");
      expect(response.questionNumber).toBe(1);
      expect(response.isComplete).toBe(false);
    });

    it('should skip preliminary and ask domain-specific question when preliminaryCollected is true', async () => {
      // Set preliminaryCollected to true before starting
      service.setInterviewContext({ 
        type: 'technical',
        preliminaryCollected: true 
      });
      
      const response = await service.startInterviewConversation();
      
      expect(response.content).toContain("Hello! I'm excited to interview you today");
      // Should NOT contain preliminary question
      expect(response.content).not.toContain("tell me about your current role");
      // Should contain a technical question instead
      expect(response.content).toMatch(/technical challenge|array and a linked list|system design/i);
      expect(response.questionNumber).toBe(1);
      expect(response.isComplete).toBe(false);
    });

    it('should generate behavioral question when type is behavioral and preliminaryCollected is true', async () => {
      service.setInterviewContext({ 
        type: 'behavioral',
        preliminaryCollected: true 
      });
      
      const response = await service.startInterviewConversation();
      
      expect(response.content).toContain("Hello! I'm excited to interview you today");
      expect(response.content).not.toContain("tell me about your current role");
      // Should contain a behavioral question
      expect(response.content).toMatch(/team member|lead a project|initiative/i);
      expect(response.questionNumber).toBe(1);
    });

    it('should generate general question when type is general and preliminaryCollected is true', async () => {
      service.setInterviewContext({ 
        type: 'general',
        preliminaryCollected: true,
        position: 'Software Engineer'
      });
      
      const response = await service.startInterviewConversation();
      
      expect(response.content).toContain("Hello! I'm excited to interview you today");
      expect(response.content).toContain("Software Engineer position");
      expect(response.content).not.toContain("tell me about your current role");
      // Should contain a general interview question
      expect(response.content).toMatch(/interests you about|career goals|motivated/i);
      expect(response.questionNumber).toBe(1);
    });
  });

  describe('processUserResponse - Preliminary Flag Transition', () => {
    it('should transition from preliminary to interview phase correctly', async () => {
      // Start the interview with preliminaryCollected = false (default)
      await service.startInterviewConversation();
      
      // Answer the single preliminary question
      const response = await service.processUserResponse('I am a Senior Software Engineer with 5 years of experience working primarily with React, Node.js, and AWS');
      
      // Should thank for info and provide first real question
      expect(response.content).toContain("Thank you for that information! Now let's begin the interview");
      expect(response.questionNumber).toBe(1); // First real question
      expect(response.isComplete).toBe(false);
      
      // Should contain a real interview question based on type
      expect(response.content).toMatch(/technical challenge|difference between|motivated/i);
      expect(response.followUpSuggestions).toBeDefined();
      expect(response.followUpSuggestions?.length).toBeGreaterThan(0);
    });

    it('should set preliminaryCollected flag to true after processing first response', async () => {
      service.setInterviewContext({ type: 'technical' });
      
      // Start the interview - preliminaryCollected should be false
      const startResponse = await service.startInterviewConversation();
      expect(startResponse.content).toContain("tell me about your current role");
      
      // Process the preliminary response
      const response = await service.processUserResponse('Frontend Developer with 3 years of experience in React and TypeScript');
      
      // Verify the flag was set and we transitioned to real questions
      expect(response.questionNumber).toBe(1); // First real question
      expect(response.content).toContain("Thank you for that information");
      expect(response.content).toContain("Now let's begin the interview");
      
      // The response should include a technical question
      expect(response.content).toMatch(/array and a linked list|technical challenge|system/i);
      
      // Subsequent responses should increment question count normally
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Great answer! Can you elaborate on the performance implications?'
          }
        }]
      });
      
      const response2 = await service.processUserResponse('I would consider time complexity...');
      expect(response2.questionNumber).toBe(2); // Second real question
      expect(response2.content).toContain('Great answer');
    });

    it('should return first question immediately after preliminary response', async () => {
      service.setInterviewContext({ 
        type: 'behavioral',
        company: 'Tech Corp'
      });
      
      // Start the interview
      const start = await service.startInterviewConversation();
      expect(start.content).toContain("tell me about your current role");
      expect(start.questionNumber).toBe(1);
      
      // Process preliminary response - should immediately get first real question
      const response = await service.processUserResponse('Engineering Manager with 10 years of experience');
      
      // Should get acknowledgment + first behavioral question
      expect(response.content).toContain("Thank you for that information");
      expect(response.content).toContain("Now let's begin the interview");
      expect(response.content).toMatch(/difficult team member|lead a project/i);
      expect(response.questionNumber).toBe(1);
      expect(response.followUpSuggestions).toEqual([
        "What was the outcome?",
        "What did you learn?",
        "How would you handle it now?"
      ]);
    });

    it('should generate appropriate first question based on difficulty level', async () => {
      // Test easy difficulty
      service.setInterviewContext({ 
        type: 'technical',
        difficulty: 'easy',
        preliminaryCollected: true
      });
      
      let response = await service.startInterviewConversation();
      expect(response.content).toContain("difference between an array and a linked list");
      
      // Test hard difficulty
      service.clearConversation();
      service.setInterviewContext({ 
        type: 'technical',
        difficulty: 'hard',
        preliminaryCollected: true
      });
      
      response = await service.startInterviewConversation();
      expect(response.content).toContain("distributed caching system");
      
      // Test medium/default difficulty - the service uses undefined difficulty which defaults to medium
      service.clearConversation();
      service.setInterviewContext({ 
        type: 'technical',
        preliminaryCollected: true,
        difficulty: undefined // explicitly set to undefined to test default behavior
      });
      
      response = await service.startInterviewConversation();
      expect(response.content).toContain("recent technical challenge");
    });
  });

  describe('Question Count and Completion', () => {
    it('should track question count correctly and mark as complete when reaching max', async () => {
      // Set a low max for testing
      service.setInterviewContext({ 
        type: 'technical',
        preliminaryCollected: true,
        maxQuestions: 3,
        currentQuestionCount: 1 // Starting at question 1 after startInterviewConversation
      });
      
      // Mock responses for each question
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Good answer! Next question: How do you handle errors?' }
        }]
      });
      
      // Question 1 -> 2
      const response1 = await service.processUserResponse('I would use try-catch blocks...');
      expect(response1.questionNumber).toBe(2);
      expect(response1.isComplete).toBe(false);
      
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Excellent! Final question: What is your testing strategy?' }
        }]
      });
      
      // Question 2 -> 3 (should be marked as complete)
      const response2 = await service.processUserResponse('I follow TDD principles...');
      expect(response2.questionNumber).toBe(3);
      expect(response2.isComplete).toBe(true); // Reached max questions
    });

    it('should handle rate limiting with fallback response', async () => {
      service.setInterviewContext({ 
        type: 'behavioral',
        preliminaryCollected: true,
        currentQuestionCount: 1 // Starting at question 1
      });
      
      // Mock all retry attempts to fail with 429
      mockCreateCompletion.mockRejectedValue({
        status: 429,
        headers: { 'retry-after': '1' }
      });
      
      const response = await service.processUserResponse('I handled the situation by...');
      
      // Should get a fallback response
      expect(response.content).toMatch(/Thank you for sharing|sounds challenging|Interesting/i);
      expect(response.questionNumber).toBe(2);
      expect(response.isComplete).toBe(false);
      expect(response.followUpSuggestions).toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should reset state correctly with clearConversation', async () => {
      // Set up some state
      service.setInterviewContext({ 
        type: 'technical',
        preliminaryCollected: false,
        currentQuestionCount: 0
      });
      
      await service.startInterviewConversation();
      await service.processUserResponse('Data Scientist with ML expertise');
      
      // Verify state has changed
      const history = service.getConversationHistory();
      expect(history.length).toBeGreaterThan(0);
      
      // Clear conversation
      service.clearConversation();
      
      // Verify state is reset
      const newHistory = service.getConversationHistory();
      expect(newHistory.length).toBe(0);
      
      // Should start fresh with preliminary question
      const response = await service.startInterviewConversation();
      expect(response.content).toContain("tell me about your current role");
      expect(response.questionNumber).toBe(1);
    });

    it('should preserve interview context settings when clearing conversation', async () => {
      service.setInterviewContext({ 
        type: 'behavioral',
        company: 'Google',
        position: 'Senior Engineer',
        maxQuestions: 15
      });
      
      await service.startInterviewConversation();
      service.clearConversation();
      
      // Context type should be preserved, but state should be reset
      const response = await service.startInterviewConversation();
      expect(response.content).toContain("Senior Engineer position");
      expect(response.content).toContain("tell me about your current role");
    });
  });

  describe('Interview Context and Follow-up Suggestions', () => {
    it('should generate context-appropriate follow-up suggestions', async () => {
      // Technical interview
      service.setInterviewContext({ 
        type: 'technical',
        preliminaryCollected: true
      });
      
      await service.startInterviewConversation();
      const techResponse = await service.processUserResponse('I would use a microservices architecture...');
      
      expect(techResponse.followUpSuggestions).toContain("Can you explain your thought process?");
      expect(techResponse.followUpSuggestions).toContain("What would you do differently?");
      expect(techResponse.followUpSuggestions).toContain("How would this scale?");
      
      // Behavioral interview
      service.clearConversation();
      service.setInterviewContext({ 
        type: 'behavioral',
        preliminaryCollected: true
      });
      
      await service.startInterviewConversation();
      const behavioralResponse = await service.processUserResponse('I led a team of 5 engineers...');
      
      expect(behavioralResponse.followUpSuggestions).toContain("What was the outcome?");
      expect(behavioralResponse.followUpSuggestions).toContain("What did you learn?");
      expect(behavioralResponse.followUpSuggestions).toContain("How would you handle it now?");
    });

    it('should handle edge cases with maxQuestions', async () => {
      // Test with exactly maxQuestions
      service.setInterviewContext({ 
        type: 'general',
        preliminaryCollected: true,
        currentQuestionCount: 9,
        maxQuestions: 10
      });
      
      mockCreateCompletion.mockResolvedValueOnce({
        choices: [{
          message: { content: 'Thank you for your answer. That concludes our interview!' }
        }]
      });
      
      const response = await service.processUserResponse('My greatest achievement was...');
      expect(response.questionNumber).toBe(10);
      expect(response.isComplete).toBe(true);
    });
  });
});
