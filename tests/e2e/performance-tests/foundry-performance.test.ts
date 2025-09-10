import { test, expect } from '@playwright/test';
import {
  startInterview,
  completePhase,
  assertInterviewCompletion,
  getResponsesForScenario,
  SELECTORS,
  InterviewScenario
} from '../utils/interview-helpers';

/**
 * E2E performance validation tests
 * This suite tests interview system performance under various conditions
 */

const performanceScenario: InterviewScenario = {
  role: 'Senior Software Engineer',
  experience: 'senior',
  industry: 'technology',
  mode: 'text',
  expectedPhases: ['Technical', 'Behavioral', 'System Design'],
};

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  INTERVIEW_START: 5000,      // Interview should start within 5 seconds
  RESPONSE_PROCESSING: 15000,  // Response should process within 15 seconds
  PHASE_TRANSITION: 10000,     // Phase transitions within 10 seconds
  TOTAL_INTERVIEW: 300000,     // Complete interview within 5 minutes
  VOICE_LATENCY: 3000,         // Voice responses within 3 seconds
  AGENT_HANDOFF: 8000,         // Agent handoffs within 8 seconds
};

test.describe('Foundry Performance Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/interview');
    await page.waitForSelector(SELECTORS.startInterviewButton);
  });

  test('Interview startup performance', async ({ page }) => {
    const startTime = Date.now();
    
    // Start interview
    await startInterview(page, performanceScenario);
    
    // Wait for first question to appear
    await page.waitForSelector(SELECTORS.questionText);
    
    const startupTime = Date.now() - startTime;
    
    console.log(`⏱️ Interview startup time: ${startupTime}ms`);
    expect(startupTime).toBeLessThan(PERFORMANCE_THRESHOLDS.INTERVIEW_START);
  });

  test('Response processing performance', async ({ page }) => {
    await startInterview(page, performanceScenario);
    await page.waitForSelector(SELECTORS.questionText);
    
    const responses = getResponsesForScenario(performanceScenario, 'Technical');
    const processingTimes: number[] = [];
    
    for (const response of responses.slice(0, 3)) { // Test first 3 responses
      const startTime = Date.now();
      
      // Submit response
      await page.fill(SELECTORS.responseInput, response);
      await page.click(SELECTORS.submitButton);
      
      // Wait for processing to complete
      await page.waitForSelector(SELECTORS.responseInput + '[disabled]', { timeout: 5000 });
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { 
        timeout: PERFORMANCE_THRESHOLDS.RESPONSE_PROCESSING 
      });
      
      const processingTime = Date.now() - startTime;
      processingTimes.push(processingTime);
      
      console.log(`⏱️ Response ${processingTimes.length} processing time: ${processingTime}ms`);
    }
    
    // Calculate average processing time
    const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    console.log(`⏱️ Average response processing time: ${avgProcessingTime.toFixed(2)}ms`);
    
    // All responses should process within threshold
    processingTimes.forEach(time => {
      expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_PROCESSING);
    });
    
    // Average should be significantly faster
    expect(avgProcessingTime).toBeLessThan(PERFORMANCE_THRESHOLDS.RESPONSE_PROCESSING * 0.8);
  });

  test('Agent handoff performance', async ({ page }) => {
    await startInterview(page, performanceScenario);
    await page.waitForSelector(SELECTORS.questionText);
    
    // Complete technical phase
    const technicalResponses = getResponsesForScenario(performanceScenario, 'Technical');
    for (const response of technicalResponses) {
      await page.fill(SELECTORS.responseInput, response);
      await page.click(SELECTORS.submitButton);
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    }
    
    // Wait for next phase button
    await page.waitForSelector(SELECTORS.nextPhaseButton, { timeout: 30000 });
    
    // Measure agent handoff time
    const handoffStart = Date.now();
    await page.click(SELECTORS.nextPhaseButton);
    
    // Wait for new agent to be active
    await page.waitForFunction(
      () => {
        const agentElement = document.querySelector('[data-testid="agent-indicator"]');
        return agentElement?.textContent?.toLowerCase().includes('behavioral');
      },
      { timeout: PERFORMANCE_THRESHOLDS.AGENT_HANDOFF }
    );
    
    // Wait for new question to appear
    await page.waitForSelector(SELECTORS.questionText);
    
    const handoffTime = Date.now() - handoffStart;
    console.log(`⏱️ Agent handoff time: ${handoffTime}ms`);
    
    expect(handoffTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AGENT_HANDOFF);
  });

  test('Complete interview duration performance', async ({ page }) => {
    const interviewStartTime = Date.now();
    
    // Start interview
    await startInterview(page, performanceScenario);
    
    // Complete all phases with minimal responses
    const minimalResponses = [
      'I have experience with this.',
      'My approach would be systematic.',
      'I consider scalability important.'
    ];
    
    // Technical phase
    await page.waitForSelector(SELECTORS.questionText);
    for (const response of minimalResponses) {
      await page.fill(SELECTORS.responseInput, response);
      await page.click(SELECTORS.submitButton);
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    }
    
    // Move to behavioral phase
    await page.waitForSelector(SELECTORS.nextPhaseButton, { timeout: 30000 });
    await page.click(SELECTORS.nextPhaseButton);
    
    // Complete behavioral phase
    await page.waitForSelector(SELECTORS.questionText);
    for (const response of minimalResponses) {
      await page.fill(SELECTORS.responseInput, response);
      await page.click(SELECTORS.submitButton);
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    }
    
    // Move to system design phase
    await page.waitForSelector(SELECTORS.nextPhaseButton, { timeout: 30000 });
    await page.click(SELECTORS.nextPhaseButton);
    
    // Complete system design phase
    await page.waitForSelector(SELECTORS.questionText);
    for (const response of minimalResponses) {
      await page.fill(SELECTORS.responseInput, response);
      await page.click(SELECTORS.submitButton);
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    }
    
    // Wait for completion
    await page.waitForSelector(SELECTORS.finalScore, { timeout: 60000 });
    
    const totalTime = Date.now() - interviewStartTime;
    console.log(`⏱️ Complete interview duration: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);
    
    expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TOTAL_INTERVIEW);
  });

  test('High-frequency interaction performance', async ({ page }) => {
    await startInterview(page, performanceScenario);
    await page.waitForSelector(SELECTORS.questionText);
    
    // Simulate rapid typing and submissions
    const rapidResponses = [
      'Quick response 1',
      'Quick response 2', 
      'Quick response 3',
      'Quick response 4',
      'Quick response 5'
    ];
    
    const responseTimes: number[] = [];
    
    for (const response of rapidResponses) {
      const startTime = Date.now();
      
      // Type response quickly
      await page.fill(SELECTORS.responseInput, '');
      await page.type(SELECTORS.responseInput, response, { delay: 10 }); // Fast typing
      
      // Submit immediately
      await page.click(SELECTORS.submitButton);
      
      // Wait for processing
      await page.waitForSelector(SELECTORS.responseInput + '[disabled]', { timeout: 3000 });
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
      
      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);
      
      console.log(`⏱️ Rapid response ${responseTimes.length} time: ${responseTime}ms`);
      
      // Small delay between submissions to avoid overwhelming
      await page.waitForTimeout(500);
    }
    
    // Check that system handles rapid interactions well
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    console.log(`⏱️ Average rapid response time: ${avgResponseTime.toFixed(2)}ms`);
    
    // System should handle rapid interactions without degradation
    const lastThreeResponses = responseTimes.slice(-3);
    const avgLastThree = lastThreeResponses.reduce((a, b) => a + b, 0) / lastThreeResponses.length;
    
    // Performance shouldn't degrade significantly over time
    expect(avgLastThree).toBeLessThan(avgResponseTime * 1.5);
  });

  test('Voice mode performance validation', async ({ page }) => {
    const voiceScenario: InterviewScenario = {
      ...performanceScenario,
      mode: 'voice'
    };
    
    await startInterview(page, voiceScenario);
    await page.waitForSelector(SELECTORS.questionText);
    
    const voiceResponses = ['This is a voice response test', 'Voice latency testing'];
    const voiceLatencies: number[] = [];
    
    for (const transcript of voiceResponses) {
      // Start voice recording
      const startTime = Date.now();
      await page.click(SELECTORS.voiceRecordButton);
      
      // Wait for recording state
      await page.waitForSelector('[data-testid="voice-status"][data-status="recording"]');
      
      // Simulate voice transcript
      await page.evaluate((text) => {
        window.simulateVoiceTranscript?.(text, true);
      }, transcript);
      
      // Stop recording
      await page.click(SELECTORS.voiceStopButton);
      
      // Wait for processing and ready state
      await page.waitForSelector('[data-testid="voice-status"][data-status="processing"]');
      await page.waitForSelector('[data-testid="voice-status"][data-status="ready"]', { 
        timeout: PERFORMANCE_THRESHOLDS.VOICE_LATENCY * 2 
      });
      
      const latency = Date.now() - startTime;
      voiceLatencies.push(latency);
      
      console.log(`⏱️ Voice response ${voiceLatencies.length} latency: ${latency}ms`);
      
      await page.waitForTimeout(1000); // Delay between voice responses
    }
    
    // Voice responses should be processed quickly
    voiceLatencies.forEach(latency => {
      expect(latency).toBeLessThan(PERFORMANCE_THRESHOLDS.VOICE_LATENCY * 3); // Allow some extra time for voice processing
    });
    
    const avgVoiceLatency = voiceLatencies.reduce((a, b) => a + b, 0) / voiceLatencies.length;
    console.log(`⏱️ Average voice latency: ${avgVoiceLatency.toFixed(2)}ms`);
  });

  test('Performance under time pressure', async ({ page }) => {
    await startInterview(page, performanceScenario);
    await page.waitForSelector(SELECTORS.questionText);
    
    // Set aggressive time limits
    const timeConstraints = {
      responseTime: 10000, // 10 seconds per response
      totalPhaseTime: 60000 // 1 minute per phase
    };
    
    const phaseStartTime = Date.now();
    const responses = getResponsesForScenario(performanceScenario, 'Technical');
    
    for (const response of responses.slice(0, 3)) {
      const responseStartTime = Date.now();
      
      // Submit response quickly
      await page.fill(SELECTORS.responseInput, response);
      await page.click(SELECTORS.submitButton);
      
      // Wait for processing with time constraint
      await page.waitForSelector(SELECTORS.responseInput + '[disabled]', { timeout: 3000 });
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { 
        timeout: timeConstraints.responseTime 
      });
      
      const responseTime = Date.now() - responseStartTime;
      console.log(`⏱️ Time-pressured response processing: ${responseTime}ms`);
      
      // Verify response time is acceptable
      expect(responseTime).toBeLessThan(timeConstraints.responseTime);
    }
    
    const totalPhaseTime = Date.now() - phaseStartTime;
    console.log(`⏱️ Total phase time under pressure: ${totalPhaseTime}ms`);
    
    // Phase should complete within time constraint
    expect(totalPhaseTime).toBeLessThan(timeConstraints.totalPhaseTime);
  });

  test('Memory and resource usage validation', async ({ page }) => {
    await startInterview(page, performanceScenario);
    
    // Get initial memory usage
    const initialMetrics = await page.evaluate(() => ({
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      } : null,
      timing: performance.timing,
    }));
    
    // Complete several interactions
    await page.waitForSelector(SELECTORS.questionText);
    
    const longResponse = 'This is a very long response to test memory usage. '.repeat(50);
    for (let i = 0; i < 5; i++) {
      await page.fill(SELECTORS.responseInput, `${longResponse} Iteration ${i + 1}`);
      await page.click(SELECTORS.submitButton);
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
      await page.waitForTimeout(1000);
    }
    
    // Check memory usage after interactions
    const finalMetrics = await page.evaluate(() => ({
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      } : null,
      timing: performance.timing,
    }));
    
    if (initialMetrics.memory && finalMetrics.memory) {
      const memoryIncrease = finalMetrics.memory.usedJSHeapSize - initialMetrics.memory.usedJSHeapSize;
      const memoryIncreasePercent = (memoryIncrease / initialMetrics.memory.usedJSHeapSize) * 100;
      
      console.log(`📊 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${memoryIncreasePercent.toFixed(2)}%)`);
      
      // Memory usage shouldn't increase dramatically
      expect(memoryIncreasePercent).toBeLessThan(200); // Less than 200% increase
    }
    
    console.log('✅ Memory and resource usage validation completed');
  });
});
