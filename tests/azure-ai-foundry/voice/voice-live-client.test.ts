import { VoiceLiveClient } from '@/lib/azure-ai-foundry/voice/voice-live-client';
import { ConfigOptions } from '@/lib/azure-ai-foundry/voice/types';

// Mock WebSocket for testing
class MockWebSocket {
  public readyState = WebSocket.CONNECTING;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  
  private eventListeners: { [key: string]: ((event: any) => void)[] } = {};

  send = jest.fn();
  close = jest.fn();
  
  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.eventListeners[type]) {
      this.eventListeners[type] = this.eventListeners[type].filter(l => l !== listener);
    }
  }

  // Helper methods for testing
  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
    this.eventListeners['open']?.forEach(listener => listener(new Event('open')));
  }

  simulateClose(code: number = 1000, reason: string = '') {
    this.readyState = WebSocket.CLOSED;
    const closeEvent = { code, reason, wasClean: code === 1000 } as CloseEvent;
    if (this.onclose) {
      this.onclose(closeEvent);
    }
    this.eventListeners['close']?.forEach(listener => listener(closeEvent));
  }

  simulateError() {
    const errorEvent = new Event('error');
    if (this.onerror) {
      this.onerror(errorEvent);
    }
    this.eventListeners['error']?.forEach(listener => listener(errorEvent));
  }

  simulateMessage(data: any) {
    const messageEvent = { data: JSON.stringify(data) } as MessageEvent;
    if (this.onmessage) {
      this.onmessage(messageEvent);
    }
    this.eventListeners['message']?.forEach(listener => listener(messageEvent));
  }
}

// Mock global WebSocket
const mockWebSocketConstructor = jest.fn();
(global as any).WebSocket = mockWebSocketConstructor;

describe('VoiceLiveClient', () => {
  let client: VoiceLiveClient;
  let mockWebSocket: MockWebSocket;
  let mockConfig: ConfigOptions;

  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
    mockWebSocketConstructor.mockImplementation(() => mockWebSocket);
    
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

    client = new VoiceLiveClient(mockConfig);
    
    // Clear all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    client.disconnect();
  });

  describe('Connection Management', () => {
    it('should create WebSocket connection with correct URL and protocol', async () => {
      const connectPromise = client.connect();
      
      expect(mockWebSocketConstructor).toHaveBeenCalledWith(
        expect.stringContaining('wss://eastus.api.cognitive.microsoft.com'),
        ['azure-openai-realtime']
      );

      mockWebSocket.simulateOpen();
      await connectPromise;
      
      expect(client.isConnected).toBe(true);
    });

    it('should handle connection success', async () => {
      const connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      
      await connectPromise;
      expect(client.isConnected).toBe(true);
    });

    it('should handle connection failure', async () => {
      const connectPromise = client.connect();
      mockWebSocket.simulateError();
      
      await expect(connectPromise).rejects.toThrow('WebSocket connection failed');
      expect(client.isConnected).toBe(false);
    });

    it('should handle connection close', async () => {
      const connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      await connectPromise;

      const onDisconnectMock = jest.fn();
      client.onDisconnect = onDisconnectMock;

      mockWebSocket.simulateClose(1006, 'Abnormal closure');
      
      expect(client.isConnected).toBe(false);
      expect(onDisconnectMock).toHaveBeenCalledWith(1006, 'Abnormal closure');
    });
  });

  describe('Reconnection Logic', () => {
    it('should implement exponential backoff', async () => {
      client.enableAutoReconnect = true;
      const connectSpy = jest.spyOn(client, 'connect');
      
      // Initial connection
      let connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      await connectPromise;

      // Simulate unexpected disconnect
      mockWebSocket.simulateClose(1006, 'Connection lost');

      // First reconnection attempt (1s delay)
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
      
      jest.advanceTimersByTime(1000);
      mockWebSocket = new MockWebSocket(); // Reset mock for new connection
      mockWebSocketConstructor.mockImplementation(() => mockWebSocket);
      mockWebSocket.simulateError(); // First attempt fails
      
      // Second reconnection attempt (2s delay)
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
      
      jest.advanceTimersByTime(2000);
      mockWebSocket.simulateError(); // Second attempt fails
      
      // Third reconnection attempt (4s delay)
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 4000);

      expect(connectSpy).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should respect maxReconnectAttempts', async () => {
      client.enableAutoReconnect = true;
      client.maxReconnectAttempts = 2;
      const connectSpy = jest.spyOn(client, 'connect');
      
      // Initial connection
      let connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      await connectPromise;

      // Simulate unexpected disconnect
      mockWebSocket.simulateClose(1006, 'Connection lost');

      // Exhaust all reconnection attempts
      for (let i = 0; i < 2; i++) {
        jest.advanceTimersByTime(Math.pow(2, i) * 1000);
        mockWebSocket.simulateError();
      }

      // Should not attempt more reconnections
      jest.advanceTimersByTime(10000);
      expect(connectSpy).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should reset backoff on successful reconnection', async () => {
      client.enableAutoReconnect = true;
      const connectSpy = jest.spyOn(client, 'connect');
      
      // Initial connection
      let connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      await connectPromise;

      // First disconnect and failed reconnection
      mockWebSocket.simulateClose(1006, 'Connection lost');
      jest.advanceTimersByTime(1000);
      mockWebSocket.simulateError();
      
      // Second attempt succeeds
      jest.advanceTimersByTime(2000);
      mockWebSocket.simulateOpen();
      
      // Disconnect again - should start with 1s delay again
      mockWebSocket.simulateClose(1006, 'Connection lost again');
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      await connectPromise;
    });

    it('should handle session.created event', () => {
      const onSessionCreatedMock = jest.fn();
      client.onSessionCreated = onSessionCreatedMock;

      const sessionData = {
        type: 'session.created',
        session: {
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
        }
      };

      mockWebSocket.simulateMessage(sessionData);
      
      expect(onSessionCreatedMock).toHaveBeenCalledWith(sessionData.session);
    });

    it('should handle conversation.item.input_audio_transcription.completed event', () => {
      const onTranscriptMock = jest.fn();
      client.onTranscript = onTranscriptMock;

      const transcriptData = {
        type: 'conversation.item.input_audio_transcription.completed',
        item_id: 'item_123',
        content_index: 0,
        transcript: 'Hello, how are you?'
      };

      mockWebSocket.simulateMessage(transcriptData);
      
      expect(onTranscriptMock).toHaveBeenCalledWith('Hello, how are you?');
    });

    it('should handle response.audio.delta event', () => {
      const onAudioDeltaMock = jest.fn();
      client.onAudioDelta = onAudioDeltaMock;

      const audioDelta = {
        type: 'response.audio.delta',
        response_id: 'resp_123',
        item_id: 'item_456',
        output_index: 0,
        content_index: 0,
        delta: 'YXVkaW8gZGF0YQ==' // base64 encoded audio data
      };

      mockWebSocket.simulateMessage(audioDelta);
      
      expect(onAudioDeltaMock).toHaveBeenCalledWith('YXVkaW8gZGF0YQ==');
    });

    it('should handle error events', () => {
      const onErrorMock = jest.fn();
      client.onError = onErrorMock;

      const errorData = {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          code: 'invalid_event_type',
          message: 'Invalid event type',
          param: null,
          event_id: 'event_123'
        }
      };

      mockWebSocket.simulateMessage(errorData);
      
      expect(onErrorMock).toHaveBeenCalledWith(errorData.error);
    });

    it('should ignore unknown event types', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const unknownEvent = {
        type: 'unknown.event.type',
        data: 'some data'
      };

      mockWebSocket.simulateMessage(unknownEvent);
      
      expect(consoleSpy).toHaveBeenCalledWith('Unknown event type:', 'unknown.event.type');
      consoleSpy.mockRestore();
    });
  });

  describe('Audio Streaming', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      await connectPromise;
    });

    it('should send audio data correctly', () => {
      const audioData = new ArrayBuffer(1024);
      const uint8Array = new Uint8Array(audioData);
      uint8Array.fill(128); // Fill with sample data

      client.sendAudio(audioData);

      // Get the actual calls to inspect what was sent
      const calls = (mockWebSocket.send as jest.Mock).mock.calls;
      const audioCall = calls.find(call => 
        JSON.parse(call[0]).type === 'input_audio_buffer.append'
      );
      
      expect(audioCall).toBeDefined();
      const parsedCall = JSON.parse(audioCall[0]);
      expect(parsedCall.type).toBe('input_audio_buffer.append');
      expect(typeof parsedCall.audio).toBe('string');
      expect(parsedCall.audio.length).toBeGreaterThan(0);
    });

    it('should commit audio buffer', () => {
      client.commitAudio();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'input_audio_buffer.commit'
        })
      );
    });

    it('should clear audio buffer', () => {
      client.clearAudioBuffer();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'input_audio_buffer.clear'
        })
      );
    });
  });

  describe('Text Messaging', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      await connectPromise;
    });

    it('should send text messages correctly', () => {
      const message = 'Hello, assistant!';
      client.sendText(message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: message
              }
            ]
          }
        })
      );

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'response.create'
        })
      );
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      await connectPromise;
    });

    it('should update session settings', () => {
      const newSettings = {
        temperature: 0.9,
        maxTokens: 200,
        voice: 'en-US-JennyNeural'
      };

      client.updateSession(newSettings);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'session.update',
          session: {
            temperature: 0.9,
            max_response_output_tokens: 200,
            voice: 'en-US-JennyNeural'
          }
        })
      );
    });

    it('should handle partial session updates', () => {
      const partialSettings = {
        temperature: 0.5
      };

      client.updateSession(partialSettings);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'session.update',
          session: {
            temperature: 0.5
          }
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error when sending without connection', () => {
      expect(() => {
        client.sendText('Hello');
      }).toThrow('WebSocket is not connected');
    });

    it('should handle WebSocket errors gracefully', async () => {
      const onErrorMock = jest.fn();
      client.onError = onErrorMock;

      const connectPromise = client.connect();
      mockWebSocket.simulateError();

      await expect(connectPromise).rejects.toThrow();
    });

    it('should cleanup on disconnect', async () => {
      const connectPromise = client.connect();
      mockWebSocket.simulateOpen();
      await connectPromise;

      client.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(client.isConnected).toBe(false);
    });
  });
});
