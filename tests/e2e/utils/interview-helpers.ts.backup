import { Page, expect } from '@playwright/test';

/**
 * Utility functions for interview E2E tests
 */

export interface InterviewScenario {
  role: string;
  experience: 'entry' | 'mid' | 'senior';
  industry: 'technology' | 'finance' | 'healthcare';
  mode: 'voice' | 'text';
  expectedPhases: string[];
}

export interface InterviewResponse {
  phase: string;
  question: string;
  response: string;
  duration?: number;
}

/**
 * Common test selectors used across interview tests
 */
export const SELECTORS = {
  // Interview setup
  startInterviewButton: '[data-testid="start-interview"]',
  roleInput: '[data-testid="role-input"]',
  experienceSelect: '[data-testid="experience-select"]',
  industrySelect: '[data-testid="industry-select"]',
  modeToggle: '[data-testid="mode-toggle"]',
  
  // Interview UI
  currentPhase: '[data-testid="current-phase"]',
  questionText: '[data-testid="question-text"]',
  responseInput: '[data-testid="response-input"]',
  submitButton: '[data-testid="submit-response"]',
  nextPhaseButton: '[data-testid="next-phase"]',
  
  // Voice controls
  voiceRecordButton: '[data-testid="voice-record"]',
  voiceStopButton: '[data-testid="voice-stop"]',
  voiceStatus: '[data-testid="voice-status"]',
  transcriptDisplay: '[data-testid="transcript"]',
  
  // Progress and status
  progressBar: '[data-testid="progress-bar"]',
  phaseIndicator: '[data-testid="phase-indicator"]',
  agentIndicator: '[data-testid="agent-indicator"]',
  
  // Results
  finalScore: '[data-testid="final-score"]',
  detailedFeedback: '[data-testid="detailed-feedback"]',
  phaseScores: '[data-testid="phase-scores"]',
  completionMessage: '[data-testid="completion-message"]',
  
  // Error states
  errorMessage: '[data-testid="error-message"]',
  retryButton: '[data-testid="retry-button"]',
  networkStatus: '[data-testid="network-status"]',
};

/**
 * Start an interview with given scenario
 */
export async function startInterview(page: Page, scenario: InterviewScenario) {
  // Fill interview setup form
  await page.fill(SELECTORS.roleInput, scenario.role);
  await page.selectOption(SELECTORS.experienceSelect, scenario.experience);
  await page.selectOption(SELECTORS.industrySelect, scenario.industry);
  
  // Set interview mode
  const modeToggle = page.locator(SELECTORS.modeToggle);
  const currentMode = await modeToggle.getAttribute('data-mode');
  if (currentMode !== scenario.mode) {
    await modeToggle.click();
  }
  
  // Start the interview
  await page.click(SELECTORS.startInterviewButton);
  
  // Wait for interview to begin
  await page.waitForSelector(SELECTORS.currentPhase, { timeout: 10000 });
}

/**
 * Wait for a specific interview phase to start
 */
export async function waitForPhase(page: Page, phaseName: string, timeoutMs = 30000) {
  await page.waitForFunction(
    (expectedPhase) => {
      const phaseElement = document.querySelector('[data-testid="current-phase"]');
      return phaseElement?.textContent?.toLowerCase().includes(expectedPhase.toLowerCase());
    },
    phaseName,
    { timeout: timeoutMs }
  );
}

/**
 * Submit a text response to the current question
 */
export async function submitTextResponse(page: Page, response: string) {
  await page.fill(SELECTORS.responseInput, response);
  await page.click(SELECTORS.submitButton);
  
  // Wait for response to be processed
  await page.waitForSelector(SELECTORS.responseInput + '[disabled]', { timeout: 5000 });
  await page.waitForSelector(SELECTORS.responseInput + ':not([disabled])', { timeout: 15000 });
}

/**
 * Submit a voice response using simulation
 */
export async function submitVoiceResponse(page: Page, transcript: string) {
  // Start voice recording
  await page.click(SELECTORS.voiceRecordButton);
  
  // Wait for recording to start
  await page.waitForSelector('[data-testid="voice-status"][data-status="recording"]');
  
  // Simulate voice transcript
  await page.evaluate((text) => {
    window.simulateVoiceTranscript?.(text, true);
  }, transcript);
  
  // Stop recording
  await page.click(SELECTORS.voiceStopButton);
  
  // Wait for processing
  await page.waitForSelector('[data-testid="voice-status"][data-status="processing"]');
  await page.waitForSelector('[data-testid="voice-status"][data-status="ready"]', { timeout: 15000 });
}

/**
 * Wait for agent handoff to complete
 */
export async function waitForAgentHandoff(page: Page, expectedAgent: string) {
  await page.waitForFunction(
    (agentName) => {
      const agentElement = document.querySelector('[data-testid="agent-indicator"]');
      return agentElement?.textContent?.toLowerCase().includes(agentName.toLowerCase());
    },
    expectedAgent,
    { timeout: 20000 }
  );
}

/**
 * Complete an entire interview phase
 */
export async function completePhase(
  page: Page, 
  phaseName: string, 
  responses: string[], 
  mode: 'voice' | 'text' = 'text'
) {
  await waitForPhase(page, phaseName);
  
  for (const response of responses) {
    // Wait for question to appear
    await page.waitForSelector(SELECTORS.questionText);
    
    if (mode === 'voice') {
      await submitVoiceResponse(page, response);
    } else {
      await submitTextResponse(page, response);
    }
    
    // Small delay between responses
    await page.waitForTimeout(1000);
  }
  
  // Wait for phase completion
  await page.waitForFunction(
    () => window.interviewSession?.currentPhase !== phaseName || 
          document.querySelector('[data-testid="next-phase"]'),
    { timeout: 30000 }
  );
}

/**
 * Simulate network failure
 */
export async function simulateNetworkFailure(page: Page) {
  await page.evaluate(() => {
    window.simulateNetworkFailure?.();
  });
  
  // Wait for network status indicator
  await page.waitForSelector('[data-testid="network-status"][data-status="offline"]');
}

/**
 * Restore network connection
 */
export async function restoreNetwork(page: Page) {
  await page.evaluate(() => {
    window.restoreNetwork?.();
  });
  
  // Wait for network status to recover
  await page.waitForSelector('[data-testid="network-status"][data-status="online"]');
}

/**
 * Simulate agent failure
 */
export async function simulateAgentFailure(page: Page, agentType: string) {
  await page.evaluate((type) => {
    window.simulateAgentFailure?.(type);
  }, agentType);
  
  // Wait for error message or fallback agent
  await Promise.race([
    page.waitForSelector(SELECTORS.errorMessage),
    page.waitForSelector('[data-testid="agent-indicator"][data-status="fallback"]')
  ]);
}

/**
 * Get final interview results from the page
 */
export async function getFinalResults(page: Page) {
  await page.waitForSelector(SELECTORS.finalScore, { timeout: 30000 });
  
  return await page.evaluate(() => {
    return {
      finalScore: document.querySelector('[data-testid="final-score"]')?.textContent,
      phaseScores: Array.from(document.querySelectorAll('[data-testid="phase-scores"] .phase-score')).map(
        el => ({
          phase: el.querySelector('.phase-name')?.textContent,
          score: el.querySelector('.phase-score-value')?.textContent,
        })
      ),
      feedback: document.querySelector('[data-testid="detailed-feedback"]')?.textContent,
      session: window.interviewSession,
      results: window.interviewResults,
    };
  });
}

/**
 * Predefined response sets for different scenarios
 */
export const RESPONSE_SETS = {
  technical: {
    entry: [
      "I would start by understanding the problem requirements and breaking it down into smaller components.",
      "I would use basic algorithms like arrays and loops to solve this step by step.",
      "I need to consider edge cases like empty inputs and invalid data.",
    ],
    senior: [
      "I would analyze the time and space complexity requirements first, then design an optimal solution.",
      "This problem can be solved using dynamic programming with memoization for O(n) time complexity.",
      "I would implement proper error handling, logging, and consider scalability from the start.",
    ]
  },
  
  behavioral: {
    entry: [
      "In my last internship, I worked closely with my mentor to learn new technologies.",
      "When facing a challenge, I usually ask for help from more experienced team members.",
      "I'm motivated by learning new things and contributing to team goals.",
    ],
    senior: [
      "I led a cross-functional team of 8 people to deliver a critical product feature on time.",
      "I identified a bottleneck in our deployment process and implemented automation that reduced deploy time by 70%.",
      "I mentor junior developers and have established coding standards that improved our team's code quality.",
    ]
  },
  
  systemDesign: {
    entry: [
      "I would start with a simple client-server architecture using a web framework.",
      "For the database, I would use something familiar like MySQL or PostgreSQL.",
      "I would focus on getting the basic functionality working first, then optimize later.",
    ],
    senior: [
      "I would design this as a microservices architecture with proper service boundaries and APIs.",
      "For scalability, I would use load balancers, caching layers, and database sharding strategies.",
      "I would implement proper monitoring, circuit breakers, and graceful degradation patterns.",
    ]
  }
};

/**
 * Get appropriate responses for a scenario
 */
export function getResponsesForScenario(
  scenario: InterviewScenario, 
  phase: string
): string[] {
  const responseKey = phase.toLowerCase().replace(/\s+/g, '') as keyof typeof RESPONSE_SETS;
  const responses = RESPONSE_SETS[responseKey as keyof typeof RESPONSE_SETS];
  
  if (responses) {
    return responses[scenario.experience] || responses.entry;
  }
  
  // Fallback generic responses
  return [
    "That's an interesting question. Let me think through this systematically.",
    "Based on my experience, I would approach this by first understanding the requirements.",
    "I believe the key factors to consider here are scalability, maintainability, and performance.",
  ];
}

/**
 * Assert interview completed successfully
 */
export async function assertInterviewCompletion(page: Page, expectedPhases: string[]) {
  const results = await getFinalResults(page);
  
  // Verify completion message is shown
  await expect(page.locator(SELECTORS.completionMessage)).toBeVisible();
  
  // Verify final score is present
  expect(results.finalScore).toBeTruthy();
  
  // Verify all expected phases were completed
  const completedPhases = results.phaseScores?.map(score => score.phase) || [];
  for (const expectedPhase of expectedPhases) {
    expect(completedPhases.some(phase => 
      phase?.toLowerCase().includes(expectedPhase.toLowerCase())
    )).toBe(true);
  }
  
  return results;
}
