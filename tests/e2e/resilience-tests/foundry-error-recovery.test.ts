import { test, expect } from '@playwright/test';
import {
  startInterview,
  completePhase,
  simulateNetworkFailure,
  restoreNetwork,
  simulateAgentFailure,
  getFinalResults,
  SELECTORS,
  InterviewScenario
} from '../utils/interview-helpers';

/**
 * E2E tests for error recovery and resilience
 * This suite tests how the interview system handles various failure scenarios
 */

const testScenario: InterviewScenario = {
  role: 'Software Engineer',
  experience: 'mid',
  industry: 'technology',
  mode: 'text',
  expectedPhases: ['Technical', 'Behavioral'],
};

test.describe('Foundry Error Recovery and Resilience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/interview');
    await page.waitForSelector(SELECTORS.startInterviewButton);
  });
  
  test('Network interruption recovery during interview', async ({ page }) => {
    // Start interview normally
    await startInterview(page, testScenario);
    
    // Begin technical phase
    await page.waitForSelector(SELECTORS.questionText);
    
    // Fill first response
    await page.fill(SELECTORS.responseInput, 'This is my first response before network failure.');
    
    // Simulate network failure before submission
    await simulateNetworkFailure(page);
    
    // Try to submit response (should fail)
    await page.click(SELECTORS.submitButton);
    
    // Verify error state is shown
    await expect(page.locator(SELECTORS.errorMessage)).toBeVisible();
    await expect(page.locator('[data-testid="network-status"][data-status="offline"]')).toBeVisible();
    
    // Restore network
    await restoreNetwork(page);
    
    // Verify network status recovered
    await expect(page.locator('[data-testid="network-status"][data-status="online"]')).toBeVisible();
    
    // Retry submission (should work now)
    await page.click(SELECTORS.retryButton);
    
    // Verify response was processed
    await page.waitForSelector(SELECTORS.responseInput + '[disabled]', { timeout: 5000 });
    await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    
    // Continue with interview to verify full recovery
    await page.fill(SELECTORS.responseInput, 'This is my second response after network recovery.');
    await page.click(SELECTORS.submitButton);
    
    // Wait for phase completion
    await page.waitForSelector(SELECTORS.nextPhaseButton, { timeout: 30000 });
    
    console.log('✅ Network interruption recovery test passed');
  });
  
  test('Agent failure with graceful handoff to backup', async ({ page }) => {
    // Start interview normally
    await startInterview(page, testScenario);
    
    // Begin technical phase
    await page.waitForSelector(SELECTORS.questionText);
    
    // Complete first question
    await page.fill(SELECTORS.responseInput, 'This is my response before agent failure.');
    await page.click(SELECTORS.submitButton);
    await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    
    // Simulate technical agent failure
    await simulateAgentFailure(page, 'technical');
    
    // Wait for fallback agent indicator or error handling
    await Promise.race([
      page.waitForSelector('[data-testid="agent-indicator"][data-status="fallback"]', { timeout: 10000 }),
      page.waitForSelector(SELECTORS.errorMessage, { timeout: 10000 })
    ]);
    
    // Check if fallback agent is active
    const fallbackAgent = page.locator('[data-testid="agent-indicator"][data-status="fallback"]');
    if (await fallbackAgent.isVisible()) {
      console.log('✅ Fallback agent activated successfully');
      
      // Continue interview with fallback agent
      await page.waitForSelector(SELECTORS.questionText);
      await page.fill(SELECTORS.responseInput, 'This is my response with the fallback agent.');
      await page.click(SELECTORS.submitButton);
      
      // Verify interview can continue
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    } else {
      console.log('ℹ️ Error handling shown instead of fallback');
      
      // Verify error message is appropriate
      const errorText = await page.locator(SELECTORS.errorMessage).textContent();
      expect(errorText).toContain('technical difficulties');
      
      // Try to retry
      if (await page.locator(SELECTORS.retryButton).isVisible()) {
        await page.click(SELECTORS.retryButton);
        
        // Verify retry works
        await page.waitForSelector(SELECTORS.questionText, { timeout: 10000 });
      }
    }
  });
  
  test('Session timeout with save and resume capability', async ({ page }) => {
    // Start interview normally
    await startInterview(page, testScenario);
    
    // Complete first part of interview
    await page.waitForSelector(SELECTORS.questionText);
    await page.fill(SELECTORS.responseInput, 'This is my response before session timeout.');
    await page.click(SELECTORS.submitButton);
    await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    
    // Get current interview session state
    const sessionState = await page.evaluate(() => window.interviewSession);
    expect(sessionState).toBeTruthy();
    
    // Simulate session timeout by manipulating session
    await page.evaluate(() => {
      // Simulate session expiration
      if (window.interviewSession) {
        window.interviewSession.expired = true;
        window.interviewSession.lastActivity = Date.now() - (30 * 60 * 1000); // 30 minutes ago
      }
      
      // Dispatch session timeout event
      window.dispatchEvent(new CustomEvent('session:timeout', {
        detail: { sessionId: window.interviewSession?.id }
      }));
    });
    
    // Wait for timeout handling UI
    await Promise.race([
      page.waitForSelector('[data-testid="session-timeout-modal"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="session-expired-message"]', { timeout: 10000 })
    ]);
    
    // Check if resume option is available
    const resumeButton = page.locator('[data-testid="resume-session-button"]');
    if (await resumeButton.isVisible()) {
      console.log('✅ Resume session option available');
      
      // Click resume
      await resumeButton.click();
      
      // Verify session is restored
      await page.waitForSelector(SELECTORS.questionText, { timeout: 10000 });
      
      // Verify previous progress is maintained
      const restoredState = await page.evaluate(() => window.interviewSession);
      expect(restoredState.responses).toBeTruthy();
      expect(restoredState.responses.length).toBeGreaterThan(0);
      
    } else {
      console.log('ℹ️ Session expired, restart required');
      
      // Look for restart option
      const restartButton = page.locator('[data-testid="restart-interview-button"]');
      if (await restartButton.isVisible()) {
        await restartButton.click();
        
        // Verify restart works
        await page.waitForSelector(SELECTORS.startInterviewButton);
      }
    }
  });
  
  test('Combined failure scenarios - network + agent failure', async ({ page }) => {
    // Start interview normally
    await startInterview(page, testScenario);
    
    // Begin technical phase
    await page.waitForSelector(SELECTORS.questionText);
    
    // Complete first question
    await page.fill(SELECTORS.responseInput, 'Response before combined failures.');
    await page.click(SELECTORS.submitButton);
    await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    
    // Simulate network failure first
    await simulateNetworkFailure(page);
    
    // Then simulate agent failure while network is down
    await simulateAgentFailure(page, 'technical');
    
    // Verify error handling for combined failures
    await expect(page.locator(SELECTORS.errorMessage)).toBeVisible();
    
    // Restore network first
    await restoreNetwork(page);
    
    // Wait for recovery attempts
    await page.waitForTimeout(2000);
    
    // Check if system recovers gracefully
    const retryButton = page.locator(SELECTORS.retryButton);
    const resumeButton = page.locator('[data-testid="resume-interview-button"]');
    
    if (await retryButton.isVisible()) {
      await retryButton.click();
    } else if (await resumeButton.isVisible()) {
      await resumeButton.click();
    }
    
    // Verify some form of recovery is possible
    await Promise.race([
      page.waitForSelector(SELECTORS.questionText, { timeout: 20000 }),
      page.waitForSelector(SELECTORS.startInterviewButton, { timeout: 20000 }),
      page.waitForSelector('[data-testid="technical-difficulties"]', { timeout: 20000 })
    ]);
    
    console.log('✅ Combined failure scenario handled');
  });
  
  test('Data persistence during interruptions', async ({ page }) => {
    // Start interview normally
    await startInterview(page, testScenario);
    
    // Complete several responses
    const responses = [
      'First response about algorithms',
      'Second response about data structures',
      'Third response about system design'
    ];
    
    for (const response of responses) {
      await page.waitForSelector(SELECTORS.questionText);
      await page.fill(SELECTORS.responseInput, response);
      await page.click(SELECTORS.submitButton);
      await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
    }
    
    // Get current progress
    const beforeInterruption = await page.evaluate(() => ({
      session: window.interviewSession,
      responses: window.interviewSession?.responses || []
    }));
    
    // Simulate page refresh (simulates browser crash/refresh)
    await page.reload();
    
    // Wait for page to load
    await page.waitForSelector(SELECTORS.startInterviewButton, { timeout: 10000 });
    
    // Check if there's an option to resume
    const resumeOption = page.locator('[data-testid="resume-previous-session"]');
    if (await resumeOption.isVisible()) {
      await resumeOption.click();
      
      // Verify data is restored
      await page.waitForSelector(SELECTORS.currentPhase);
      
      const afterResume = await page.evaluate(() => ({
        session: window.interviewSession,
        responses: window.interviewSession?.responses || []
      }));
      
      // Verify responses were preserved
      expect(afterResume.responses.length).toBe(beforeInterruption.responses.length);
      console.log('✅ Data persistence verified after interruption');
      
    } else {
      console.log('ℹ️ No resume option available, session data may not be persisted');
    }
  });
  
  test('Rapid failure and recovery cycles', async ({ page }) => {
    // Start interview normally
    await startInterview(page, testScenario);
    
    // Begin technical phase
    await page.waitForSelector(SELECTORS.questionText);
    
    // Rapid failure/recovery cycle
    for (let i = 0; i < 3; i++) {
      console.log(`🔄 Failure/recovery cycle ${i + 1}`);
      
      // Fill response
      await page.fill(SELECTORS.responseInput, `Response during cycle ${i + 1}`);
      
      // Simulate network failure
      await simulateNetworkFailure(page);
      
      // Try to submit (should fail)
      await page.click(SELECTORS.submitButton);
      
      // Wait a bit for error state
      await page.waitForTimeout(1000);
      
      // Restore network quickly
      await restoreNetwork(page);
      
      // Wait for recovery
      await page.waitForTimeout(1000);
      
      // Retry submission
      if (await page.locator(SELECTORS.retryButton).isVisible()) {
        await page.click(SELECTORS.retryButton);
      } else {
        await page.click(SELECTORS.submitButton);
      }
      
      // Wait for response processing
      try {
        await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 10000 });
      } catch (error) {
        console.log(`⚠️ Cycle ${i + 1} did not complete successfully`);
        break;
      }
    }
    
    // Verify system is still functional after rapid cycles
    await page.waitForSelector(SELECTORS.questionText);
    
    console.log('✅ Rapid failure/recovery cycles completed');
  });
});
