'use client';

import { useEffect } from 'react';
import { 
  initializeBrowserTestShims,
  exposeInterviewSession,
  exposeInterviewResults,
  exposeVoiceSession 
} from './browser-test-shims';

/**
 * Component to initialize test helpers in the browser
 * Add this to your root layout or main app component when in test mode
 */
export function TestHelperInitializer() {
  useEffect(() => {
    initializeBrowserTestShims();
  }, []);

  return null; // This component doesn't render anything
}

/**
 * Hook to expose interview state to tests
 */
export function useTestStateExposure(
  interviewSession?: any,
  interviewResults?: any,
  voiceSession?: any
) {
  useEffect(() => {
    if (interviewSession) {
      exposeInterviewSession(interviewSession);
    }
  }, [interviewSession]);

  useEffect(() => {
    if (interviewResults) {
      exposeInterviewResults(interviewResults);
    }
  }, [interviewResults]);

  useEffect(() => {
    if (voiceSession) {
      exposeVoiceSession(voiceSession);
    }
  }, [voiceSession]);
}

/**
 * Higher-order component to automatically expose state for testing
 */
export function withTestHelpers<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  options: {
    exposeInterviewSession?: boolean;
    exposeVoiceSession?: boolean;
    exposeResults?: boolean;
  } = {}
) {
  const TestEnabledComponent = (props: T) => {
    // Initialize test helpers
    useEffect(() => {
      initializeBrowserTestShims();
    }, []);

    return <WrappedComponent {...props} />;
  };

  TestEnabledComponent.displayName = `withTestHelpers(${WrappedComponent.displayName || WrappedComponent.name})`;
  return TestEnabledComponent;
}
