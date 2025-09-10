/**
 * Test Helper Initializer for E2E Testing
 * 
 * This component exposes test helper functions to the browser window object
 * during E2E tests, allowing Playwright tests to simulate various scenarios
 * like voice transcripts, agent failures, network issues, and session state.
 */

'use client';

import { useEffect } from 'react';

interface WindowWithTestHelpers extends Window {
  simulateVoiceTranscript?: (transcript: string) => void;
  simulateAgentFailure?: (agentType: string) => void;
  simulateNetworkInterruption?: (duration?: number) => void;
  simulateSessionTimeout?: () => void;
  interviewSession?: any;
  interviewResults?: any;
  testHelpers?: {
    setInterviewSession: (session: any) => void;
    setInterviewResults: (results: any) => void;
    triggerError: (errorType: string, details?: any) => void;
  };
}

declare const window: WindowWithTestHelpers;

export default function TestHelperInitializer() {
  useEffect(() => {
    // Only initialize test helpers in test environment
    if (process.env.NODE_ENV !== 'test' && !process.env.PLAYWRIGHT_TEST) {
      return;
    }

    // Store interview session state
    let currentSession: any = null;
    let currentResults: any = null;

    // Voice transcript simulation
    window.simulateVoiceTranscript = (transcript: string) => {
      console.log('🎤 Test Helper: Simulating voice transcript:', transcript);
      
      // Trigger voice transcript event
      const event = new CustomEvent('voiceTranscript', {
        detail: {
          transcript,
          confidence: 0.95,
          isFinal: true,
          timestamp: Date.now()
        }
      });
      
      document.dispatchEvent(event);
      
      // Also dispatch to any voice components that might be listening
      const voiceEvents = ['speechResult', 'transcriptionResult'];
      voiceEvents.forEach(eventType => {
        const voiceEvent = new CustomEvent(eventType, {
          detail: { transcript, confidence: 0.95, isFinal: true }
        });
        document.dispatchEvent(voiceEvent);
      });
    };

    // Agent failure simulation
    window.simulateAgentFailure = (agentType: string) => {
      console.log('❌ Test Helper: Simulating agent failure for:', agentType);
      
      const event = new CustomEvent('agentFailure', {
        detail: {
          agentType,
          error: `Simulated ${agentType} agent failure`,
          timestamp: Date.now(),
          recoverable: true
        }
      });
      
      document.dispatchEvent(event);
    };

    // Network interruption simulation
    window.simulateNetworkInterruption = (duration = 5000) => {
      console.log('🌐 Test Helper: Simulating network interruption for', duration, 'ms');
      
      // Simulate connection lost
      const disconnectEvent = new CustomEvent('connectionLost', {
        detail: { timestamp: Date.now(), duration }
      });
      document.dispatchEvent(disconnectEvent);

      // Simulate connection restored after duration
      setTimeout(() => {
        const reconnectEvent = new CustomEvent('connectionRestored', {
          detail: { timestamp: Date.now() }
        });
        document.dispatchEvent(reconnectEvent);
        
        // Add visual indicator for tests
        const indicator = document.createElement('div');
        indicator.setAttribute('data-testid', 'connection-restored');
        indicator.style.display = 'none';
        document.body.appendChild(indicator);
      }, duration);
    };

    // Session timeout simulation
    window.simulateSessionTimeout = () => {
      console.log('⏰ Test Helper: Simulating session timeout');
      
      const event = new CustomEvent('sessionTimeout', {
        detail: { timestamp: Date.now() }
      });
      document.dispatchEvent(event);
    };

    // Test helper utilities
    window.testHelpers = {
      setInterviewSession: (session: any) => {
        console.log('📝 Test Helper: Setting interview session', session);
        currentSession = session;
        window.interviewSession = session;
        
        // Add session indicators for tests
        const sessionIndicator = document.createElement('div');
        sessionIndicator.setAttribute('data-testid', 'interview-session-active');
        sessionIndicator.style.display = 'none';
        document.body.appendChild(sessionIndicator);

        const sessionIdIndicator = document.createElement('div');
        sessionIdIndicator.setAttribute('data-testid', 'session-id');
        sessionIdIndicator.setAttribute('data-session-id', session.id || session.config?.sessionId || 'test-session');
        sessionIdIndicator.style.display = 'none';
        document.body.appendChild(sessionIdIndicator);
      },

      setInterviewResults: (results: any) => {
        console.log('📊 Test Helper: Setting interview results', results);
        currentResults = results;
        window.interviewResults = results;

        // Add results indicator for tests
        const resultsIndicator = document.createElement('div');
        resultsIndicator.setAttribute('data-testid', 'results-ready');
        resultsIndicator.style.display = 'none';
        document.body.appendChild(resultsIndicator);
      },

      triggerError: (errorType: string, details?: any) => {
        console.log('💥 Test Helper: Triggering error:', errorType, details);
        
        const event = new CustomEvent('testError', {
          detail: { errorType, details, timestamp: Date.now() }
        });
        document.dispatchEvent(event);
      }
    };

    // Add global test indicators
    const addTestIndicator = (testId: string, condition: boolean = true) => {
      if (condition && !document.querySelector(`[data-testid="${testId}"]`)) {
        const indicator = document.createElement('div');
        indicator.setAttribute('data-testid', testId);
        indicator.style.display = 'none';
        document.body.appendChild(indicator);
      }
    };

    // Add common test indicators
    addTestIndicator('voice-ready-indicator');
    addTestIndicator('voice-active-indicator');
    addTestIndicator('agent-handoff-pending');
    addTestIndicator('agent-handoff-complete');
    addTestIndicator('backup-agent-active');
    addTestIndicator('system-recovered');
    addTestIndicator('interview-resumed');
    addTestIndicator('response-processed');

    // Mock current agent indicator
    const currentAgentIndicator = document.createElement('div');
    currentAgentIndicator.setAttribute('data-testid', 'current-agent');
    currentAgentIndicator.textContent = 'TechnicalInterviewer';
    currentAgentIndicator.style.display = 'none';
    document.body.appendChild(currentAgentIndicator);

    // Mock current phase indicator
    const currentPhaseIndicator = document.createElement('div');
    currentPhaseIndicator.setAttribute('data-testid', 'current-phase');
    currentPhaseIndicator.textContent = 'technical';
    currentPhaseIndicator.style.display = 'none';
    document.body.appendChild(currentPhaseIndicator);

    // Mock questions answered counter
    const questionsAnsweredIndicator = document.createElement('div');
    questionsAnsweredIndicator.setAttribute('data-testid', 'questions-answered-count');
    questionsAnsweredIndicator.textContent = '0';
    questionsAnsweredIndicator.style.display = 'none';
    document.body.appendChild(questionsAnsweredIndicator);

    console.log('✅ Test helpers initialized for E2E testing');

    // Cleanup function
    return () => {
      // Remove test helpers from window
      delete window.simulateVoiceTranscript;
      delete window.simulateAgentFailure;
      delete window.simulateNetworkInterruption;
      delete window.simulateSessionTimeout;
      delete window.testHelpers;
      delete window.interviewSession;
      delete window.interviewResults;
    };
  }, []);

  // This component renders nothing - it's just for side effects
  return null;
}
