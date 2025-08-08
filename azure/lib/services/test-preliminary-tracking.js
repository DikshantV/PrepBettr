#!/usr/bin/env node

// Test script to verify the preliminaryCollected flag tracking
const { AzureOpenAIService } = require('./azure-openai-service.ts');

// Mock the dependencies for testing
global.fetch = () => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({
    azureOpenAIKey: 'test-key',
    azureOpenAIEndpoint: 'test-endpoint',
    azureOpenAIDeployment: 'test-deployment'
  })
});

async function testPreliminaryTracking() {
  console.log('🧪 Testing Preliminary Collection Flag Tracking\n');
  
  const service = new AzureOpenAIService();
  
  // Initialize the service
  console.log('1. Initializing service...');
  await service.initialize();
  
  // Start interview conversation
  console.log('2. Starting interview conversation...');
  const startResponse = await service.startInterviewConversation();
  console.log('   ✓ Initial response:', startResponse.content.substring(0, 50) + '...');
  console.log('   ✓ Question number:', startResponse.questionNumber);
  console.log('   ✓ Interview context:', service.interviewContext);
  
  // Process preliminary questions
  console.log('\n3. Processing preliminary questions...');
  
  const preliminaryAnswers = [
    'Senior Software Engineer',
    'React, Node.js, TypeScript, AWS',
    '5',
    'Full-stack development, System design',
    '10'
  ];
  
  for (let i = 0; i < preliminaryAnswers.length; i++) {
    console.log(`\n   Question ${i + 1}: Answering with "${preliminaryAnswers[i]}"`);
    const response = await service.processUserResponse(preliminaryAnswers[i]);
    console.log(`   ✓ Response: ${response.content.substring(0, 60)}...`);
    console.log(`   ✓ Question number: ${response.questionNumber}`);
    console.log(`   ✓ preliminaryCollected: ${service.interviewContext.preliminaryCollected}`);
    console.log(`   ✓ currentQuestionCount: ${service.interviewContext.currentQuestionCount}`);
    
    // Check if we've transitioned to real questions
    if (i === preliminaryAnswers.length - 1) {
      console.log('\n   🎯 After final preliminary question:');
      console.log(`      - preliminaryCollected should be true: ${service.interviewContext.preliminaryCollected === true ? '✅' : '❌'}`);
      console.log(`      - currentQuestionCount should be 1: ${service.interviewContext.currentQuestionCount === 1 ? '✅' : '❌'}`);
      console.log(`      - questionNumber should be 1: ${response.questionNumber === 1 ? '✅' : '❌'}`);
    }
  }
  
  // Test normal interview flow
  console.log('\n4. Testing normal interview flow...');
  const interviewAnswer = 'I would implement a microservices architecture using Docker and Kubernetes...';
  const interviewResponse = await service.processUserResponse(interviewAnswer);
  console.log(`   ✓ Response: ${interviewResponse.content.substring(0, 60)}...`);
  console.log(`   ✓ Question number: ${interviewResponse.questionNumber}`);
  console.log(`   ✓ currentQuestionCount: ${service.interviewContext.currentQuestionCount}`);
  console.log(`   ✓ Should increment normally: ${interviewResponse.questionNumber === 2 ? '✅' : '❌'}`);
  
  // Test clear and restart
  console.log('\n5. Testing clear and restart...');
  service.clearConversation();
  console.log('   ✓ Cleared conversation');
  console.log(`   ✓ preliminaryCollected reset: ${service.interviewContext.preliminaryCollected === false ? '✅' : '❌'}`);
  console.log(`   ✓ currentQuestionCount reset: ${service.interviewContext.currentQuestionCount === 0 ? '✅' : '❌'}`);
  
  const restartResponse = await service.startInterviewConversation();
  console.log('   ✓ Restarted interview');
  console.log(`   ✓ Back to first preliminary question: ${restartResponse.content.includes('What is your current role') ? '✅' : '❌'}`);
  
  console.log('\n✅ Test completed successfully!');
}

// Run the test
testPreliminaryTracking().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
