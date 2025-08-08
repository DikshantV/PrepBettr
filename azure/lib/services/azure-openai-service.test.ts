import { AzureOpenAIService } from './azure-openai-service';

// Mock the Azure OpenAI client
jest.mock('openai', () => ({
  AzureOpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'This is a mock interview question response.'
            }
          }]
        })
      }
    }
  }))
}));

// Mock the fetchAzureSecrets function
jest.mock('../../../lib/azure-config-browser', () => ({
  fetchAzureSecrets: jest.fn().mockResolvedValue({
    azureOpenAIKey: 'mock-key',
    azureOpenAIEndpoint: 'mock-endpoint',
    azureOpenAIDeployment: 'mock-deployment'
  })
}));

describe('AzureOpenAIService - Preliminary Questions Flow', () => {
  let service: AzureOpenAIService;

  beforeEach(async () => {
    service = new AzureOpenAIService();
    await service.initialize();
  });

  afterEach(() => {
    service.dispose();
  });

  describe('startInterviewConversation', () => {
    it('should start with greeting and first preliminary question', async () => {
      const response = await service.startInterviewConversation();
      
      expect(response.content).toContain("Hello! Welcome to your interview practice session");
      expect(response.content).toContain("What is your current role?");
      expect(response.questionNumber).toBe(0); // 0 indicates preliminary phase
      expect(response.isComplete).toBe(false);
    });
  });

  describe('processUserResponse - Preliminary Questions', () => {
    it('should process preliminary questions one by one', async () => {
      // Start the interview
      await service.startInterviewConversation();
      
      // Answer first preliminary question (current role)
      const response1 = await service.processUserResponse('Senior Software Engineer');
      expect(response1.content).toContain("What primary tech stack do you use?");
      expect(response1.questionNumber).toBe(0);
      
      // Answer second preliminary question (tech stack)
      const response2 = await service.processUserResponse('React, Node.js, TypeScript, AWS');
      expect(response2.content).toContain("How many years of experience do you have?");
      expect(response2.questionNumber).toBe(0);
      
      // Answer third preliminary question (years of experience)
      const response3 = await service.processUserResponse('5');
      expect(response3.content).toContain("What are your key skills?");
      expect(response3.questionNumber).toBe(0);
      
      // Answer fourth preliminary question (key skills)
      const response4 = await service.processUserResponse('Full-stack development, System design, Team leadership');
      expect(response4.content).toContain("How many interview questions would you like?");
      expect(response4.questionNumber).toBe(0);
      
      // Answer fifth preliminary question (number of questions)
      const response5 = await service.processUserResponse('10');
      expect(response5.content).toContain("Great! I now have a better understanding of your background");
      expect(response5.questionNumber).toBe(1); // Now in actual interview phase
    });

    it('should track preliminaryCollected flag correctly', async () => {
      // Start the interview - preliminaryCollected should be false
      await service.startInterviewConversation();
      
      // Complete all preliminary questions
      await service.processUserResponse('Senior Software Engineer');
      await service.processUserResponse('React, Node.js, TypeScript, AWS');
      await service.processUserResponse('5');
      await service.processUserResponse('Full-stack development, System design, Team leadership');
      
      // After last preliminary question, preliminaryCollected should be set to true
      const response = await service.processUserResponse('10');
      
      // Verify the flag was set and we transitioned to real questions
      expect(response.questionNumber).toBe(1); // First real question
      expect(response.content).toContain("Great! I now have a better understanding");
      
      // Subsequent responses should increment question count normally
      const response2 = await service.processUserResponse('I use SOLID principles in my daily work...');
      expect(response2.questionNumber).toBe(2); // Second real question
    });

    it('should keep currentQuestionCount at 0 during preliminary phase', async () => {
      // Start the interview
      await service.startInterviewConversation();
      
      // During preliminary questions, questionNumber should always be 0
      const response1 = await service.processUserResponse('Frontend Developer');
      expect(response1.questionNumber).toBe(0);
      
      const response2 = await service.processUserResponse('Vue.js, Nuxt');
      expect(response2.questionNumber).toBe(0);
      
      const response3 = await service.processUserResponse('3');
      expect(response3.questionNumber).toBe(0);
      
      const response4 = await service.processUserResponse('UI/UX Design');
      expect(response4.questionNumber).toBe(0);
      
      // After completing preliminary, should start at 1
      const response5 = await service.processUserResponse('8');
      expect(response5.questionNumber).toBe(1);
    });

    it('should build proper system context after preliminary questions', async () => {
      // Set interview type
      service.setInterviewContext({ type: 'technical' });
      
      // Start and complete preliminary questions
      await service.startInterviewConversation();
      await service.processUserResponse('Frontend Developer');
      await service.processUserResponse('React, Vue, JavaScript');
      await service.processUserResponse('3');
      await service.processUserResponse('UI/UX, Performance optimization');
      
      // Final response should include tailored opening question
      const finalResponse = await service.processUserResponse('8');
      
      // Should transition to actual interview with personalized question
      expect(finalResponse.content).toContain("Let's begin the interview");
      expect(finalResponse.questionNumber).toBe(1);
      
      // The opening question should be tailored to the candidate's profile
      const conversationHistory = service.getConversationHistory();
      expect(conversationHistory.length).toBeGreaterThan(0);
    });

    it('should limit question count between 5 and 20', async () => {
      await service.startInterviewConversation();
      await service.processUserResponse('Developer');
      await service.processUserResponse('Python');
      await service.processUserResponse('10');
      await service.processUserResponse('Coding');
      
      // Test with very low number
      await service.clearConversation();
      await service.startInterviewConversation();
      await service.processUserResponse('Developer');
      await service.processUserResponse('Python');
      await service.processUserResponse('10');
      await service.processUserResponse('Coding');
      await service.processUserResponse('3'); // Should be clamped to 5
      
      // Test with very high number
      await service.clearConversation();
      await service.startInterviewConversation();
      await service.processUserResponse('Developer');
      await service.processUserResponse('Python');
      await service.processUserResponse('10');
      await service.processUserResponse('Coding');
      await service.processUserResponse('50'); // Should be clamped to 20
    });
  });

  describe('processUserResponse - Interview Phase', () => {
    it('should handle normal interview flow after preliminary questions', async () => {
      // Complete preliminary questions
      await service.startInterviewConversation();
      await service.processUserResponse('Backend Developer');
      await service.processUserResponse('Java, Spring Boot, PostgreSQL');
      await service.processUserResponse('7');
      await service.processUserResponse('Microservices, API design');
      await service.processUserResponse('5');
      
      // Now in normal interview flow
      const interviewResponse = await service.processUserResponse('I would implement a distributed caching solution...');
      
      expect(interviewResponse.content).toBeTruthy();
      expect(interviewResponse.questionNumber).toBeGreaterThan(1);
      expect(interviewResponse.followUpSuggestions).toBeDefined();
    });
  });

  describe('clearConversation', () => {
    it('should reset all state including preliminary questions', async () => {
      // Start and partially complete preliminary questions
      await service.startInterviewConversation();
      await service.processUserResponse('Data Scientist');
      await service.processUserResponse('Python, TensorFlow');
      
      // Clear conversation
      service.clearConversation();
      
      // Should start fresh
      const response = await service.startInterviewConversation();
      expect(response.content).toContain("What is your current role?");
      expect(response.questionNumber).toBe(0);
    });
  });

  describe('Interview Type Customization', () => {
    it('should generate technical questions for technical interviews', async () => {
      service.setInterviewContext({ type: 'technical' });
      
      await service.startInterviewConversation();
      await service.processUserResponse('Software Engineer');
      await service.processUserResponse('Node.js, MongoDB, Docker');
      await service.processUserResponse('4');
      await service.processUserResponse('Backend development, DevOps');
      
      const response = await service.processUserResponse('10');
      
      // Should contain technical-focused opening
      expect(response.content.toLowerCase()).toMatch(/technical|problem|project|technology/);
    });

    it('should generate behavioral questions for behavioral interviews', async () => {
      service.setInterviewContext({ type: 'behavioral' });
      
      await service.startInterviewConversation();
      await service.processUserResponse('Engineering Manager');
      await service.processUserResponse('Various');
      await service.processUserResponse('10');
      await service.processUserResponse('Leadership, Strategy');
      
      const response = await service.processUserResponse('10');
      
      // Should contain behavioral-focused opening
      expect(response.content.toLowerCase()).toMatch(/lead|challenging|project|initiative/);
    });
  });
});
