import { test, expect } from '@playwright/test';
import {
  startInterview,
  completePhase,
  waitForAgentHandoff,
  assertInterviewCompletion,
  getResponsesForScenario,
  SELECTORS,
  InterviewScenario
} from '../utils/interview-helpers';

/**
 * E2E tests for different interview scenarios
 * This suite covers different role levels, industries, and interview modes
 */

// Common interview phases
const PHASES = {
  TECHNICAL: 'Technical',
  BEHAVIORAL: 'Behavioral',
  SYSTEM_DESIGN: 'System Design',
};

// Test scenarios
const scenarios: Record<string, InterviewScenario> = {
  seniorTech: {
    role: 'Senior Software Engineer',
    experience: 'senior',
    industry: 'technology',
    mode: 'text',
    expectedPhases: [PHASES.TECHNICAL, PHASES.BEHAVIORAL, PHASES.SYSTEM_DESIGN],
  },
  entryTech: {
    role: 'Junior Developer',
    experience: 'entry',
    industry: 'technology',
    mode: 'text',
    expectedPhases: [PHASES.TECHNICAL, PHASES.BEHAVIORAL],
  },
  financeVoice: {
    role: 'Financial Analyst',
    experience: 'mid',
    industry: 'finance',
    mode: 'voice',
    expectedPhases: [PHASES.BEHAVIORAL, PHASES.TECHNICAL],
  },
  healthcareSenior: {
    role: 'Healthcare Systems Architect',
    experience: 'senior',
    industry: 'healthcare',
    mode: 'text',
    expectedPhases: [PHASES.BEHAVIORAL, PHASES.TECHNICAL, PHASES.SYSTEM_DESIGN],
  },
};

test.describe('Foundry Interview Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to interview page
    await page.goto('/interview');
    
    // Ensure page is fully loaded
    await page.waitForSelector(SELECTORS.startInterviewButton);
  });
  
  test('Senior Software Engineer - Full interview workflow', async ({ page }) => {
    const scenario = scenarios.seniorTech;
    
    // Start interview with senior tech scenario
    await startInterview(page, scenario);
    
    // Complete Technical Phase
    await completePhase(
      page,
      PHASES.TECHNICAL,
      getResponsesForScenario(scenario, PHASES.TECHNICAL)
    );
    
    // Wait for agent handoff to behavioral interviewer
    await waitForAgentHandoff(page, 'behavioral');
    
    // Complete Behavioral Phase
    await completePhase(
      page,
      PHASES.BEHAVIORAL,
      getResponsesForScenario(scenario, PHASES.BEHAVIORAL)
    );
    
    // Wait for agent handoff to system design interviewer
    await waitForAgentHandoff(page, 'design');
    
    // Complete System Design Phase
    await completePhase(
      page,
      PHASES.SYSTEM_DESIGN,
      getResponsesForScenario(scenario, PHASES.SYSTEM_DESIGN)
    );
    
    // Verify interview completed successfully
    const results = await assertInterviewCompletion(page, scenario.expectedPhases);
    
    // Additional assertions for senior role
    expect(results.finalScore).toBeTruthy();
    
    // Check for specific feedback elements expected in senior interviews
    const feedback = results.feedback || '';
    expect(feedback).toContain('technical skills');
    expect(feedback).toContain('system design');
  });
  
  test('Entry-level Developer - Simplified interview workflow', async ({ page }) => {
    const scenario = scenarios.entryTech;
    
    // Start interview with entry-level tech scenario
    await startInterview(page, scenario);
    
    // Complete Technical Phase
    await completePhase(
      page,
      PHASES.TECHNICAL,
      getResponsesForScenario(scenario, PHASES.TECHNICAL)
    );
    
    // Wait for agent handoff to behavioral interviewer
    await waitForAgentHandoff(page, 'behavioral');
    
    // Complete Behavioral Phase
    await completePhase(
      page,
      PHASES.BEHAVIORAL,
      getResponsesForScenario(scenario, PHASES.BEHAVIORAL)
    );
    
    // Verify interview completed successfully
    const results = await assertInterviewCompletion(page, scenario.expectedPhases);
    
    // Verify no system design phase for entry-level
    const phaseNames = results.phaseScores?.map(score => score.phase?.toLowerCase()) || [];
    expect(phaseNames.some(phase => phase?.includes('system design'))).toBe(false);
    
    // Check for entry-level appropriate feedback
    const feedback = results.feedback || '';
    expect(feedback).toContain('fundamentals');
  });
  
  test('Financial Analyst - Voice-enabled interview', async ({ page }) => {
    const scenario = scenarios.financeVoice;
    
    // Start interview with finance voice scenario
    await startInterview(page, scenario);
    
    // Complete Behavioral Phase with voice responses
    await completePhase(
      page,
      PHASES.BEHAVIORAL,
      getResponsesForScenario(scenario, PHASES.BEHAVIORAL),
      'voice' // Use voice mode
    );
    
    // Wait for agent handoff to technical interviewer
    await waitForAgentHandoff(page, 'technical');
    
    // Complete Technical Phase with voice responses
    await completePhase(
      page,
      PHASES.TECHNICAL,
      getResponsesForScenario(scenario, PHASES.TECHNICAL),
      'voice' // Use voice mode
    );
    
    // Verify interview completed successfully
    const results = await assertInterviewCompletion(page, scenario.expectedPhases);
    
    // Check for finance industry specific feedback
    const feedback = results.feedback || '';
    expect(feedback).toContain('financial');
  });
  
  test('Healthcare Systems Architect - Industry-specific interview', async ({ page }) => {
    const scenario = scenarios.healthcareSenior;
    
    // Start interview with healthcare senior scenario
    await startInterview(page, scenario);
    
    // Complete Behavioral Phase
    await completePhase(
      page,
      PHASES.BEHAVIORAL,
      getResponsesForScenario(scenario, PHASES.BEHAVIORAL)
    );
    
    // Wait for agent handoff to technical interviewer
    await waitForAgentHandoff(page, 'technical');
    
    // Complete Technical Phase
    await completePhase(
      page,
      PHASES.TECHNICAL,
      getResponsesForScenario(scenario, PHASES.TECHNICAL)
    );
    
    // Wait for agent handoff to system design interviewer
    await waitForAgentHandoff(page, 'design');
    
    // Complete System Design Phase
    await completePhase(
      page,
      PHASES.SYSTEM_DESIGN,
      getResponsesForScenario(scenario, PHASES.SYSTEM_DESIGN)
    );
    
    // Verify interview completed successfully
    const results = await assertInterviewCompletion(page, scenario.expectedPhases);
    
    // Check for healthcare industry specific feedback
    const feedback = results.feedback || '';
    expect(feedback).toContain('healthcare');
    
    // Verify all phases were completed
    expect(results.phaseScores?.length).toBeGreaterThanOrEqual(3);
  });
});
