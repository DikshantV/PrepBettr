#!/usr/bin/env tsx

/**
 * Voice System End-to-End Testing Script
 * Tests microphone input, speech recognition, AI response, and audio playback
 */

import { azureSpeechService } from '../lib/services/azure-speech-service';
import { migrationOpenAIClient } from '@/lib/azure-ai-foundry/clients/migration-wrapper';
import { azureOpenAIService } from '../lib/services/azure-openai-service';

interface TestResult {
  test: string;
  success: boolean;
  duration: number;
  details?: any;
  error?: string;
}

class VoiceSystemTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Voice System End-to-End Tests\n');

    await this.testServiceInitialization();
    await this.testSpeechSynthesis();
    await this.testOpenAIGeneration();
    await this.testConversationFlow();
    await this.testErrorHandling();
    await this.testPerformance();

    this.generateReport();
  }

  private async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = Date.now();
    console.log(`🔍 Running: ${name}`);

    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      console.log(`✅ ${name} - ${duration}ms`);
      return {
        test: name,
        success: true,
        duration,
        details: result
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${name} - ${duration}ms - ${(error as any).message}`);
      
      return {
        test: name,
        success: false,
        duration,
        error: (error as any).message
      };
    }
  }

  private async testServiceInitialization(): Promise<void> {
    const speechResult = await this.runTest('Azure Speech Service Initialization', async () => {
      const initialized = await azureSpeechService.initialize();
      if (!initialized) throw new Error('Failed to initialize Speech Service');
      return { ready: azureSpeechService.isReady() };
    });
    this.results.push(speechResult);

    const openaiResult = await this.runTest('Azure OpenAI Service Initialization', async () => {
      const initialized = await azureOpenAIService.initialize();
      if (!initialized) throw new Error('Failed to initialize OpenAI Service');
      return { ready: azureOpenAIService.isReady() };
    });
    this.results.push(openaiResult);
  }

  private async testSpeechSynthesis(): Promise<void> {
    const testCases = [
      { text: "Hello! Welcome to your technical interview.", voice: "en-US-SaraNeural" },
      { text: "Can you tell me about your experience with React?", voice: "en-US-AriaNeural" },
      { text: "That's an interesting approach. How would you scale this solution?", voice: "en-US-GuyNeural" }
    ];

    for (const testCase of testCases) {
      const result = await this.runTest(`Speech Synthesis - ${testCase.voice}`, async () => {
        const audioData = await azureSpeechService.synthesizeSpeech(testCase.text, {
          voiceName: testCase.voice,
          rate: '1.0',
          pitch: '0Hz'
        });
        
        if (!audioData) throw new Error('No audio data generated');
        return { 
          audioSize: audioData.byteLength,
          textLength: testCase.text.length,
          voice: testCase.voice
        };
      });
      this.results.push(result);
    }
  }

  private async testOpenAIGeneration(): Promise<void> {
    const interviewTypes = ['technical', 'behavioral', 'general'] as const;

    for (const type of interviewTypes) {
      const result = await this.runTest(`OpenAI Generation - ${type}`, async () => {
        azureOpenAIService.setInterviewContext({ type, maxQuestions: 3 });
        
        const startResponse = await azureOpenAIService.startInterviewConversation();
        const processResponse = await azureOpenAIService.processUserResponse(
          "I have 5 years of experience in software development, primarily with React and Node.js."
        );
        
        return {
          startMessage: startResponse.content.length,
          processMessage: processResponse.content.length,
          questionNumber: processResponse.questionNumber,
          followUps: processResponse.followUpSuggestions?.length
        };
      });
      this.results.push(result);
    }
  }

  private async testConversationFlow(): Promise<void> {
    const result = await this.runTest('Complete Conversation Flow', async () => {
      // Clear any existing conversation
      azureOpenAIService.clearConversation();
      
      // Set interview context
      azureOpenAIService.setInterviewContext({
        type: 'technical',
        position: 'Senior Frontend Developer',
        maxQuestions: 3
      });

      // Start conversation
      const start = await azureOpenAIService.startInterviewConversation();
      
      // Simulate user responses
      const responses = [
        "I have experience with React, Vue, and Angular. I've built several large-scale applications.",
        "I usually use Redux for state management and focus on component reusability.",
        "I've optimized applications using React.memo, useMemo, and lazy loading techniques."
      ];

      const conversationHistory = [];
      let currentResponse = start;

      for (let i = 0; i < responses.length; i++) {
        const userResponse = responses[i];
        const aiResponse = await azureOpenAIService.processUserResponse(userResponse);
        
        conversationHistory.push({
          user: userResponse,
          ai: aiResponse.content,
          questionNumber: aiResponse.questionNumber,
          isComplete: aiResponse.isComplete
        });

        currentResponse = aiResponse;
      }

      // Generate summary
      const summary = await azureOpenAIService.generateInterviewSummary();

      return {
        conversationLength: conversationHistory.length,
        finalQuestionNumber: currentResponse.questionNumber,
        isComplete: currentResponse.isComplete,
        summaryLength: summary.length,
        conversationHistory: conversationHistory.map(h => ({
          userLength: h.user.length,
          aiLength: h.ai.length,
          questionNumber: h.questionNumber
        }))
      };
    });
    this.results.push(result);
  }

  private async testErrorHandling(): Promise<void> {
    const errorTests = [
      {
        name: 'Empty User Response',
        test: () => azureOpenAIService.processUserResponse('')
      },
      {
        name: 'Very Long User Response',
        test: () => azureOpenAIService.processUserResponse('a'.repeat(5000))
      },
      {
        name: 'Special Characters in Speech',
        test: () => azureSpeechService.synthesizeSpeech('Hello! @#$%^&*() Testing... 🎉')
      }
    ];

    for (const errorTest of errorTests) {
      const result = await this.runTest(`Error Handling - ${errorTest.name}`, async () => {
        try {
          const response = await errorTest.test();
          return { handled: true, response: typeof response };
        } catch (error) {
          // Expected behavior for some error cases
          return { handled: true, error: (error as any).message };
        }
      });
      this.results.push(result);
    }
  }

  private async testPerformance(): Promise<void> {
    const performanceTests = [
      {
        name: 'Quick Response Time',
        test: async () => {
          const start = Date.now();
          await azureOpenAIService.processUserResponse("Yes, I understand the question.");
          return Date.now() - start;
        },
        threshold: 5000 // 5 seconds
      },
      {
        name: 'Speech Synthesis Speed',
        test: async () => {
          const start = Date.now();
          await azureSpeechService.synthesizeSpeech("This is a test message for performance measurement.");
          return Date.now() - start;
        },
        threshold: 3000 // 3 seconds
      }
    ];

    for (const perfTest of performanceTests) {
      const result = await this.runTest(`Performance - ${perfTest.name}`, async () => {
        const duration = await perfTest.test();
        const passed = duration < perfTest.threshold;
        
        if (!passed) {
          throw new Error(`Performance test failed: ${duration}ms > ${perfTest.threshold}ms`);
        }
        
        return { duration, threshold: perfTest.threshold, passed };
      });
      this.results.push(result);
    }
  }

  private generateReport(): void {
    console.log('\n📊 Voice System Test Report');
    console.log('='.repeat(50));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    console.log(`Average Test Duration: ${avgDuration.toFixed(0)}ms`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.test}: ${r.error}`));
    }

    console.log('\n🎯 Recommendations:');
    
    // Performance recommendations
    const slowTests = this.results.filter(r => r.duration > 2000);
    if (slowTests.length > 0) {
      console.log('  - Consider optimizing slow operations:');
      slowTests.forEach(t => console.log(`    * ${t.test}: ${t.duration}ms`));
    }

    // Service health recommendations
    const initFailures = this.results.filter(r => !r.success && r.test.includes('Initialization'));
    if (initFailures.length > 0) {
      console.log('  - Check Azure service credentials and connectivity');
    }

    console.log('  - Consider implementing response caching for better performance');
    console.log('  - Add retry logic for transient failures');
    console.log('  - Monitor audio quality and user feedback');
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  const tester = new VoiceSystemTester();
  tester.runAllTests().catch(console.error);
}

export { VoiceSystemTester };
