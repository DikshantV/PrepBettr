#!/usr/bin/env node

/**
 * Test script for the generateInterviewQuestion helper
 * This script tests the domain-specific question generation for different interview types
 */

const { AzureOpenAIService } = require('./azure-openai-service.ts');

// Mock Azure credentials for testing
global.fetch = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({
    azureOpenAIKey: 'test-key',
    azureOpenAIEndpoint: 'test-endpoint',
    azureOpenAIDeployment: 'test-deployment'
  })
});

// Mock OpenAI client for testing without actual API calls
class MockAzureOpenAIService extends AzureOpenAIService {
  async initialize() {
    this.isInitialized = true;
    this.client = {
      chat: {
        completions: {
          create: async ({ messages }) => {
            // Extract the question prompt from messages
            const userMessage = messages.find(m => m.role === 'user');
            const systemMessage = messages.find(m => m.role === 'system');
            
            // Generate mock questions based on interview type
            let mockResponse = '';
            
            if (systemMessage?.content.includes('technical')) {
              const techStack = this.candidateProfile.techStack || 'JavaScript';
              const experience = this.candidateProfile.yearsExperience || '5';
              
              if (parseInt(experience) < 3) {
                mockResponse = `How would you implement a simple REST API endpoint using ${techStack}? Walk me through your approach.`;
              } else if (parseInt(experience) < 7) {
                mockResponse = `Describe how you would architect a microservices system using ${techStack}. What patterns would you use?`;
              } else {
                mockResponse = `How would you design a distributed caching strategy for a high-traffic application using ${techStack}?`;
              }
            } else if (systemMessage?.content.includes('behavioral')) {
              mockResponse = `Tell me about a time when you had to resolve a conflict within your team. What was your approach and what was the outcome?`;
            } else {
              mockResponse = `What motivated you to pursue a career in ${this.candidateProfile.currentRole || 'technology'} and where do you see yourself in 5 years?`;
            }
            
            return {
              choices: [{
                message: {
                  content: mockResponse
                }
              }]
            };
          }
        }
      }
    };
    console.log('✅ Mock Azure OpenAI Service initialized');
    return true;
  }
}

async function testQuestionGeneration() {
  console.log('🧪 Testing generateInterviewQuestion Helper\n');
  console.log('============================================\n');
  
  const service = new MockAzureOpenAIService();
  await service.initialize();
  
  // Test 1: Technical Interview - Junior Developer
  console.log('📝 Test 1: Technical Interview - Junior Developer');
  service.candidateProfile = {
    currentRole: 'Junior Software Developer',
    techStack: 'React, Node.js',
    yearsExperience: '2',
    keySkills: 'Frontend development, REST APIs'
  };
  service.interviewContext = {
    type: 'technical',
    difficulty: 'easy',
    position: 'Frontend Developer'
  };
  
  let question = await service.generateInterviewQuestion();
  console.log(`Generated Question: ${question}`);
  console.log('✅ Test 1 Complete\n');
  
  // Test 2: Technical Interview - Senior Developer
  console.log('📝 Test 2: Technical Interview - Senior Developer');
  service.candidateProfile = {
    currentRole: 'Senior Software Engineer',
    techStack: 'Java, Spring Boot, AWS',
    yearsExperience: '8',
    keySkills: 'System design, Cloud architecture, Team leadership'
  };
  service.interviewContext = {
    type: 'technical',
    difficulty: 'hard',
    position: 'Principal Engineer'
  };
  
  question = await service.generateInterviewQuestion();
  console.log(`Generated Question: ${question}`);
  console.log('✅ Test 2 Complete\n');
  
  // Test 3: Behavioral Interview
  console.log('📝 Test 3: Behavioral Interview');
  service.candidateProfile = {
    currentRole: 'Product Manager',
    techStack: 'Agile, JIRA, Analytics',
    yearsExperience: '5',
    keySkills: 'Product strategy, Stakeholder management'
  };
  service.interviewContext = {
    type: 'behavioral',
    difficulty: 'medium',
    position: 'Senior Product Manager'
  };
  
  question = await service.generateInterviewQuestion();
  console.log(`Generated Question: ${question}`);
  console.log('✅ Test 3 Complete\n');
  
  // Test 4: General Interview
  console.log('📝 Test 4: General Interview');
  service.candidateProfile = {
    currentRole: 'Data Analyst',
    techStack: 'Python, SQL, Tableau',
    yearsExperience: '3',
    keySkills: 'Data visualization, Statistical analysis'
  };
  service.interviewContext = {
    type: 'general',
    difficulty: 'medium',
    company: 'Tech Startup'
  };
  
  question = await service.generateInterviewQuestion();
  console.log(`Generated Question: ${question}`);
  console.log('✅ Test 4 Complete\n');
  
  // Test 5: With conversation history
  console.log('📝 Test 5: With Conversation History');
  service.conversationHistory = [
    { role: 'assistant', content: 'Tell me about your experience with React.' },
    { role: 'user', content: 'I have been working with React for 2 years...' },
    { role: 'assistant', content: 'How do you handle state management?' },
    { role: 'user', content: 'I use Redux for complex state and Context API for simpler cases...' }
  ];
  
  question = await service.generateInterviewQuestion();
  console.log(`Generated Question (with history): ${question}`);
  console.log('✅ Test 5 Complete\n');
  
  // Test 6: Fallback scenario
  console.log('📝 Test 6: Fallback Question');
  service.client = null; // Simulate failure
  
  try {
    question = await service.generateInterviewQuestion();
  } catch (error) {
    console.log('Expected error:', error.message);
    // Test getFallbackQuestion directly
    question = service.getFallbackQuestion();
    console.log(`Fallback Question: ${question}`);
  }
  console.log('✅ Test 6 Complete\n');
  
  console.log('============================================');
  console.log('✅ All tests completed successfully!');
}

// Run the tests
testQuestionGeneration().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
