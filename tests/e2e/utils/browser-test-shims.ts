/**
 * Browser-side test shims for Playwright E2E tests
 * These functions are exposed to the browser context during testing
 */

export interface InterviewSessionState {
  currentPhase: 'technical' | 'behavioral' | 'industry' | 'completed' | 'idle';
  activeAgent: string;
  transcript: string[];
  responses: Array<{ question: string; answer: string; timestamp: number }>;
  startTime?: number;
  errors: string[];
  isVoiceMode: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

export interface InterviewResults {
  totalDuration: number;
  questionsAsked: number;
  responsesGiven: number;
  phasesCompleted: string[];
  finalScore?: number;
  feedback: string;
  handoffCount: number;
}

// Global state for testing
declare global {
  interface Window {
    __TEST_INTERVIEW_SESSION__: InterviewSessionState;
    __TEST_INTERVIEW_RESULTS__: InterviewResults;
    __TEST_HELPERS__: {
      simulateVoiceTranscript: (text: string) => void;
      simulateNetworkInterruption: (duration: number) => void;
      simulateAgentFailure: (agentType: string) => void;
      triggerSessionTimeout: () => void;
      forceHandoff: (toAgent: string) => void;
      injectLatency: (ms: number) => void;
    };
  }
}

/**
 * Simulate voice transcript input during voice interviews
 */
export function simulateVoiceTranscript(text: string): void {
  if (typeof window === 'undefined') return;
  
  // Dispatch synthetic voice recognition event
  const event = new CustomEvent('test:voice-transcript', {
    detail: { transcript: text, confidence: 0.95 }
  });
  document.dispatchEvent(event);
  
  // Update session state
  if (window.__TEST_INTERVIEW_SESSION__) {
    window.__TEST_INTERVIEW_SESSION__.transcript.push(`User: ${text}`);
  }
}

/**
 * Simulate network interruption for resilience testing
 */
export function simulateNetworkInterruption(duration: number = 3000): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('test:network-interruption', {
    detail: { duration }
  });
  document.dispatchEvent(event);
  
  // Update connection status
  if (window.__TEST_INTERVIEW_SESSION__) {
    window.__TEST_INTERVIEW_SESSION__.connectionStatus = 'disconnected';
    setTimeout(() => {
      if (window.__TEST_INTERVIEW_SESSION__) {
        window.__TEST_INTERVIEW_SESSION__.connectionStatus = 'reconnecting';
      }
    }, duration / 2);
    
    setTimeout(() => {
      if (window.__TEST_INTERVIEW_SESSION__) {
        window.__TEST_INTERVIEW_SESSION__.connectionStatus = 'connected';
      }
    }, duration);
  }
}

/**
 * Simulate agent failure for error recovery testing
 */
export function simulateAgentFailure(agentType: string): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('test:agent-failure', {
    detail: { agentType, error: 'Simulated agent failure for testing' }
  });
  document.dispatchEvent(event);
  
  // Update session state
  if (window.__TEST_INTERVIEW_SESSION__) {
    window.__TEST_INTERVIEW_SESSION__.errors.push(`Agent failure: ${agentType}`);
  }
}

/**
 * Trigger session timeout for timeout handling tests
 */
export function triggerSessionTimeout(): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('test:session-timeout', {
    detail: { reason: 'Simulated timeout for testing' }
  });
  document.dispatchEvent(event);
}

/**
 * Force agent handoff for handoff testing
 */
export function forceHandoff(toAgent: string): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('test:force-handoff', {
    detail: { toAgent }
  });
  document.dispatchEvent(event);
  
  // Update session state
  if (window.__TEST_INTERVIEW_SESSION__) {
    window.__TEST_INTERVIEW_SESSION__.activeAgent = toAgent;
  }
}

/**
 * Inject artificial latency for performance testing
 */
export function injectLatency(ms: number): void {
  if (typeof window === 'undefined') return;
  
  const event = new CustomEvent('test:inject-latency', {
    detail: { latency: ms }
  });
  document.dispatchEvent(event);
}

/**
 * Expose interview session state for testing
 */
export function exposeInterviewSession(state: Partial<InterviewSessionState>): void {
  if (typeof window === 'undefined') return;
  
  window.__TEST_INTERVIEW_SESSION__ = {
    currentPhase: 'idle',
    activeAgent: 'none',
    transcript: [],
    responses: [],
    errors: [],
    isVoiceMode: false,
    connectionStatus: 'connected',
    ...state
  };
}

/**
 * Expose interview results for testing
 */
export function exposeInterviewResults(results: Partial<InterviewResults>): void {
  if (typeof window === 'undefined') return;
  
  window.__TEST_INTERVIEW_RESULTS__ = {
    totalDuration: 0,
    questionsAsked: 0,
    responsesGiven: 0,
    phasesCompleted: [],
    feedback: '',
    handoffCount: 0,
    ...results
  };
}

/**
 * Initialize test helpers on window object
 */
export function initializeTestHelpers(): void {
  if (typeof window === 'undefined') return;
  
  window.__TEST_HELPERS__ = {
    simulateVoiceTranscript,
    simulateNetworkInterruption,
    simulateAgentFailure,
    triggerSessionTimeout,
    forceHandoff,
    injectLatency
  };
  
  // Initialize empty state
  exposeInterviewSession({});
  exposeInterviewResults({});
}

// Auto-initialize if in test environment
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'test') {
  initializeTestHelpers();
}
