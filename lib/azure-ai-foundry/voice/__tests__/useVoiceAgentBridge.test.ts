/**
 * Unit Tests for useVoiceAgentBridge Hook
 * 
 * Tests voice session lifecycle, state transitions, event handling,
 * error recovery, metrics collection, and integration with agent state.
 */

import { renderHook, act } from '@testing-library/react';
import { useVoiceAgentBridge, UseVoiceAgentBridgeConfig } from '../useVoiceAgentBridge';
import { voiceInsights } from '../voice-insights';
import { voiceTelemetry } from '../voice-telemetry';
import { VoiceSession } from '../voice-session';
import { VoiceAgentBridge } from '../voice-agent-bridge';
import * as errorUtils from '@/lib/utils/error-utils';

// Mock dependencies
jest.mock('../voice-insights');
jest.mock('../voice-telemetry');
jest.mock('../voice-session');
jest.mock('../voice-agent-bridge');
jest.mock('@/lib/utils/error-utils');
jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    audio: {
      record: jest.fn()
    }
  }
}));

// Mock fetch
global.fetch = jest.fn();

// Mock WebSocket for browser environment
Object.defineProperty(window, 'WebSocket', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    send: jest.fn(),
    readyState: 1,
    OPEN: 1,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
});

describe('useVoiceAgentBridge Hook', () => {
  // Default configuration for tests
  const defaultConfig: UseVoiceAgentBridgeConfig = {
    userName: 'Test User',
    userId: 'user-123',
    interviewId: 'interview-456',
    feedbackId: 'feedback-789',
    type: 'technical',
    questions: ['Tell me about yourself', 'What are your strengths?'],
    resumeQuestions: ['Describe your React experience'],
    voiceSettings: {
      voice: 'en-US-AriaNeural',
      language: 'en-US',
      temperature: 0.7,
      maxTokens: 4096
    },
    bridgeConfig: {
      sessionTimeout: 1800000,
      maxRetries: 3,
      errorRecoveryMode: 'graceful' as const,
      sentimentMonitoring: true,
      recordingEnabled: true,
      transcriptStorage: 'both' as const
    }
  };

  // Mock instances
  let mockVoiceSession: jest.Mocked<VoiceSession>;
  let mockVoiceAgentBridge: jest.Mocked<VoiceAgentBridge>;
  let mockVoiceInsights: jest.Mocked<typeof voiceInsights>;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mocks
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockVoiceInsights = voiceInsights as jest.Mocked<typeof voiceInsights>;
    
    // Mock VoiceSession
    mockVoiceSession = {
      sessionId: 'session-123',
      isActive: false,
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      configuration: {},
      getMetrics: jest.fn().mockReturnValue({}),
      isConnected: jest.fn().mockReturnValue(false),
      dispose: jest.fn(),
      onSessionReady: null,
      onTranscript: null,
      onAudioResponse: null,
      onTextResponse: null,
      onError: null,
      onDisconnect: null
    } as any;

    // Mock VoiceAgentBridge  
    mockVoiceAgentBridge = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      handoffToAgent: jest.fn().mockResolvedValue(undefined),
      sendAudioResponse: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      getState: jest.fn().mockReturnValue({
        currentAgent: null,
        sessionActive: false,
        lastActivity: Date.now(),
        pendingHandoff: false,
        errorCount: 0,
        recovery: {
          inProgress: false,
          attempts: 0,
          lastAttempt: 0
        }
      })
    } as any;

    // Setup constructor mocks
    (VoiceSession as jest.MockedClass<typeof VoiceSession>).mockImplementation(() => mockVoiceSession);
    (VoiceAgentBridge as jest.MockedClass<typeof VoiceAgentBridge>).mockImplementation(() => mockVoiceAgentBridge);

    // Mock API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        sessionId: 'session-123',
        wsUrl: 'wss://test.com/ws',
        token: 'test-token',
        deploymentId: 'gpt-4o-realtime-preview'
      })
    } as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Hook Initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      expect(result.current.voiceBridge.connectionState).toBe('idle');
      expect(result.current.voiceBridge.bridge).toBeNull();
      expect(result.current.voiceBridge.voiceSession).toBeNull();
      expect(result.current.voiceBridge.sessionId).toBeNull();
      expect(result.current.voiceBridge.lastError).toBeNull();
      expect(result.current.voiceBridge.retryCount).toBe(0);
      expect(result.current.voiceBridge.isInitializing).toBe(false);
    });

    it('should set user context on initialization', () => {
      renderHook(() => useVoiceAgentBridge(defaultConfig));

      expect(mockVoiceInsights.setUser).toHaveBeenCalledWith(
        defaultConfig.userId,
        defaultConfig.interviewId
      );
    });

    it('should clear user context on unmount', () => {
      const { unmount } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      unmount();

      expect(mockVoiceInsights.clearUser).toHaveBeenCalled();
    });
  });

  describe('Voice Session Lifecycle', () => {
    it('should successfully start voice session', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      await act(async () => {
        await result.current.startVoiceSession();
      });

      // Check API call was made
      expect(mockFetch).toHaveBeenCalledWith('/api/voice/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('en-US-AriaNeural')
      });

      // Check VoiceSession was created
      expect(VoiceSession).toHaveBeenCalledWith(expect.objectContaining({
        endpoint: 'wss://test.com/ws',
        apiKey: 'test-token',
        deploymentId: 'gpt-4o-realtime-preview',
        voice: 'en-US-AriaNeural'
      }));

      // Check bridge was started
      expect(mockVoiceAgentBridge.start).toHaveBeenCalled();

      // Check state updates
      expect(result.current.voiceBridge.connectionState).toBe('connected');
      expect(result.current.voiceBridge.sessionId).toBe('session-123');
      expect(result.current.isInterviewActive).toBe(true);

      // Check telemetry was tracked
      expect(mockVoiceInsights.trackVoiceSession).toHaveBeenCalledWith(
        'session_created',
        expect.objectContaining({
          sessionId: 'session-123',
          userId: 'user-123',
          interviewType: 'technical',
          connectionState: 'connecting'
        })
      );
    });

    it('should handle session creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'API Error' })
      } as any);

      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      await act(async () => {
        try {
          await result.current.startVoiceSession();
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.voiceBridge.connectionState).toBe('error');
      expect(result.current.voiceBridge.lastError).toBe('API Error');
    });

    it('should successfully stop voice session', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      // Start session first
      await act(async () => {
        await result.current.startVoiceSession();
      });

      // Stop session
      await act(async () => {
        await result.current.stopVoiceSession();
      });

      expect(mockVoiceAgentBridge.stop).toHaveBeenCalled();
      expect(mockVoiceSession.stop).toHaveBeenCalled();
      expect(result.current.voiceBridge.connectionState).toBe('idle');
      expect(result.current.isInterviewActive).toBe(false);
      expect(mockVoiceInsights.flush).toHaveBeenCalled();
    });

    it('should prevent concurrent session initialization', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      // Start two sessions concurrently
      const promise1 = act(async () => {
        await result.current.startVoiceSession();
      });

      const promise2 = act(async () => {
        await result.current.startVoiceSession();
      });

      await Promise.all([promise1, promise2]);

      // Should only create one session
      expect(VoiceSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle session errors gracefully', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      // Start session
      await act(async () => {
        await result.current.startVoiceSession();
      });

      // Simulate session error via bridge event handler
      const sessionErrorHandler = mockVoiceAgentBridge.on.mock.calls.find(
        call => call[0] === 'session:error'
      )?.[1];

      if (sessionErrorHandler) {
        act(() => {
          sessionErrorHandler({
            sessionId: 'session-123',
            error: new Error('Connection lost')
          });
        });

        expect(result.current.voiceBridge.connectionState).toBe('error');
        expect(result.current.voiceBridge.lastError).toBe('Connection lost');
        expect(mockVoiceInsights.trackVoiceError).toHaveBeenCalledWith({
          sessionId: 'session-123',
          errorType: 'bridge',
          errorMessage: 'Connection lost',
          errorCode: 'Error',
          isRecoverable: true,
          stackTrace: expect.any(String),
          context: {
            userId: 'user-123',
            interviewType: 'technical'
          }
        });
      }
    });

    it('should retry connection with exponential backoff', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      // Mock session creation to fail first time
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          json: jest.fn().mockResolvedValue({ error: 'Network error' })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            sessionId: 'session-retry-123',
            wsUrl: 'wss://test.com/ws',
            token: 'test-token'
          })
        } as any);

      // Initial attempt should fail
      await act(async () => {
        try {
          await result.current.startVoiceSession();
        } catch (error) {
          // Expected failure
        }
      });

      expect(result.current.voiceBridge.connectionState).toBe('error');

      // Retry should succeed
      await act(async () => {
        await result.current.retryConnection();
      });

      expect(result.current.voiceBridge.retryCount).toBe(1);
      expect(result.current.voiceBridge.connectionState).toBe('connected');
    });

    it('should track retry failures in telemetry', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      // Mock persistent failure
      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Persistent error' })
      } as any);

      await act(async () => {
        try {
          await result.current.retryConnection();
        } catch (error) {
          // Expected failure
        }
      });

      expect(mockVoiceInsights.trackVoiceError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: 'connection',
          errorMessage: 'Retry failed',
          isRecoverable: true
        })
      );
    });
  });

  describe('Recording Controls', () => {
    beforeEach(async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));
      
      await act(async () => {
        await result.current.startVoiceSession();
      });

      return { result };
    });

    it('should start recording when voice is connected', () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      act(() => {
        result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);
      expect(mockVoiceInsights.trackVoiceEvent).toHaveBeenCalledWith(
        'recording_started',
        {
          sessionId: 'session-123',
          userId: 'user-123'
        }
      );
    });

    it('should stop recording and track event', () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      // Start recording first
      act(() => {
        result.current.startRecording();
      });

      // Stop recording
      act(() => {
        result.current.stopRecording();
      });

      expect(result.current.isRecording).toBe(false);
      expect(mockVoiceInsights.trackVoiceEvent).toHaveBeenCalledWith(
        'recording_stopped',
        {
          sessionId: 'session-123',
          userId: 'user-123'
        }
      );
    });

    it('should prevent recording when not connected', () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));
      
      // Without starting session, recording should not work
      act(() => {
        result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(false);
    });
  });

  describe('Agent Controls', () => {
    it('should handle agent handoff', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      await act(async () => {
        await result.current.startVoiceSession();
      });

      await act(async () => {
        await result.current.handoffToAgent('technical-interviewer', { context: 'data' });
      });

      expect(mockVoiceAgentBridge.handoffToAgent).toHaveBeenCalledWith(
        'technical-interviewer',
        { context: 'data' }
      );

      expect(mockVoiceInsights.trackVoiceUsage).toHaveBeenCalledWith({
        sessionId: 'session-123',
        userId: 'user-123',
        featureUsed: 'agent_handoff',
        interactionCount: 1,
        duration: 0
      });
    });

    it('should send response through bridge', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      await act(async () => {
        await result.current.startVoiceSession();
      });

      await act(async () => {
        await result.current.sendResponse('Hello, how are you?', 'audio-data');
      });

      expect(mockVoiceAgentBridge.sendAudioResponse).toHaveBeenCalledWith(
        'Hello, how are you?',
        'audio-data'
      );
    });
  });

  describe('Event Handling', () => {
    it('should handle transcript events', async () => {
      const mockOnTranscriptReceived = jest.fn();
      const configWithCallbacks = {
        ...defaultConfig,
        onTranscriptReceived: mockOnTranscriptReceived
      };

      const { result } = renderHook(() => useVoiceAgentBridge(configWithCallbacks));

      await act(async () => {
        await result.current.startVoiceSession();
      });

      // Simulate transcript event
      const transcriptHandler = mockVoiceAgentBridge.on.mock.calls.find(
        call => call[0] === 'transcript:final'
      )?.[1];

      if (transcriptHandler) {
        const mockTranscriptEntry = {
          id: 'transcript-1',
          timestamp: Date.now(),
          speaker: 'user' as const,
          text: 'Hello, I am a software developer',
          confidence: 0.95
        };

        act(() => {
          transcriptHandler({
            sessionId: 'session-123',
            entry: mockTranscriptEntry
          });
        });

        expect(mockOnTranscriptReceived).toHaveBeenCalledWith(mockTranscriptEntry);
        expect(result.current.state.hasUserSpoken).toBe(true);
        expect(result.current.isProcessing).toBe(true);
      }
    });

    it('should handle sentiment analysis events', async () => {
      const mockOnSentimentAnalysis = jest.fn();
      const configWithCallbacks = {
        ...defaultConfig,
        onSentimentAnalysis: mockOnSentimentAnalysis
      };

      const { result } = renderHook(() => useVoiceAgentBridge(configWithCallbacks));

      await act(async () => {
        await result.current.startVoiceSession();
      });

      // Simulate sentiment analysis event
      const sentimentHandler = mockVoiceAgentBridge.on.mock.calls.find(
        call => call[0] === 'sentiment:analysis'
      )?.[1];

      if (sentimentHandler) {
        const mockSentiment = {
          score: 0.7,
          magnitude: 0.8,
          label: 'positive' as const,
          confidence: 0.9,
          stressIndicators: {
            hasHighStressWords: false,
            stressWords: [],
            speechPattern: 'normal' as const,
            emotionalState: 'calm' as const
          }
        };

        act(() => {
          sentimentHandler({
            sessionId: 'session-123',
            sentiment: mockSentiment
          });
        });

        expect(mockOnSentimentAnalysis).toHaveBeenCalledWith(mockSentiment);
        expect(result.current.sessionMetrics?.transcriptionAccuracy).toBe(0.9);
      }
    });
  });

  describe('Metrics and Telemetry', () => {
    it('should track session metrics', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      await act(async () => {
        await result.current.startVoiceSession();
      });

      // Simulate metrics update via sentiment analysis
      const sentimentHandler = mockVoiceAgentBridge.on.mock.calls.find(
        call => call[0] === 'sentiment:analysis'
      )?.[1];

      if (sentimentHandler) {
        act(() => {
          sentimentHandler({
            sessionId: 'session-123',
            sentiment: {
              confidence: 0.85,
              score: 0.6,
              magnitude: 0.7,
              label: 'positive',
              stressIndicators: {
                hasHighStressWords: false,
                stressWords: [],
                speechPattern: 'normal',
                emotionalState: 'calm'
              }
            }
          });
        });

        expect(mockVoiceInsights.trackVoiceMetric).toHaveBeenCalledWith({
          sessionId: 'session-123',
          metricName: 'transcript_accuracy',
          value: 0.85,
          unit: 'percentage',
          timestamp: expect.any(Number)
        });
      }
    });

    it('should track usage analytics', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      await act(async () => {
        await result.current.startVoiceSession();
      });

      expect(mockVoiceInsights.trackVoiceUsage).toHaveBeenCalledWith({
        sessionId: 'session-123',
        userId: 'user-123',
        featureUsed: 'voice_interview',
        interactionCount: 1,
        duration: 0
      });
    });
  });

  describe('State Selectors', () => {
    it('should provide correct state selectors', () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      // Initially all should be false/idle
      expect(result.current.isRecording).toBe(false);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.isWaiting).toBe(false);
      expect(result.current.isInterviewActive).toBe(false);
      expect(result.current.isInterviewFinished).toBe(false);
      expect(result.current.shouldShowFeedback).toBe(false);
      expect(result.current.isVoiceConnected).toBe(false);
      expect(result.current.canStartRecording).toBe(false);
    });

    it('should update state selectors based on voice connection', async () => {
      const { result } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      await act(async () => {
        await result.current.startVoiceSession();
      });

      expect(result.current.isVoiceConnected).toBe(true);
      expect(result.current.isInterviewActive).toBe(true);
      expect(result.current.canStartRecording).toBe(true);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources on unmount', () => {
      const { unmount } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      unmount();

      expect(mockVoiceInsights.clearUser).toHaveBeenCalled();
      // Additional cleanup assertions would go here
    });

    it('should handle cleanup errors gracefully', () => {
      mockVoiceAgentBridge.stop.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      const { unmount } = renderHook(() => useVoiceAgentBridge(defaultConfig));

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Configuration Updates', () => {
    it('should handle configuration updates', () => {
      const { result, rerender } = renderHook(
        ({ config }) => useVoiceAgentBridge(config),
        { initialProps: { config: defaultConfig } }
      );

      const updatedConfig = {
        ...defaultConfig,
        userId: 'new-user-456'
      };

      rerender({ config: updatedConfig });

      expect(mockVoiceInsights.setUser).toHaveBeenCalledWith('new-user-456', 'interview-456');
    });
  });
});
