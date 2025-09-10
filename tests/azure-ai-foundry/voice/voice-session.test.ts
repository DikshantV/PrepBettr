import { VoiceSession } from '@/lib/azure-ai-foundry/voice/voice-session';
import { VoiceLiveClient } from '@/lib/azure-ai-foundry/voice/voice-live-client';
import { ConfigOptions } from '@/lib/azure-ai-foundry/voice/types';
import { voiceTelemetry } from '@/lib/azure-ai-foundry/voice/voice-telemetry';

// Mock VoiceLiveClient
jest.mock('@/lib/azure-ai-foundry/voice/voice-live-client');
jest.mock('@/lib/azure-ai-foundry/voice/voice-telemetry');

const MockVoiceLiveClient = VoiceLiveClient as jest.MockedClass<typeof VoiceLiveClient>;

describe('VoiceSession', () => {
  let session: VoiceSession;
  let mockClient: jest.Mocked<VoiceLiveClient>;
  let mockConfig: ConfigOptions;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock client instance
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      isConnected: false,
      sendAudio: jest.fn(),
      sendText: jest.fn(),
      commitAudio: jest.fn(),
      clearAudioBuffer: jest.fn(),
      updateSession: jest.fn(),
      onSessionCreated: null,
      onTranscript: null,
      onAudioDelta: null,
      onError: null,
      onDisconnect: null,
      enableAutoReconnect: false,
      maxReconnectAttempts: 3
    } as any;

    MockVoiceLiveClient.mockImplementation(() => mockClient);

    mockConfig = {
      endpoint: 'wss://eastus.api.cognitive.microsoft.com/cognitiveservices/websocket/v1',
      apiKey: 'test-key',
      deploymentId: 'test-deployment',
      temperature: 0.7,
      maxTokens: 150,
      voice: 'en-US-AvaMultilingualNeural',
      inputFormat: 'simple',
      outputFormat: 'simple',
      instructionMessage: 'You are a helpful assistant.',
      turnDetection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      }
    };

    session = new VoiceSession(mockConfig);
  });

  describe('Session Creation', () => {
    it('should create session with default parameters', async () => {
      await session.start();

      expect(MockVoiceLiveClient).toHaveBeenCalledWith(mockConfig);
      expect(mockClient.connect).toHaveBeenCalled();
      expect(voiceTelemetry.trackSessionStart).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        deploymentId: 'test-deployment',
        voice: 'en-US-AvaMultilingualNeural',
        temperature: 0.7,
        maxTokens: 150
      });
    });

    it('should create session with custom parameters', async () => {
      const customConfig = {
        ...mockConfig,
        temperature: 0.9,
        maxTokens: 200,
        voice: 'en-US-JennyNeural',
        instructionMessage: 'You are a technical interviewer.'
      };

      session = new VoiceSession(customConfig);
      await session.start();

      expect(MockVoiceLiveClient).toHaveBeenCalledWith(customConfig);
      expect(voiceTelemetry.trackSessionStart).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        deploymentId: 'test-deployment',
        voice: 'en-US-JennyNeural',
        temperature: 0.9,
        maxTokens: 200
      });
    });

    it('should handle session creation errors', async () => {
      const error = new Error('Connection failed');
      mockClient.connect.mockRejectedValue(error);

      await expect(session.start()).rejects.toThrow('Connection failed');
      
      expect(voiceTelemetry.trackError).toHaveBeenCalledWith(
        error,
        'SESSION_START_FAILED',
        expect.objectContaining({
          sessionId: expect.any(String)
        })
      );
    });

    it('should set up event handlers correctly', async () => {
      await session.start();

      expect(mockClient.onSessionCreated).toBeDefined();
      expect(mockClient.onTranscript).toBeDefined();
      expect(mockClient.onAudioDelta).toBeDefined();
      expect(mockClient.onError).toBeDefined();
      expect(mockClient.onDisconnect).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    let onTranscriptMock: jest.Mock;
    let onAudioResponseMock: jest.Mock;
    let onErrorMock: jest.Mock;

    beforeEach(async () => {
      onTranscriptMock = jest.fn();
      onAudioResponseMock = jest.fn();
      onErrorMock = jest.fn();

      session.onTranscript = onTranscriptMock;
      session.onAudioResponse = onAudioResponseMock;
      session.onError = onErrorMock;

      await session.start();
    });

    it('should handle transcript events', () => {
      const transcript = 'Hello, how are you?';
      
      // Simulate transcript received from client
      mockClient.onTranscript?.(transcript);

      expect(onTranscriptMock).toHaveBeenCalledWith(transcript);
      expect(voiceTelemetry.trackTranscript).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        transcript,
        length: transcript.length,
        timestamp: expect.any(Number)
      });
    });

    it('should handle audio response events', () => {
      const audioData = 'YXVkaW8gZGF0YQ=='; // base64 encoded
      
      // Simulate audio delta received from client
      mockClient.onAudioDelta?.(audioData);

      expect(onAudioResponseMock).toHaveBeenCalledWith(audioData);
      expect(voiceTelemetry.trackAudioResponse).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        audioSize: audioData.length,
        timestamp: expect.any(Number)
      });
    });

    it('should handle session created events', () => {
      const sessionData = {
        id: 'sess_123',
        object: 'realtime.session',
        model: 'gpt-4o-realtime-preview',
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful assistant.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: null
      };

      // Simulate session created from client
      mockClient.onSessionCreated?.(sessionData);

      expect(voiceTelemetry.trackSessionReady).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        azureSessionId: 'sess_123',
        model: 'gpt-4o-realtime-preview',
        voice: 'alloy'
      });
    });

    it('should handle error events', () => {
      const error = {
        type: 'invalid_request_error',
        code: 'invalid_event_type',
        message: 'Invalid event type',
        param: null,
        event_id: 'event_123'
      };

      // Simulate error from client
      mockClient.onError?.(error);

      expect(onErrorMock).toHaveBeenCalledWith(error);
      expect(voiceTelemetry.trackError).toHaveBeenCalledWith(
        expect.any(Error),
        'AZURE_API_ERROR',
        expect.objectContaining({
          sessionId: expect.any(String),
          errorCode: error.code,
          errorType: error.type
        })
      );
    });

    it('should handle disconnect events', () => {
      const onDisconnectMock = jest.fn();
      session.onDisconnect = onDisconnectMock;

      // Simulate disconnect from client
      mockClient.onDisconnect?.(1006, 'Connection lost');

      expect(onDisconnectMock).toHaveBeenCalledWith(1006, 'Connection lost');
      expect(voiceTelemetry.trackSessionEnd).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        duration: expect.any(Number),
        reason: 'CONNECTION_LOST',
        closeCode: 1006
      });
    });
  });

  describe('Audio Operations', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('should send audio data', () => {
      const audioData = new ArrayBuffer(1024);
      
      session.sendAudio(audioData);

      expect(mockClient.sendAudio).toHaveBeenCalledWith(audioData);
    });

    it('should commit audio buffer', () => {
      session.commitAudio();

      expect(mockClient.commitAudio).toHaveBeenCalled();
    });

    it('should clear audio buffer', () => {
      session.clearAudioBuffer();

      expect(mockClient.clearAudioBuffer).toHaveBeenCalled();
    });

    it('should handle audio operations when not started', () => {
      const unstarted = new VoiceSession(mockConfig);
      
      expect(() => unstarted.sendAudio(new ArrayBuffer(1024))).toThrow('Session not started');
      expect(() => unstarted.commitAudio()).toThrow('Session not started');
      expect(() => unstarted.clearAudioBuffer()).toThrow('Session not started');
    });
  });

  describe('Text Operations', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('should send text messages', () => {
      const message = 'Hello, assistant!';
      
      session.sendText(message);

      expect(mockClient.sendText).toHaveBeenCalledWith(message);
    });

    it('should handle text operations when not started', () => {
      const unstarted = new VoiceSession(mockConfig);
      
      expect(() => unstarted.sendText('Hello')).toThrow('Session not started');
    });
  });

  describe('Session Updates', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('should update session settings', () => {
      const newSettings = {
        temperature: 0.9,
        maxTokens: 200,
        voice: 'en-US-JennyNeural'
      };

      session.updateSettings(newSettings);

      expect(mockClient.updateSession).toHaveBeenCalledWith(newSettings);
      expect(voiceTelemetry.trackConfigUpdate).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        changes: newSettings
      });
    });

    it('should handle partial settings updates', () => {
      const partialSettings = {
        temperature: 0.5
      };

      session.updateSettings(partialSettings);

      expect(mockClient.updateSession).toHaveBeenCalledWith(partialSettings);
    });

    it('should handle settings updates when not started', () => {
      const unstarted = new VoiceSession(mockConfig);
      
      expect(() => unstarted.updateSettings({ temperature: 0.5 })).toThrow('Session not started');
    });
  });

  describe('Session Lifecycle', () => {
    it('should track session state correctly', async () => {
      expect(session.isActive).toBe(false);

      await session.start();
      expect(session.isActive).toBe(true);

      session.stop();
      expect(session.isActive).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should handle multiple start calls gracefully', async () => {
      await session.start();
      await session.start(); // Second call should be ignored

      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle stop when not started', () => {
      expect(() => session.stop()).not.toThrow();
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should cleanup on stop', async () => {
      await session.start();
      session.stop();

      expect(voiceTelemetry.trackSessionEnd).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        duration: expect.any(Number),
        reason: 'USER_STOPPED'
      });
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('should handle connection errors gracefully', () => {
      const onErrorMock = jest.fn();
      session.onError = onErrorMock;

      const error = {
        type: 'connection_error',
        code: 'websocket_connection_error',
        message: 'WebSocket connection failed',
        param: null,
        event_id: 'event_456'
      };

      mockClient.onError?.(error);

      expect(onErrorMock).toHaveBeenCalledWith(error);
      expect(voiceTelemetry.trackError).toHaveBeenCalled();
    });

    it('should handle unexpected disconnections', () => {
      const onDisconnectMock = jest.fn();
      session.onDisconnect = onDisconnectMock;

      mockClient.onDisconnect?.(1011, 'Internal server error');

      expect(onDisconnectMock).toHaveBeenCalledWith(1011, 'Internal server error');
      expect(session.isActive).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration parameters', () => {
      const invalidConfig = {
        ...mockConfig,
        apiKey: '' // Empty API key
      };

      expect(() => new VoiceSession(invalidConfig)).toThrow('API key is required');
    });

    it('should validate endpoint format', () => {
      const invalidConfig = {
        ...mockConfig,
        endpoint: 'invalid-endpoint'
      };

      expect(() => new VoiceSession(invalidConfig)).toThrow('Invalid endpoint format');
    });

    it('should validate temperature range', () => {
      const invalidConfig = {
        ...mockConfig,
        temperature: 1.5 // Above maximum
      };

      expect(() => new VoiceSession(invalidConfig)).toThrow('Temperature must be between 0 and 1');
    });

    it('should validate maxTokens range', () => {
      const invalidConfig = {
        ...mockConfig,
        maxTokens: 0 // Below minimum
      };

      expect(() => new VoiceSession(invalidConfig)).toThrow('maxTokens must be greater than 0');
    });
  });

  describe('Session ID Generation', () => {
    it('should generate unique session IDs', async () => {
      const session1 = new VoiceSession(mockConfig);
      const session2 = new VoiceSession(mockConfig);

      await session1.start();
      await session2.start();

      expect(session1.sessionId).toBeDefined();
      expect(session2.sessionId).toBeDefined();
      expect(session1.sessionId).not.toBe(session2.sessionId);

      session1.stop();
      session2.stop();
    });

    it('should maintain session ID throughout lifecycle', async () => {
      await session.start();
      const sessionId = session.sessionId;

      session.stop();
      await session.start();

      expect(session.sessionId).toBe(sessionId);
    });
  });
});
