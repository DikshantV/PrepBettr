import { VoiceSession } from '@/lib/azure-ai-foundry/voice/voice-session';
import { ConfigOptions } from '@/lib/azure-ai-foundry/voice/types';

/**
 * Integration tests for Azure AI Foundry voice system
 * These tests validate the full end-to-end flow with mocked Azure WebSocket
 */

// Mock WebSocket responses for Azure OpenAI Realtime API
const mockAzureResponses = {
  sessionCreated: {
    type: 'session.created',
    session: {
      id: 'sess_integration_test',
      object: 'realtime.session',
      model: 'gpt-4o-realtime-preview',
      modalities: ['text', 'audio'],
      instructions: 'You are conducting a technical interview.',
      voice: 'en-US-AvaMultilingualNeural',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      },
      tool_choice: 'auto',
      temperature: 0.7,
      max_response_output_tokens: 150
    }
  },
  transcriptCompleted: {
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'item_audio_001',
    content_index: 0,
    transcript: 'Hello, I am ready for the interview.'
  },
  responseAudioStart: {
    type: 'response.audio.delta',
    response_id: 'resp_001',
    item_id: 'item_resp_001',
    output_index: 0,
    content_index: 0,
    delta: 'UklGRn4AAABXQVZFZm10IBAAAAABAAECA...' // Mock base64 audio
  },
  responseTextStart: {
    type: 'response.text.delta',
    response_id: 'resp_002',
    item_id: 'item_resp_002',
    output_index: 0,
    content_index: 0,
    delta: 'Thank you for joining. '
  },
  responseTextContinue: {
    type: 'response.text.delta',
    response_id: 'resp_002',
    item_id: 'item_resp_002',
    output_index: 0,
    content_index: 0,
    delta: 'Let\'s start with your background.'
  },
  error: {
    type: 'error',
    error: {
      type: 'invalid_request_error',
      code: 'invalid_audio_format',
      message: 'Invalid audio format provided',
      param: 'audio',
      event_id: 'event_error_001'
    }
  }
};

// Enhanced MockWebSocket for integration testing
class IntegrationMockWebSocket {
  public readyState = WebSocket.CONNECTING;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  
  private eventListeners: { [key: string]: ((event: any) => void)[] } = {};
  private messageQueue: any[] = [];
  private connected = false;

  send = jest.fn((data: string) => {
    if (!this.connected) {
      throw new Error('WebSocket is not connected');
    }
    
    // Parse the message to understand what was sent
    try {
      const message = JSON.parse(data);
      this.handleSentMessage(message);
    } catch (e) {
      console.warn('Failed to parse sent message:', data);
    }
  });
  
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

  // Enhanced simulation methods
  simulateConnection() {
    this.readyState = WebSocket.OPEN;
    this.connected = true;
    
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
    this.eventListeners['open']?.forEach(listener => listener(new Event('open')));

    // Send session.created event after connection
    setTimeout(() => {
      this.simulateMessage(mockAzureResponses.sessionCreated);
    }, 10);
  }

  simulateMessage(data: any) {
    const messageEvent = { data: JSON.stringify(data) } as MessageEvent;
    if (this.onmessage) {
      this.onmessage(messageEvent);
    }
    this.eventListeners['message']?.forEach(listener => listener(messageEvent));
  }

  simulateClose(code: number = 1000, reason: string = '') {
    this.readyState = WebSocket.CLOSED;
    this.connected = false;
    
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

  // Handle messages sent to the WebSocket and simulate appropriate responses
  private handleSentMessage(message: any) {
    switch (message.type) {
      case 'input_audio_buffer.append':
        // Simulate transcript after audio is sent
        setTimeout(() => {
          this.simulateMessage(mockAzureResponses.transcriptCompleted);
        }, 50);
        break;
        
      case 'input_audio_buffer.commit':
        // Simulate audio response after commit
        setTimeout(() => {
          this.simulateMessage(mockAzureResponses.responseAudioStart);
        }, 100);
        break;
        
      case 'conversation.item.create':
        // Simulate text response after text message
        if (message.item?.content?.[0]?.text) {
          setTimeout(() => {
            this.simulateMessage(mockAzureResponses.responseTextStart);
            setTimeout(() => {
              this.simulateMessage(mockAzureResponses.responseTextContinue);
            }, 50);
          }, 75);
        }
        break;
        
      case 'session.update':
        // Acknowledge session update
        setTimeout(() => {
          this.simulateMessage({
            type: 'session.updated',
            session: {
              ...mockAzureResponses.sessionCreated.session,
              ...message.session
            }
          });
        }, 25);
        break;
    }
  }
}

describe('Azure AI Foundry Voice Integration', () => {
  let mockWebSocket: IntegrationMockWebSocket;
  let session: VoiceSession;
  let config: ConfigOptions;

  const mockWebSocketConstructor = jest.fn();
  
  beforeAll(() => {
    (global as any).WebSocket = mockWebSocketConstructor;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    mockWebSocket = new IntegrationMockWebSocket();
    mockWebSocketConstructor.mockImplementation(() => mockWebSocket);

    config = {
      endpoint: 'wss://eastus.api.cognitive.microsoft.com/cognitiveservices/websocket/v1',
      apiKey: 'integration-test-key',
      deploymentId: 'integration-deployment',
      temperature: 0.7,
      maxTokens: 150,
      voice: 'en-US-AvaMultilingualNeural',
      inputFormat: 'simple',
      outputFormat: 'simple',
      instructionMessage: 'You are conducting a technical interview.',
      turnDetection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      }
    };

    session = new VoiceSession(config);
  });

  afterEach(() => {
    session.stop();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Full Voice Interview Flow', () => {
    it('should complete end-to-end voice interview session', async () => {
      // Event handler mocks
      const onSessionReady = jest.fn();
      const onTranscript = jest.fn();
      const onAudioResponse = jest.fn();
      const onTextResponse = jest.fn();
      const onError = jest.fn();

      session.onSessionReady = onSessionReady;
      session.onTranscript = onTranscript;
      session.onAudioResponse = onAudioResponse;
      session.onTextResponse = onTextResponse;
      session.onError = onError;

      // Step 1: Start session
      const startPromise = session.start();
      // Simulate connection immediately after start
      setTimeout(() => mockWebSocket.simulateConnection(), 0);
      await startPromise;

      // Advance timers to receive session.created
      jest.advanceTimersByTime(15);
      
      expect(session.isActive).toBe(true);
      expect(onSessionReady).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sess_integration_test',
          voice: 'en-US-AvaMultilingualNeural'
        })
      );

      // Step 2: Send audio (simulate user speaking)
      const mockAudioData = new ArrayBuffer(1024);
      session.sendAudio(mockAudioData);
      session.commitAudio();

      // Advance timers for transcript processing
      jest.advanceTimersByTime(60);
      
      expect(onTranscript).toHaveBeenCalledWith('Hello, I am ready for the interview.');

      // Step 3: Receive audio response
      jest.advanceTimersByTime(50);
      
      expect(onAudioResponse).toHaveBeenCalledWith('UklGRn4AAABXQVZFZm10IBAAAAABAAECA...');

      // Step 4: Send text message
      session.sendText('What technologies do you use?');

      // Advance timers for text response
      jest.advanceTimersByTime(80);
      
      expect(onTextResponse).toHaveBeenCalledWith('Thank you for joining. ');
      
      jest.advanceTimersByTime(55);
      
      expect(onTextResponse).toHaveBeenCalledWith('Let\'s start with your background.');

      // Step 5: Update session settings
      session.updateSettings({
        temperature: 0.8,
        voice: 'en-US-JennyNeural'
      });

      jest.advanceTimersByTime(30);

      // Verify no errors occurred
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle audio streaming with multiple chunks', async () => {
      const onTranscript = jest.fn();
      session.onTranscript = onTranscript;

      const startPromise = session.start();
      setTimeout(() => mockWebSocket.simulateConnection(), 0);
      await startPromise;
      jest.advanceTimersByTime(15);

      // Send multiple audio chunks
      const audioChunk1 = new ArrayBuffer(512);
      const audioChunk2 = new ArrayBuffer(512);
      const audioChunk3 = new ArrayBuffer(512);

      session.sendAudio(audioChunk1);
      session.sendAudio(audioChunk2);
      session.sendAudio(audioChunk3);
      session.commitAudio();

      // Only one transcript should be generated after commit
      jest.advanceTimersByTime(60);
      
      expect(onTranscript).toHaveBeenCalledTimes(1);
      expect(onTranscript).toHaveBeenCalledWith('Hello, I am ready for the interview.');
    });

    it('should handle mixed audio and text conversation', async () => {
      const onTranscript = jest.fn();
      const onTextResponse = jest.fn();
      
      session.onTranscript = onTranscript;
      session.onTextResponse = onTextResponse;

      const startPromise = session.start();
      setTimeout(() => mockWebSocket.simulateConnection(), 0);
      await startPromise;
      jest.advanceTimersByTime(15);

      // Audio message
      session.sendAudio(new ArrayBuffer(1024));
      session.commitAudio();
      jest.advanceTimersByTime(60);
      
      expect(onTranscript).toHaveBeenCalledWith('Hello, I am ready for the interview.');

      // Text message
      session.sendText('Can you hear me clearly?');
      jest.advanceTimersByTime(80);
      
      expect(onTextResponse).toHaveBeenCalledWith('Thank you for joining. ');

      // Another audio message
      session.sendAudio(new ArrayBuffer(512));
      session.commitAudio();
      jest.advanceTimersByTime(60);
      
      expect(onTranscript).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling Integration', () => {
    it('should recover from connection errors', async () => {
      const onError = jest.fn();
      const onDisconnect = jest.fn();
      
      session.onError = onError;
      session.onDisconnect = onDisconnect;

      // Start session
      const startPromise = session.start();
      setTimeout(() => mockWebSocket.simulateConnection(), 0);
      await startPromise;
      jest.advanceTimersByTime(15);

      expect(session.isActive).toBe(true);

      // Simulate connection error
      mockWebSocket.simulateClose(1006, 'Connection lost');
      
      expect(session.isActive).toBe(false);
      expect(onDisconnect).toHaveBeenCalledWith(1006, 'Connection lost');
    });

    it('should handle API errors gracefully', async () => {
      const onError = jest.fn();
      session.onError = onError;

      const startPromise = session.start();
      setTimeout(() => mockWebSocket.simulateConnection(), 0);
      await startPromise;
      jest.advanceTimersByTime(15);

      // Send invalid message to trigger error
      mockWebSocket.simulateMessage(mockAzureResponses.error);
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invalid_request_error',
          code: 'invalid_audio_format',
          message: 'Invalid audio format provided'
        })
      );
    });

    it('should handle invalid operations gracefully', async () => {
      // Try to send audio before session starts
      expect(() => {
        session.sendAudio(new ArrayBuffer(1024));
      }).toThrow('Session not started');

      // Try to send text before session starts
      expect(() => {
        session.sendText('Hello');
      }).toThrow('Session not started');

      // Try to update settings before session starts
      expect(() => {
        session.updateSettings({ temperature: 0.8 });
      }).toThrow('Session not started');
    });
  });

  describe('Performance and Latency Testing', () => {
    it('should measure end-to-end latency', async () => {
      const latencies: number[] = [];
      
      session.onTranscript = () => {
        latencies.push(Date.now());
      };

      const startPromise = session.start();
      setTimeout(() => mockWebSocket.simulateConnection(), 0);
      await startPromise;
      jest.advanceTimersByTime(15);

      const startTime = Date.now();
      
      // Send multiple audio messages
      for (let i = 0; i < 3; i++) {
        session.sendAudio(new ArrayBuffer(1024));
        session.commitAudio();
        jest.advanceTimersByTime(60);
      }

      // Verify transcripts were received
      expect(latencies).toHaveLength(3);
      
      // Check that latencies are reasonable (should be processed within timer advances)
      latencies.forEach((latency, index) => {
        expect(latency).toBeGreaterThan(startTime);
      });
    });

    it('should handle high-frequency audio chunks', async () => {
      const startPromise = session.start();
      setTimeout(() => mockWebSocket.simulateConnection(), 0);
      await startPromise;
      jest.advanceTimersByTime(15);

      // Send many small audio chunks rapidly
      const chunkCount = 50;
      for (let i = 0; i < chunkCount; i++) {
        session.sendAudio(new ArrayBuffer(64));
      }
      session.commitAudio();

      jest.advanceTimersByTime(60);

      // Should handle all chunks without errors
      expect(mockWebSocket.send).toHaveBeenCalledTimes(chunkCount + 2); // chunks + commit + session setup
    });
  });

  describe('Session Management Integration', () => {
    it('should handle session updates during active conversation', async () => {
      const onSessionReady = jest.fn();
      session.onSessionReady = onSessionReady;

      const startPromise = session.start();
      setTimeout(() => mockWebSocket.simulateConnection(), 0);
      await startPromise;
      jest.advanceTimersByTime(15);

      // Update settings mid-conversation
      session.updateSettings({
        temperature: 0.9,
        maxTokens: 200
      });

      jest.advanceTimersByTime(30);

      // Continue conversation after settings update
      session.sendText('How does this change affect responses?');
      jest.advanceTimersByTime(80);

      // Should continue working normally
      expect(session.isActive).toBe(true);
    });

    it('should maintain session state across multiple operations', async () => {
      const startPromise = session.start();
      setTimeout(() => mockWebSocket.simulateConnection(), 0);
      await startPromise;
      jest.advanceTimersByTime(15);

      const originalSessionId = session.sessionId;

      // Perform various operations
      session.sendAudio(new ArrayBuffer(1024));
      session.commitAudio();
      jest.advanceTimersByTime(60);

      session.sendText('Test message');
      jest.advanceTimersByTime(80);

      session.updateSettings({ temperature: 0.8 });
      jest.advanceTimersByTime(30);

      // Session ID should remain consistent
      expect(session.sessionId).toBe(originalSessionId);
      expect(session.isActive).toBe(true);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly cleanup resources on session stop', async () => {
      await session.start();
      mockWebSocket.simulateConnection();
      jest.advanceTimersByTime(15);

      expect(session.isActive).toBe(true);

      session.stop();

      expect(session.isActive).toBe(false);
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should handle multiple start/stop cycles', async () => {
      // First cycle
      await session.start();
      mockWebSocket.simulateConnection();
      jest.advanceTimersByTime(15);
      
      expect(session.isActive).toBe(true);
      
      session.stop();
      expect(session.isActive).toBe(false);

      // Second cycle - create new mock WebSocket instance
      mockWebSocket = new IntegrationMockWebSocket();
      mockWebSocketConstructor.mockImplementation(() => mockWebSocket);

      await session.start();
      mockWebSocket.simulateConnection();
      jest.advanceTimersByTime(15);
      
      expect(session.isActive).toBe(true);
      
      session.stop();
      expect(session.isActive).toBe(false);
    });
  });
});
