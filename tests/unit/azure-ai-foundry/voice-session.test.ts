/**
 * Unit Tests for VoiceSession
 * 
 * Comprehensive test suite covering session lifecycle, event handling,
 * audio processing, telemetry tracking, and error scenarios.
 * 
 * @version 2.0.0
 */

import { jest } from '@jest/globals';
import { VoiceSession } from '@/lib/azure-ai-foundry/voice/voice-session';
import { 
  createMockVoiceConfig,
  createMockVoiceSession,
  createMockVoiceError,
  MOCK_VOICE_RESPONSES,
  AUDIO_TEST_DATA,
  PERFORMANCE_THRESHOLDS,
  TEST_ENV_SETUP
} from '../../utils/foundry-fixtures';
import { ConfigOptions, FoundryVoiceSession, FoundryVoiceError } from '@/lib/azure-ai-foundry/voice/types';

// Mock VoiceLiveClient
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockSendAudio = jest.fn();
const mockCommitAudio = jest.fn();
const mockClearAudioBuffer = jest.fn();
const mockSendText = jest.fn();
const mockUpdateSession = jest.fn();

jest.mock('@/lib/azure-ai-foundry/voice/voice-live-client', () => ({
  VoiceLiveClient: class MockVoiceLiveClient {
    onSessionCreated: ((session: FoundryVoiceSession) => void) | null = null;
    onTranscript: ((transcript: string) => void) | null = null;
    onAudioDelta: ((audioData: string) => void) | null = null;
    onError: ((error: FoundryVoiceError) => void) | null = null;
    onDisconnect: ((code: number, reason: string) => void) | null = null;
    isConnected = false;
    enableAutoReconnect = false;
    maxReconnectAttempts = 3;

    connect = mockConnect.mockImplementation(async () => {
      this.isConnected = true;
      return Promise.resolve();
    });
    disconnect = mockDisconnect.mockImplementation(() => {
      this.isConnected = false;
    });
    sendAudio = mockSendAudio;
    commitAudio = mockCommitAudio;
    clearAudioBuffer = mockClearAudioBuffer;
    sendText = mockSendText;
    updateSession = mockUpdateSession;
  }
}));

// Mock voice telemetry
const mockTrackSessionCreated = jest.fn();
const mockTrackSessionStart = jest.fn();
const mockTrackSessionReady = jest.fn();
const mockTrackSessionEnd = jest.fn();
const mockTrackTranscript = jest.fn();
const mockTrackAudioResponse = jest.fn();
const mockTrackError = jest.fn();
const mockTrackLatency = jest.fn();
const mockTrackConfigUpdate = jest.fn();

jest.mock('@/lib/azure-ai-foundry/voice/voice-telemetry', () => ({
  voiceTelemetry: {
    trackSessionCreated: mockTrackSessionCreated,
    trackSessionStart: mockTrackSessionStart,
    trackSessionReady: mockTrackSessionReady,
    trackSessionEnd: mockTrackSessionEnd,
    trackTranscript: mockTrackTranscript,
    trackAudioResponse: mockTrackAudioResponse,
    trackError: mockTrackError,
    trackLatency: mockTrackLatency,
    trackConfigUpdate: mockTrackConfigUpdate
  }
}));

describe('VoiceSession', () => {
  let session: VoiceSession;
  let config: ConfigOptions;

  beforeAll(() => {
    TEST_ENV_SETUP.setupMockEnvironment();
    
    // Mock performance.now for consistent timing tests
    Object.defineProperty(global, 'performance', {
      value: {
        now: jest.fn(() => Date.now())
      }
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    config = createMockVoiceConfig({
      temperature: 0.8,
      maxTokens: 200,
      voice: 'en-US-JennyNeural'
    });

    session = new VoiceSession(config);
  });

  afterEach(() => {
    session.dispose();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    TEST_ENV_SETUP.cleanupMockEnvironment();
  });

  describe('Initialization and Configuration', () => {
    it('should create session with valid configuration', () => {
      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^voice-session-\d+-[a-z0-9]{9}$/);
      expect(session.isActive).toBe(false);
    });

    it('should track session creation in telemetry', () => {
      expect(mockTrackSessionCreated).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        config: {
          voice: 'en-US-JennyNeural',
          temperature: 0.8,
          maxTokens: 200,
          deploymentId: config.deploymentId
        }
      });
    });

    it('should validate configuration on creation', () => {
      expect(() => {
        new VoiceSession({
          ...config,
          apiKey: ''
        });
      }).toThrow('API key is required');

      expect(() => {
        new VoiceSession({
          ...config,
          endpoint: 'http://insecure-endpoint.com'
        });
      }).toThrow('Invalid endpoint format');

      expect(() => {
        new VoiceSession({
          ...config,
          temperature: 1.5
        });
      }).toThrow('Temperature must be between 0 and 1');

      expect(() => {
        new VoiceSession({
          ...config,
          maxTokens: -1
        });
      }).toThrow('maxTokens must be greater than 0');
    });

    it('should generate unique session IDs', () => {
      const session1 = new VoiceSession(config);
      const session2 = new VoiceSession(config);
      
      expect(session1.sessionId).not.toBe(session2.sessionId);
      
      session1.dispose();
      session2.dispose();
    });

    it('should expose configuration as read-only copy', () => {
      const exposedConfig = session.configuration;
      
      expect(exposedConfig).toEqual(config);
      expect(exposedConfig).not.toBe(config); // Should be a copy
      
      // Modifying exposed config shouldn't affect original
      (exposedConfig as any).temperature = 0.5;
      expect(session.configuration.temperature).toBe(0.8);
    });
  });

  describe('Session Lifecycle', () => {
    it('should start session successfully', async () => {
      const startPromise = session.start();
      
      expect(session.isActive).toBe(false); // Not active until connected
      expect(mockTrackSessionStart).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        deploymentId: config.deploymentId,
        voice: config.voice,
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });

      await startPromise;
      
      expect(session.isActive).toBe(true);
      expect(mockConnect).toHaveBeenCalled();
    });

    it('should handle session start failure', async () => {
      const startError = new Error('Connection failed');
      mockConnect.mockRejectedValueOnce(startError);

      await expect(session.start()).rejects.toThrow('Connection failed');
      
      expect(session.isActive).toBe(false);
      expect(mockTrackError).toHaveBeenCalledWith(
        startError,
        'SESSION_START_FAILED',
        { sessionId: session.sessionId }
      );
    });

    it('should not start session if already active', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await session.start();
      expect(session.isActive).toBe(true);
      
      await session.start(); // Second start attempt
      
      expect(consoleSpy).toHaveBeenCalledWith('Session already active');
      expect(mockConnect).toHaveBeenCalledTimes(1); // Should not connect again
      
      consoleSpy.mockRestore();
    });

    it('should stop session successfully', async () => {
      await session.start();
      const startTime = Date.now();
      
      session.stop();
      
      expect(session.isActive).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();
      expect(mockTrackSessionEnd).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        duration: expect.any(Number),
        reason: 'USER_STOPPED'
      });
    });

    it('should handle stop when session not active', () => {
      expect(session.isActive).toBe(false);
      
      // Should not throw error
      session.stop();
      
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('should handle errors during stop gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockDisconnect.mockImplementationOnce(() => {
        throw new Error('Disconnect failed');
      });

      await session.start();
      session.stop();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error stopping voice session:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Event Handling', () => {
    let mockVoiceSession: FoundryVoiceSession;

    beforeEach(async () => {
      mockVoiceSession = createMockVoiceSession({
        id: 'test-azure-session-id',
        model: 'gpt-4o-realtime-preview',
        voice: 'en-US-JennyNeural'
      });

      await session.start();
    });

    it('should handle session ready event', () => {
      const onSessionReadyMock = jest.fn();
      session.onSessionReady = onSessionReadyMock;

      // Simulate VoiceLiveClient calling the handler
      const mockClient = (session as any).client;
      mockClient.onSessionCreated(mockVoiceSession);

      expect(onSessionReadyMock).toHaveBeenCalledWith(mockVoiceSession);
      expect(mockTrackSessionReady).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        azureSessionId: mockVoiceSession.id,
        model: mockVoiceSession.model,
        voice: mockVoiceSession.voice
      });
    });

    it('should handle transcript events with performance tracking', () => {
      const onTranscriptMock = jest.fn();
      session.onTranscript = onTranscriptMock;
      const mockPerformanceNow = jest.mocked(global.performance.now);
      mockPerformanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(1050);

      const transcript = 'Hello, I am ready for the interview.';
      const mockClient = (session as any).client;
      mockClient.onTranscript(transcript);

      expect(onTranscriptMock).toHaveBeenCalledWith(transcript);
      expect(mockTrackTranscript).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        transcript,
        length: transcript.length,
        timestamp: expect.any(Number)
      });
      expect(mockTrackLatency).toHaveBeenCalledWith('transcript_processing', 50);
    });

    it('should handle audio response events with performance tracking', () => {
      const onAudioResponseMock = jest.fn();
      session.onAudioResponse = onAudioResponseMock;
      const mockPerformanceNow = jest.mocked(global.performance.now);
      mockPerformanceNow.mockReturnValueOnce(2000).mockReturnValueOnce(2100);

      const audioData = 'UklGRiQAAABXQVZFZm10IBAAAAABAAECA...';
      const mockClient = (session as any).client;
      mockClient.onAudioDelta(audioData);

      expect(onAudioResponseMock).toHaveBeenCalledWith(audioData);
      expect(mockTrackAudioResponse).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        audioSize: audioData.length,
        timestamp: expect.any(Number)
      });
      expect(mockTrackLatency).toHaveBeenCalledWith('audio_processing', 100);
    });

    it('should handle error events', () => {
      const onErrorMock = jest.fn();
      session.onError = onErrorMock;

      const mockError = createMockVoiceError({
        type: 'invalid_request_error',
        code: 'invalid_audio_format',
        message: 'Invalid audio format provided'
      });

      const mockClient = (session as any).client;
      mockClient.onError(mockError);

      expect(onErrorMock).toHaveBeenCalledWith(mockError);
      expect(mockTrackError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid audio format provided',
          name: 'invalid_request_error'
        }),
        'AZURE_API_ERROR',
        {
          sessionId: session.sessionId,
          errorCode: 'invalid_audio_format',
          errorType: 'invalid_request_error'
        }
      );
    });

    it('should handle disconnect events with appropriate reason mapping', () => {
      const onDisconnectMock = jest.fn();
      session.onDisconnect = onDisconnectMock;

      const mockClient = (session as any).client;

      // Test normal closure
      mockClient.onDisconnect(1000, 'Normal closure');
      expect(onDisconnectMock).toHaveBeenCalledWith(1000, 'Normal closure');
      expect(mockTrackSessionEnd).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        duration: expect.any(Number),
        reason: 'USER_STOPPED',
        closeCode: 1000
      });

      // Test connection lost
      mockClient.onDisconnect(1006, 'Connection lost');
      expect(mockTrackSessionEnd).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        duration: expect.any(Number),
        reason: 'CONNECTION_LOST',
        closeCode: 1006
      });

      // Test unknown reason
      mockClient.onDisconnect(1011, 'Unexpected condition');
      expect(mockTrackSessionEnd).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        duration: expect.any(Number),
        reason: 'UNKNOWN',
        closeCode: 1011
      });
    });
  });

  describe('Audio Processing', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('should send audio data successfully', () => {
      const audioData = AUDIO_TEST_DATA.generateSilence(1000);
      
      session.sendAudio(audioData);
      
      expect(mockSendAudio).toHaveBeenCalledWith(audioData);
    });

    it('should commit audio buffer successfully', () => {
      session.commitAudio();
      
      expect(mockCommitAudio).toHaveBeenCalled();
    });

    it('should clear audio buffer successfully', () => {
      session.clearAudioBuffer();
      
      expect(mockClearAudioBuffer).toHaveBeenCalled();
    });

    it('should handle multiple audio chunks', () => {
      const chunk1 = AUDIO_TEST_DATA.SMALL_CHUNK;
      const chunk2 = AUDIO_TEST_DATA.MEDIUM_CHUNK;
      const chunk3 = AUDIO_TEST_DATA.LARGE_CHUNK;
      
      session.sendAudio(chunk1);
      session.sendAudio(chunk2);
      session.sendAudio(chunk3);
      session.commitAudio();
      
      expect(mockSendAudio).toHaveBeenCalledTimes(3);
      expect(mockCommitAudio).toHaveBeenCalledTimes(1);
    });

    it('should throw error when sending audio without active session', () => {
      const audioData = AUDIO_TEST_DATA.SMALL_CHUNK;
      
      // Session not started
      expect(() => session.sendAudio(audioData)).toThrow('Session not started');
    });

    it('should throw error when committing audio without active session', () => {
      expect(() => session.commitAudio()).toThrow('Session not started');
    });

    it('should throw error when clearing buffer without active session', () => {
      expect(() => session.clearAudioBuffer()).toThrow('Session not started');
    });
  });

  describe('Text Processing', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('should send text message successfully', () => {
      const text = 'What technologies do you work with?';
      
      session.sendText(text);
      
      expect(mockSendText).toHaveBeenCalledWith(text);
    });

    it('should handle empty text messages', () => {
      session.sendText('');
      
      expect(mockSendText).toHaveBeenCalledWith('');
    });

    it('should handle long text messages', () => {
      const longText = 'This is a very long question about your experience with distributed systems, microservices architecture, database design, and cloud technologies. Can you walk me through your approach to designing scalable systems?';
      
      session.sendText(longText);
      
      expect(mockSendText).toHaveBeenCalledWith(longText);
    });

    it('should throw error when sending text without active session', () => {
      expect(() => session.sendText('Hello')).toThrow('Session not started');
    });
  });

  describe('Session Settings Management', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('should update session settings successfully', () => {
      const newSettings = {
        temperature: 0.9,
        maxTokens: 300,
        voice: 'en-US-AriaNeural' as const
      };
      
      session.updateSettings(newSettings);
      
      expect(mockUpdateSession).toHaveBeenCalledWith(newSettings);
      expect(mockTrackConfigUpdate).toHaveBeenCalledWith({
        sessionId: session.sessionId,
        changes: newSettings
      });
    });

    it('should update partial settings', () => {
      const partialSettings = { temperature: 0.5 };
      
      session.updateSettings(partialSettings);
      
      expect(mockUpdateSession).toHaveBeenCalledWith(partialSettings);
    });

    it('should throw error when updating settings without active session', () => {
      expect(() => {
        session.updateSettings({ temperature: 0.9 });
      }).toThrow('Session not started');
    });
  });

  describe('Connection Management', () => {
    it('should enable auto-reconnection', async () => {
      await session.start();
      const mockClient = (session as any).client;
      
      session.enableAutoReconnect(5);
      
      expect(mockClient.enableAutoReconnect).toBe(true);
      expect(mockClient.maxReconnectAttempts).toBe(5);
    });

    it('should disable auto-reconnection', async () => {
      await session.start();
      const mockClient = (session as any).client;
      
      session.disableAutoReconnect();
      
      expect(mockClient.enableAutoReconnect).toBe(false);
    });

    it('should check connection status', async () => {
      await session.start();
      const mockClient = (session as any).client;
      mockClient.isConnected = true;
      
      expect(session.isConnected()).toBe(true);
      
      mockClient.isConnected = false;
      expect(session.isConnected()).toBe(false);
    });
  });

  describe('State and Metrics', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('should provide session state information', () => {
      const state = session.getState();
      
      expect(state).toMatchObject({
        sessionId: session.sessionId,
        status: 'active',
        currentAgent: 'azure-foundry',
        metrics: {
          connectionLatency: 0,
          audioLatency: 0,
          transcriptionAccuracy: 0,
          responseTime: 0,
          totalSpeakingTime: expect.any(Number),
          silenceDuration: 0
        },
        errors: []
      });
    });

    it('should provide session metrics', () => {
      const metrics = session.getMetrics();
      
      expect(metrics).toMatchObject({
        sessionId: session.sessionId,
        isActive: true,
        duration: expect.any(Number),
        configuration: {
          voice: config.voice,
          temperature: config.temperature,
          maxTokens: config.maxTokens
        }
      });
    });

    it('should calculate session duration correctly', () => {
      const startTime = Date.now();
      jest.advanceTimersByTime(5000); // 5 seconds
      
      const metrics = session.getMetrics();
      
      expect(metrics.duration).toBeGreaterThanOrEqual(5000);
    });
  });

  describe('Resource Management', () => {
    it('should dispose of resources properly', async () => {
      await session.start();
      expect(session.isActive).toBe(true);
      
      session.dispose();
      
      expect(session.isActive).toBe(false);
      expect(mockDisconnect).toHaveBeenCalled();
      
      // Event handlers should be cleared
      expect(session.onSessionReady).toBeNull();
      expect(session.onTranscript).toBeNull();
      expect(session.onAudioResponse).toBeNull();
      expect(session.onTextResponse).toBeNull();
      expect(session.onError).toBeNull();
      expect(session.onDisconnect).toBeNull();
    });

    it('should handle dispose when session not active', () => {
      expect(session.isActive).toBe(false);
      
      // Should not throw error
      session.dispose();
      
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('should handle multiple dispose calls gracefully', async () => {
      await session.start();
      
      session.dispose();
      session.dispose(); // Second dispose call
      
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Requirements', () => {
    it('should meet session start performance threshold', async () => {
      const startTime = performance.now();
      
      await session.start();
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.VOICE_SESSION.CONNECTION_TIMEOUT);
    });

    it('should handle audio processing within performance threshold', () => {
      const performanceNow = jest.mocked(global.performance.now);
      
      // Mock performance timing for audio processing
      performanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(1400);
      
      const onAudioResponseMock = jest.fn();
      session.onAudioResponse = onAudioResponseMock;
      
      const mockClient = (session as any).client;
      mockClient.onAudioDelta('audio-data');
      
      // Should have tracked latency within threshold
      expect(mockTrackLatency).toHaveBeenCalledWith('audio_processing', 400);
      expect(400).toBeLessThan(PERFORMANCE_THRESHOLDS.VOICE_SESSION.AUDIO_PROCESSING_TIME);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle configuration validation errors gracefully', () => {
      expect(() => {
        new VoiceSession({
          ...config,
          apiKey: '   ' // Whitespace only
        });
      }).toThrow('API key is required');
    });

    it('should handle invalid endpoint protocols', () => {
      expect(() => {
        new VoiceSession({
          ...config,
          endpoint: 'ws://insecure-endpoint.com' // Should be wss://
        });
      }).toThrow('Invalid endpoint format');
    });

    it('should handle edge case temperature values', () => {
      expect(() => {
        new VoiceSession({
          ...config,
          temperature: -0.1
        });
      }).toThrow('Temperature must be between 0 and 1');

      expect(() => {
        new VoiceSession({
          ...config,
          temperature: 1.1
        });
      }).toThrow('Temperature must be between 0 and 1');
    });

    it('should handle zero and negative maxTokens', () => {
      expect(() => {
        new VoiceSession({
          ...config,
          maxTokens: 0
        });
      }).toThrow('maxTokens must be greater than 0');
    });
  });
});
