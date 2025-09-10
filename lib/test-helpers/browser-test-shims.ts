/**
 * Browser-side helper functions for E2E testing
 * These functions are injected into the browser context during tests
 * to simulate various scenarios and provide access to internal state
 */

declare global {
  interface Window {
    // Test helpers
    simulateVoiceTranscript?: (transcript: string, isFinal?: boolean) => void;
    simulateAgentFailure?: (agentType: string) => void;
    simulateNetworkFailure?: () => void;
    restoreNetwork?: () => void;
    
    // State exposure for tests
    interviewSession?: any;
    interviewResults?: any;
    
    // Test utilities
    __BROWSER_TEST_HELPERS__?: {
      voiceSession?: any;
      networkStatus?: 'online' | 'offline';
      agentStates?: Record<string, any>;
    };
  }
}

/**
 * Initialize test helpers in the browser context
 * Call this from your app's root component when in test mode
 */
export function initializeBrowserTestShims() {
  if (typeof window === 'undefined' || !isTestEnvironment()) {
    return;
  }

  // Initialize test helpers container
  window.__BROWSER_TEST_HELPERS__ = {
    networkStatus: 'online',
    agentStates: {},
  };

  // Voice transcript simulation
  window.simulateVoiceTranscript = (transcript: string, isFinal = true) => {
    const voiceSession = window.__BROWSER_TEST_HELPERS__?.voiceSession;
    if (voiceSession && typeof voiceSession.onTranscriptReceived === 'function') {
      voiceSession.onTranscriptReceived({
        transcript,
        isFinal,
        confidence: 0.95,
        timestamp: Date.now(),
      });
    } else {
      // Fallback: dispatch custom event
      window.dispatchEvent(new CustomEvent('test:voice-transcript', {
        detail: { transcript, isFinal }
      }));
    }
  };

  // Agent failure simulation
  window.simulateAgentFailure = (agentType: string) => {
    if (window.__BROWSER_TEST_HELPERS__?.agentStates) {
      window.__BROWSER_TEST_HELPERS__.agentStates[agentType] = 'failed';
    }
    
    window.dispatchEvent(new CustomEvent('test:agent-failure', {
      detail: { agentType, timestamp: Date.now() }
    }));
  };

  // Network failure simulation
  window.simulateNetworkFailure = () => {
    if (window.__BROWSER_TEST_HELPERS__) {
      window.__BROWSER_TEST_HELPERS__.networkStatus = 'offline';
    }
    
    // Mock fetch to return network errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      throw new Error('Network request failed (simulated)');
    };
    
    // Store original fetch for restoration
    (window as any).__originalFetch = originalFetch;
    
    window.dispatchEvent(new CustomEvent('test:network-offline'));
  };

  // Network restoration
  window.restoreNetwork = () => {
    if (window.__BROWSER_TEST_HELPERS__) {
      window.__BROWSER_TEST_HELPERS__.networkStatus = 'online';
    }
    
    // Restore original fetch
    if ((window as any).__originalFetch) {
      window.fetch = (window as any).__originalFetch;
      delete (window as any).__originalFetch;
    }
    
    window.dispatchEvent(new CustomEvent('test:network-online'));
  };

  console.log('[Test Shims] Browser test helpers initialized');
}

/**
 * Update interview session reference for test access
 */
export function exposeInterviewSession(session: any) {
  if (typeof window !== 'undefined' && isTestEnvironment()) {
    window.interviewSession = session;
  }
}

/**
 * Update interview results reference for test access
 */
export function exposeInterviewResults(results: any) {
  if (typeof window !== 'undefined' && isTestEnvironment()) {
    window.interviewResults = results;
  }
}

/**
 * Set voice session reference for voice transcript simulation
 */
export function exposeVoiceSession(voiceSession: any) {
  if (typeof window !== 'undefined' && isTestEnvironment() && window.__BROWSER_TEST_HELPERS__) {
    window.__BROWSER_TEST_HELPERS__.voiceSession = voiceSession;
  }
}

/**
 * Check if we're in a test environment
 */
function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.NEXT_PUBLIC_TESTING === 'true' ||
    typeof window !== 'undefined' && window.location.search.includes('test=true')
  );
}

/**
 * Wait for interview phase completion
 * Useful for E2E tests to know when a phase is done
 */
export function waitForPhaseCompletion(phaseName: string, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Phase ${phaseName} did not complete within ${timeoutMs}ms`));
    }, timeoutMs);

    const handler = (event: CustomEvent) => {
      if (event.detail.phase === phaseName) {
        clearTimeout(timeout);
        window.removeEventListener('test:phase-complete', handler as EventListener);
        resolve();
      }
    };

    window.addEventListener('test:phase-complete', handler as EventListener);
  });
}

/**
 * Emit phase completion event (call from your interview components)
 */
export function emitPhaseCompletion(phaseName: string, results?: any) {
  if (typeof window !== 'undefined' && isTestEnvironment()) {
    window.dispatchEvent(new CustomEvent('test:phase-complete', {
      detail: { phase: phaseName, results, timestamp: Date.now() }
    }));
  }
}
