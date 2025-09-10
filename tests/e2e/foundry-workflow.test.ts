/**
 * Complete Interview Workflow End-to-End Tests
 * 
 * Tests complete user journeys from start to finish, including realistic 
 * multi-agent interview scenarios with voice and text interactions.
 * Validates all components work together seamlessly under various conditions.
 */

import { test, expect, Page } from '@playwright/test';
import { SessionState, InterviewResult, WorkflowStatus } from '../../lib/azure-ai-foundry/workflows/workflow-types';

// Test data and mock responses
const technicalResponses = [
  "I have 5 years of experience with React and TypeScript. I've built several large-scale applications using these technologies.",
  "I would approach this by first understanding the requirements, then breaking down the problem into smaller components.",
  "I prefer using functional components with hooks as they're more modern and easier to test.",
  "For state management, I typically use Redux for complex apps or Context API for simpler ones.",
  "I always write unit tests and integration tests, aiming for at least 80% code coverage."
];

const behavioralResponses = [
  "I once had to work with a difficult team member. I approached them privately to understand their concerns and found a way to collaborate effectively.",
  "When facing tight deadlines, I prioritize tasks, communicate clearly with stakeholders, and focus on delivering the most critical features first.",
  "I handled a production bug by immediately investigating the issue, implementing a hotfix, and then analyzing root cause to prevent recurrence."
];

const systemDesignResponses = [
  "For a scalable chat application, I would use microservices architecture with WebSocket connections and a message queue like Redis.",
  "I would implement caching at multiple levels - CDN, application cache, and database cache to handle high traffic.",
  "For database design, I'd use a combination of SQL for transactional data and NoSQL for chat messages with proper sharding."
];

// Interview configuration types
interface InterviewConfig {
  role: string;
  experienceLevel: 'entry' | 'mid' | 'senior';
  industry: 'tech' | 'finance' | 'healthcare';
  mode: 'voice' | 'text';
  duration?: number; // in minutes
}

interface PhaseCompletion {
  questionsAnswered: number;
  responses: string[];
  duration?: number;
  voiceEnabled?: boolean;
}

/**
 * Helper Functions for Interview Workflow Testing
 */

// Start a multi-agent interview session
async function startMultiAgentInterview(page: Page, config: InterviewConfig): Promise<SessionState> {
  console.log(`🚀 Starting ${config.experienceLevel} ${config.role} interview in ${config.mode} mode`);
  
  // Navigate to interview start page
  await page.goto('/interview/start');
  
  // Configure interview parameters
  await page.selectOption('[data-testid="role-select"]', config.role);
  await page.selectOption('[data-testid="experience-level"]', config.experienceLevel);
  await page.selectOption('[data-testid="industry"]', config.industry);
  
  if (config.mode === 'voice') {
    await page.check('[data-testid="voice-mode-toggle"]');
    // Wait for microphone permissions
    await page.waitForSelector('[data-testid="voice-ready-indicator"]');
  }
  
  // Start the interview
  await page.click('[data-testid="start-interview-btn"]');
  
  // Wait for session initialization
  await page.waitForSelector('[data-testid="interview-session-active"]');
  
  // Extract session information
  const sessionId = await page.getAttribute('[data-testid="session-id"]', 'data-session-id');
  const sessionData = await page.evaluate(() => {
    return (window as any).interviewSession;
  });
  
  return {
    config: {
      sessionId: sessionId!,
      ...config,
      candidateProfile: {
        name: 'Test User',
        skills: ['JavaScript', 'React', 'TypeScript'],
        yearsExperience: 5
      }
    },
    status: sessionData.status || {},
    interviewContext: sessionData.interviewContext || {},
    allQuestions: sessionData.allQuestions || [],
    stageHistory: sessionData.stageHistory || [],
    notes: sessionData.notes || [],
    persistence: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      checkpoints: []
    }
  };
}

// Complete an interview phase with responses
async function completeInterviewPhase(
  page: Page, 
  sessionId: string, 
  phase: string, 
  completion: PhaseCompletion
): Promise<void> {
  console.log(`📝 Completing ${phase} phase with ${completion.questionsAnswered} questions`);
  
  // Wait for phase to be active
  await page.waitForSelector(`[data-testid="phase-${phase}-active"]`);
  
  // Answer questions in the phase
  for (let i = 0; i < completion.questionsAnswered; i++) {
    // Wait for question to appear
    await page.waitForSelector('[data-testid="current-question"]');
    
    const response = completion.responses[i] || `Sample response for ${phase} question ${i + 1}`;
    
    if (completion.voiceEnabled) {
      // Simulate voice input
      await page.click('[data-testid="voice-record-btn"]');
      await page.waitForTimeout(2000); // Simulate speaking time
      
      // Inject voice transcript
      await page.evaluate((transcript) => {
        (window as any).simulateVoiceTranscript(transcript);
      }, response);
      
      await page.click('[data-testid="voice-stop-btn"]');
    } else {
      // Text input
      await page.fill('[data-testid="text-response-input"]', response);
      await page.click('[data-testid="submit-response-btn"]');
    }
    
    // Wait for response processing
    await page.waitForSelector('[data-testid="response-processed"]');
    
    // Small delay between questions
    await page.waitForTimeout(1000);
  }
  
  console.log(`✅ Completed ${phase} phase`);
}

// Handle agent handoff between phases
async function handoffToNextAgent(page: Page, sessionId: string): Promise<void> {
  console.log('🔄 Initiating agent handoff');
  
  // Wait for handoff indicator
  await page.waitForSelector('[data-testid="agent-handoff-pending"]');
  
  // Wait for handoff completion
  await page.waitForSelector('[data-testid="agent-handoff-complete"]', { timeout: 10000 });
  
  // Verify new agent is active
  const newAgent = await page.textContent('[data-testid="current-agent"]');
  console.log(`✅ Handoff complete, now with: ${newAgent}`);
}

// Complete interview and get results
async function completeInterview(page: Page, sessionId: string): Promise<InterviewResult> {
  console.log('🏁 Completing interview and generating results');
  
  // Trigger interview completion
  await page.click('[data-testid="complete-interview-btn"]');
  
  // Wait for results processing
  await page.waitForSelector('[data-testid="results-ready"]', { timeout: 30000 });
  
  // Extract results
  const results = await page.evaluate(() => {
    return (window as any).interviewResults;
  });
  
  return results;
}

// Simulate network interruption
async function simulateNetworkInterruption(page: Page, duration: number = 5000): Promise<void> {
  console.log('🌐 Simulating network interruption');
  
  // Block network requests
  await page.route('**/*', route => route.abort());
  
  await page.waitForTimeout(duration);
  
  // Restore network
  await page.unroute('**/*');
  
  console.log('✅ Network restored');
}

// Simulate agent failure
async function simulateAgentFailure(page: Page, agentType: string): Promise<void> {
  console.log(`❌ Simulating ${agentType} agent failure`);
  
  await page.evaluate((agent) => {
    (window as any).simulateAgentFailure(agent);
  }, agentType);
}

/**
 * Main Test Suite
 */
test.describe('Complete Interview Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test environment
    await page.goto('/');
    
    // Login as test user
    await page.click('[data-testid="login-btn"]');
    await page.fill('[data-testid="email-input"]', 'test@prepbettr.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="submit-login"]');
    
    await page.waitForSelector('[data-testid="dashboard"]');
  });

  test('should complete full multi-agent interview - Senior Software Engineer', async ({ page }) => {
    // 1. Start interview session
    const session = await startMultiAgentInterview(page, {
      role: 'senior-software-engineer',
      experienceLevel: 'senior',
      industry: 'tech',
      mode: 'text',
      duration: 45
    });
    
    expect(session.id).toBeDefined();
    expect(session.config.experienceLevel).toBe('senior');
    
    // 2. Complete technical phase (15 minutes simulated)
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 5,
      responses: technicalResponses
    });
    
    // Verify technical phase completion
    const technicalScore = await page.textContent('[data-testid="technical-phase-score"]');
    expect(parseInt(technicalScore!)).toBeGreaterThan(6);
    
    // 3. Transition to behavioral phase
    await handoffToNextAgent(page, session.id);
    
    // 4. Complete behavioral phase (10 minutes simulated)
    await completeInterviewPhase(page, session.id, 'behavioral', {
      questionsAnswered: 3,
      responses: behavioralResponses
    });
    
    // 5. Transition to system design phase
    await handoffToNextAgent(page, session.id);
    
    // 6. Complete system design phase
    await completeInterviewPhase(page, session.id, 'system-design', {
      questionsAnswered: 2,
      responses: systemDesignResponses
    });
    
    // 7. Complete final phase and get results
    const results = await completeInterview(page, session.id);
    
    // Validate results
    expect(results.summary.overallScore).toBeGreaterThan(7);
    expect(results.stageResults).toHaveLength(3);
    expect(results.feedback).toBeDefined();
    expect(results.feedback.recommendations).toBeDefined();
    expect(results.feedback.strengths.length).toBeGreaterThan(0);
    expect(results.feedback.improvementAreas).toBeDefined();
    
    // Check individual stage scores
    expect(results.stageResults.find(s => s.stage.id === 'technical')?.score).toBeGreaterThan(6);
    expect(results.stageResults.find(s => s.stage.id === 'behavioral')?.score).toBeGreaterThan(6);
    expect(results.stageResults.find(s => s.stage.id === 'industry')?.score).toBeGreaterThan(6);
  });

  test('should complete entry-level interview with appropriate complexity', async ({ page }) => {
    const session = await startMultiAgentInterview(page, {
      role: 'junior-developer',
      experienceLevel: 'entry',
      industry: 'tech',
      mode: 'text'
    });
    
    // Entry-level should have simpler questions and more guidance
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 4, // Fewer questions for entry level
      responses: [
        "I learned JavaScript and React during my bootcamp. I built a few small projects.",
        "I would start by researching the problem and looking at documentation.",
        "I'm still learning about best practices, but I try to write clean code.",
        "I haven't used many testing frameworks yet, but I'm eager to learn."
      ]
    });
    
    await handoffToNextAgent(page, session.id);
    
    await completeInterviewPhase(page, session.id, 'behavioral', {
      questionsAnswered: 2,
      responses: [
        "In school projects, I learned to communicate clearly and ask for help when needed.",
        "I'm excited about learning and growing in a supportive team environment."
      ]
    });
    
    const results = await completeInterview(page, session.id);
    
    // Entry-level expectations should be different
    expect(results.summary.overallScore).toBeGreaterThan(5); // Lower threshold
    expect(results.feedback.overallAssessment).toContain('potential'); // Should focus on growth potential
    expect(results.feedback.recommendations.nextSteps.length).toBeGreaterThan(0);
  });

  test('should complete voice-enabled interview with speech recognition', async ({ page }) => {
    // Grant microphone permissions
    await page.context().grantPermissions(['microphone']);
    
    const session = await startMultiAgentInterview(page, {
      role: 'software-engineer',
      experienceLevel: 'mid',
      industry: 'tech',
      mode: 'voice'
    });
    
    // Complete phases with voice responses
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 4,
      responses: technicalResponses.slice(0, 4),
      voiceEnabled: true
    });
    
    // Verify voice features are working
    const voiceIndicator = await page.isVisible('[data-testid="voice-active-indicator"]');
    expect(voiceIndicator).toBe(true);
    
    await handoffToNextAgent(page, session.id);
    
    await completeInterviewPhase(page, session.id, 'behavioral', {
      questionsAnswered: 3,
      responses: behavioralResponses,
      voiceEnabled: true
    });
    
    const results = await completeInterview(page, session.id);
    
    // Voice interviews should have additional metrics
    expect(results.analytics.metrics).toBeDefined();
    expect(results.analytics.metrics.communicationClarity).toBeGreaterThan(0.7);
    expect(results.analytics.metrics.confidenceLevel).toBeGreaterThan(0.8);
  });

  test('should handle finance industry interview with domain-specific questions', async ({ page }) => {
    const session = await startMultiAgentInterview(page, {
      role: 'quantitative-analyst',
      experienceLevel: 'senior',
      industry: 'finance',
      mode: 'text'
    });
    
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 4,
      responses: [
        "I have experience with Python, NumPy, and Pandas for financial modeling.",
        "I've built risk assessment models using Monte Carlo simulations.",
        "I understand derivative pricing using Black-Scholes and other models.",
        "I've worked with time series analysis for market prediction."
      ]
    });
    
    await handoffToNextAgent(page, session.id);
    
    await completeInterviewPhase(page, session.id, 'domain-knowledge', {
      questionsAnswered: 3,
      responses: [
        "VaR measures potential losses in a portfolio over a specific time period.",
        "I would stress test the model under various market scenarios.",
        "Regulatory compliance requires proper documentation and model validation."
      ]
    });
    
    const results = await completeInterview(page, session.id);
    
    // Finance-specific validations
    expect(results.stageResults.find(s => s.stage.id === 'industry')).toBeDefined();
    expect(results.feedback.roleFitAssessment.industryKnowledge).toBeGreaterThan(7);
  });

  test('should handle healthcare industry interview', async ({ page }) => {
    const session = await startMultiAgentInterview(page, {
      role: 'health-informatics-specialist',
      experienceLevel: 'mid',
      industry: 'healthcare',
      mode: 'text'
    });
    
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 4,
      responses: [
        "I have experience with FHIR standards and healthcare data interoperability.",
        "I've worked on EMR systems and understand HIPAA compliance requirements.",
        "I've implemented clinical decision support systems using machine learning.",
        "I understand medical coding systems like ICD-10 and CPT."
      ]
    });
    
    await handoffToNextAgent(page, session.id);
    
    await completeInterviewPhase(page, session.id, 'compliance', {
      questionsAnswered: 2,
      responses: [
        "HIPAA requires strict data protection and patient privacy measures.",
        "I ensure all healthcare data is encrypted and access is logged and monitored."
      ]
    });
    
    const results = await completeInterview(page, session.id);
    
    // Healthcare-specific validations
    expect(results.feedback.roleFitAssessment.industryKnowledge).toBeGreaterThan(8);
    expect(results.stageResults.find(s => s.stage.id === 'industry')).toBeDefined();
  });
});

test.describe('Error Recovery and Resilience', () => {
  test('should recover from network interruption during interview', async ({ page }) => {
    const session = await startMultiAgentInterview(page, {
      role: 'software-engineer',
      experienceLevel: 'mid',
      industry: 'tech',
      mode: 'text'
    });
    
    // Start technical phase
    await page.waitForSelector(`[data-testid="phase-technical-active"]`);
    
    // Answer first question
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 1,
      responses: [technicalResponses[0]]
    });
    
    // Simulate network interruption
    await simulateNetworkInterruption(page, 5000);
    
    // Verify recovery mechanism
    await page.waitForSelector('[data-testid="connection-restored"]');
    
    // Verify session state is preserved
    const currentPhase = await page.textContent('[data-testid="current-phase"]');
    expect(currentPhase).toBe('technical');
    
    // Continue with remaining questions
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 3,
      responses: technicalResponses.slice(1, 4)
    });
    
    const results = await completeInterview(page, session.id);
    expect(results.summary.overallScore).toBeGreaterThan(6);
  });

  test('should handle agent failure with graceful handoff to backup', async ({ page }) => {
    const session = await startMultiAgentInterview(page, {
      role: 'software-engineer',
      experienceLevel: 'senior',
      industry: 'tech',
      mode: 'text'
    });
    
    // Start technical phase
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 2,
      responses: technicalResponses.slice(0, 2)
    });
    
    // Simulate technical agent failure
    await simulateAgentFailure(page, 'technical');
    
    // Verify backup agent takes over
    await page.waitForSelector('[data-testid="backup-agent-active"]');
    const backupAgent = await page.textContent('[data-testid="current-agent"]');
    expect(backupAgent).toContain('backup');
    
    // Continue with backup agent
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 2,
      responses: technicalResponses.slice(2, 4)
    });
    
    await handoffToNextAgent(page, session.id);
    
    await completeInterviewPhase(page, session.id, 'behavioral', {
      questionsAnswered: 2,
      responses: behavioralResponses.slice(0, 2)
    });
    
    const results = await completeInterview(page, session.id);
    
    // Should complete successfully despite agent failure
    expect(results.summary.overallScore).toBeGreaterThan(6);
    expect(results.metadata.qualityScore).toBeGreaterThan(6);
  });

  test('should handle session timeout with save and resume capability', async ({ page }) => {
    const session = await startMultiAgentInterview(page, {
      role: 'software-engineer',
      experienceLevel: 'mid',
      industry: 'tech',
      mode: 'text'
    });
    
    // Complete part of technical phase
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 2,
      responses: technicalResponses.slice(0, 2)
    });
    
    // Simulate session timeout by navigating away
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    
    // Navigate back to resume interview
    await page.goto(`/interview/resume/${session.id}`);
    
    // Verify session can be resumed
    await page.waitForSelector('[data-testid="interview-resumed"]');
    const currentPhase = await page.textContent('[data-testid="current-phase"]');
    expect(currentPhase).toBe('technical');
    
    // Check progress is preserved
    const questionsAnswered = await page.textContent('[data-testid="questions-answered-count"]');
    expect(parseInt(questionsAnswered!)).toBe(2);
    
    // Continue from where left off
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 2,
      responses: technicalResponses.slice(2, 4)
    });
    
    await handoffToNextAgent(page, session.id);
    
    await completeInterviewPhase(page, session.id, 'behavioral', {
      questionsAnswered: 2,
      responses: behavioralResponses.slice(0, 2)
    });
    
    const results = await completeInterview(page, session.id);
    expect(results.summary.overallScore).toBeGreaterThan(6);
    expect(results.exports.reportAvailable).toBe(true);
  });

  test('should handle multiple concurrent error scenarios', async ({ page }) => {
    const session = await startMultiAgentInterview(page, {
      role: 'software-engineer',
      experienceLevel: 'senior',
      industry: 'tech',
      mode: 'voice'
    });
    
    // Start interview
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 1,
      responses: [technicalResponses[0]],
      voiceEnabled: true
    });
    
    // Simulate multiple issues at once
    await Promise.all([
      simulateNetworkInterruption(page, 3000),
      simulateAgentFailure(page, 'technical')
    ]);
    
    // System should recover gracefully
    await page.waitForSelector('[data-testid="system-recovered"]');
    
    // Continue interview
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 2,
      responses: technicalResponses.slice(1, 3),
      voiceEnabled: true
    });
    
    const results = await completeInterview(page, session.id);
    
    expect(results.summary.overallScore).toBeGreaterThan(5); // Lower threshold due to errors
    expect(results.metadata.qualityScore).toBeGreaterThan(0.7);
  });
});

test.describe('Performance Validation', () => {
  test('should complete interview within reasonable time limits', async ({ page }) => {
    const startTime = Date.now();
    
    const session = await startMultiAgentInterview(page, {
      role: 'software-engineer',
      experienceLevel: 'mid',
      industry: 'tech',
      mode: 'text'
    });
    
    // Complete full interview efficiently
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 4,
      responses: technicalResponses.slice(0, 4)
    });
    
    await handoffToNextAgent(page, session.id);
    
    await completeInterviewPhase(page, session.id, 'behavioral', {
      questionsAnswered: 3,
      responses: behavioralResponses
    });
    
    const results = await completeInterview(page, session.id);
    
    const totalTime = Date.now() - startTime;
    
    // Should complete within reasonable time (15 minutes max for E2E test)
    expect(totalTime).toBeLessThan(15 * 60 * 1000);
    
    // Performance metrics should be recorded
    expect(results.summary.totalDurationMinutes).toBeLessThan(totalTime / 60000);
    expect(results.analytics.metrics.averageResponseTime).toBeLessThan(30000); // 30s per response max
  });

  test('should handle high-frequency interactions without degradation', async ({ page }) => {
    const session = await startMultiAgentInterview(page, {
      role: 'software-engineer',
      experienceLevel: 'senior',
      industry: 'tech',
      mode: 'text'
    });
    
    // Rapid-fire responses to test system performance
    const rapidResponses = technicalResponses.concat(behavioralResponses);
    
    const responseTimeStart = Date.now();
    
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 5,
      responses: rapidResponses.slice(0, 5)
    });
    
    const phaseTime = Date.now() - responseTimeStart;
    
    // Should maintain performance under rapid interaction
    expect(phaseTime / 5).toBeLessThan(10000); // Less than 10s per question on average
    
    const results = await completeInterview(page, session.id);
    expect(results.summary.questionsAsked / results.summary.totalDurationMinutes).toBeGreaterThan(0.5); // Questions per minute
  });

  test('should maintain quality scores under time pressure', async ({ page }) => {
    const session = await startMultiAgentInterview(page, {
      role: 'senior-software-engineer',
      experienceLevel: 'senior',
      industry: 'tech',
      mode: 'text',
      duration: 20 // Shorter time limit
    });
    
    // Complete interview under time pressure
    await completeInterviewPhase(page, session.id, 'technical', {
      questionsAnswered: 3, // Fewer questions due to time pressure
      responses: technicalResponses.slice(0, 3)
    });
    
    await handoffToNextAgent(page, session.id);
    
    await completeInterviewPhase(page, session.id, 'behavioral', {
      questionsAnswered: 2,
      responses: behavioralResponses.slice(0, 2)
    });
    
    const results = await completeInterview(page, session.id);
    
    // Should maintain quality despite time pressure
    expect(results.summary.overallScore).toBeGreaterThan(6);
    expect(results.analytics.metrics.communicationClarity).toBeGreaterThan(0.7);
    expect(results.feedback.roleFitAssessment.technicalFit).toBeGreaterThan(80);
  });
});
