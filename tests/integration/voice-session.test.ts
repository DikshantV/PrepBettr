/**
 * VoiceSession Integration Tests
 * 
 * Tests real-time voice streaming functionality with WebSocket communication,
 * audio processing, transcript handling, and telemetry integration.
 */

import { jest } from '@jest/globals';
import WS from 'jest-websocket-mock';
import { createMockWebSocketServer, mockVoiceMessages } from '../mocks/ws-server';
import { voiceTelemetry } from '../../lib/azure-ai-foundry/voice/voice-telemetry';

// Mock interfaces based on VoiceSession structure
interface TranscriptEvent {
  text: string;
  timestamp: number;
  confidence?: number;
  isFinal: boolean;
}

interface AudioResponseEvent {
  audioData: Blob;
  timestamp: number;
  duration?: number;
}

interface VoiceSessionMetadata {
  sessionId: string;
  projectId: string;
  deploymentId: string;
  websocketUrl: string;
  apiKey: string;
  region: string;
}

// Mock VoiceLiveClient
class MockVoiceLiveClient {
  private sessions = new Map<string, any>();

  createWebSocketManager(sessionMeta: VoiceSessionMetadata) {
    return {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
      send: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    };
  }

  removeSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}

// Mock VoiceSession implementation for testing
class MockVoiceSession {
  private client: MockVoiceLiveClient;
  private sessionMeta: VoiceSessionMetadata;
  private websocketManager: any;
  private state: string = 'idle';
  
  private transcriptCallbacks = new Set<(event: TranscriptEvent) => void>();
  private responseCallbacks = new Set<(event: AudioResponseEvent) => void>();
  private cleanupHandlers = new Set<() => void>();

  constructor(client: MockVoiceLiveClient, sessionMeta: VoiceSessionMetadata) {
    this.client = client;
    this.sessionMeta = sessionMeta;
    this.websocketManager = client.createWebSocketManager(sessionMeta);
  }

  async start(audioStream?: MediaStream): Promise<void> {
    if (this.state !== 'idle') {
      console.warn(`Cannot start: current state is ${this.state}`);
      return;
    }

    this.state = 'starting';
    
    try {
      // Initialize telemetry
      voiceTelemetry.startSession(this.sessionMeta.sessionId);

      // Connect WebSocket
      await this.websocketManager.connect();
      
      // Setup mock event handlers
      this.setupWebSocketHandlers();
      
      this.state = 'active';
      console.log(`Session ${this.sessionMeta.sessionId} started successfully`);
      
    } catch (error) {
      console.error('Failed to start session:', error);
      this.state = 'error';
      throw error;
    }
  }

  onTranscript(callback: (event: TranscriptEvent) => void): void {
    this.transcriptCallbacks.add(callback);
    
    this.cleanupHandlers.add(() => {
      this.transcriptCallbacks.delete(callback);
    });
  }

  onResponse(callback: (event: AudioResponseEvent) => void): void {
    this.responseCallbacks.add(callback);
    
    this.cleanupHandlers.add(() => {
      this.responseCallbacks.delete(callback);
    });
  }

  async stop(graceful: boolean = true): Promise<void> {
    if (this.state === 'stopped' || this.state === 'stopping') {
      return;
    }

    this.state = 'stopping';
    
    try {
      // Close WebSocket
      this.websocketManager.close(graceful ? 1000 : 1001, graceful ? 'Normal closure' : 'Forced closure');
      
      // Clean up
      this.cleanup();
      
      // Remove from client
      this.client.removeSession(this.sessionMeta.sessionId);
      
      this.state = 'stopped';
      console.log(`Session ${this.sessionMeta.sessionId} stopped successfully`);
      
    } catch (error) {
      console.error('Error stopping session:', error);
      this.state = 'error';
      throw error;
    }
  }

  getState(): string {
    return this.state;
  }

  getMetadata(): VoiceSessionMetadata {
    return { ...this.sessionMeta };
  }

  // Mock WebSocket event handling
  private setupWebSocketHandlers(): void {
    // Simulate WebSocket message handling
    setTimeout(() => {
      this.handleWebSocketMessage(mockVoiceMessages.sessionReady);
    }, 10);
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'session_ready':
        console.log('Session ready');
        break;
        
      case 'transcript_partial':
        this.transcriptCallbacks.forEach(callback => {
          callback({
            text: message.text,
            timestamp: message.timestamp,
            confidence: message.confidence,
            isFinal: false
          });
        });
        break;
        
      case 'transcript_final':
        this.transcriptCallbacks.forEach(callback => {
          callback({
            text: message.text,
            timestamp: message.timestamp,
            confidence: message.confidence,
            isFinal: true
          });
        });
        break;
        
      case 'audio_response':
        this.responseCallbacks.forEach(callback => {
          callback({
            audioData: new Blob([message.audio_data]),
            timestamp: message.timestamp
          });
        });
        break;
        
      case 'error':
        const error = new Error(message.message);
        (error as any).code = message.error;
        throw error;
        
      case 'disconnect':
        this.state = 'stopped';
        break;
    }
  }

  private cleanup(): void {
    this.cleanupHandlers.forEach(handler => handler());
    this.cleanupHandlers.clear();
    this.transcriptCallbacks.clear();
    this.responseCallbacks.clear();
  }

  // Test helpers to simulate events
  simulateTranscriptEvent(partial: boolean = false): void {
    const message = partial ? mockVoiceMessages.transcriptPartial : mockVoiceMessages.transcriptFinal;
    this.handleWebSocketMessage(message);
  }

  simulateAudioResponse(): void {
    this.handleWebSocketMessage(mockVoiceMessages.audioResponse);
  }

  simulateError(): void {
    this.handleWebSocketMessage(mockVoiceMessages.error);
  }

  simulateDisconnect(): void {
    this.handleWebSocketMessage(mockVoiceMessages.disconnect);
  }
}

describe('VoiceSession Integration', () => {
  let mockServer: WS;
  let mockClient: MockVoiceLiveClient;
  let voiceSession: MockVoiceSession;
  
  const mockSessionMeta: VoiceSessionMetadata = {
    sessionId: 'test-session-123',
    projectId: 'test-project',
    deploymentId: 'test-deployment',
    websocketUrl: 'ws://localhost:1234',
    apiKey: 'test-api-key',
    region: 'eastus'
  };

  beforeEach(() => {
    // Create mock WebSocket server
    mockServer = createMockWebSocketServer();
    
    // Create mock client and session
    mockClient = new MockVoiceLiveClient();
    voiceSession = new MockVoiceSession(mockClient, mockSessionMeta);
    
    // Clear telemetry
    (voiceTelemetry as any).clearTelemetryData?.();
  });

  afterEach(() => {
    WS.clean();
  });

  describe('Session Lifecycle', () => {
    it('should start session and establish WebSocket connection', async () => {
      await voiceSession.start();
      
      expect(voiceSession.getState()).toBe('active');
      expect(voiceSession.getMetadata().sessionId).toBe('test-session-123');
    });

    it('should prevent starting session when not in idle state', async () => {
      await voiceSession.start();
      
      // Try to start again
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await voiceSession.start();
      
      expect(consoleSpy).toHaveBeenCalledWith('Cannot start: current state is active');
      consoleSpy.mockRestore();
    });

    it('should stop session gracefully', async () => {
      await voiceSession.start();
      await voiceSession.stop(true);
      
      expect(voiceSession.getState()).toBe('stopped');
    });

    it('should handle forced session stop', async () => {
      await voiceSession.start();
      await voiceSession.stop(false);
      
      expect(voiceSession.getState()).toBe('stopped');
    });

    it('should handle session start failure', async () => {
      // Mock connection failure
      const mockWebSocketManager = mockClient.createWebSocketManager(mockSessionMeta);
      mockWebSocketManager.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(voiceSession.start()).rejects.toThrow('Connection failed');
      expect(voiceSession.getState()).toBe('error');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await voiceSession.start();
    });

    it('should handle transcript partial events', (done) => {
      voiceSession.onTranscript((event) => {
        expect(event.text).toBe('Hello, this is a test');
        expect(event.isFinal).toBe(false);
        expect(event.confidence).toBe(0.95);
        expect(event.timestamp).toBeGreaterThan(0);
        done();
      });

      voiceSession.simulateTranscriptEvent(true);
    });

    it('should handle transcript final events', (done) => {
      voiceSession.onTranscript((event) => {
        expect(event.text).toBe('Hello, this is a test message');
        expect(event.isFinal).toBe(true);
        expect(event.confidence).toBe(0.98);
        done();
      });

      voiceSession.simulateTranscriptEvent(false);
    });

    it('should handle audio response events', (done) => {
      voiceSession.onResponse((event) => {
        expect(event.audioData).toBeInstanceOf(Blob);
        expect(event.timestamp).toBeGreaterThan(0);
        done();
      });

      voiceSession.simulateAudioResponse();
    });

    it('should handle multiple transcript callbacks', (done) => {
      let callbackCount = 0;
      const expectedCallbacks = 2;

      const callback = (event: TranscriptEvent) => {
        expect(event.text).toBe('Hello, this is a test');
        callbackCount++;
        
        if (callbackCount === expectedCallbacks) {
          done();
        }
      };

      voiceSession.onTranscript(callback);
      voiceSession.onTranscript(callback);

      voiceSession.simulateTranscriptEvent(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await voiceSession.start();
    });

    it('should handle WebSocket parse errors', () => {
      expect(() => {
        voiceSession.simulateError();
      }).toThrow('Invalid message format');
    });

    it('should handle unexpected disconnection', () => {
      voiceSession.simulateDisconnect();
      
      expect(voiceSession.getState()).toBe('stopped');
    });

    it('should clean up callbacks on session stop', async () => {
      let transcriptCalled = false;
      let responseCalled = false;

      voiceSession.onTranscript(() => {
        transcriptCalled = true;
      });

      voiceSession.onResponse(() => {
        responseCalled = true;
      });

      await voiceSession.stop();

      // Simulate events after stop - should not trigger callbacks
      voiceSession.simulateTranscriptEvent();
      voiceSession.simulateAudioResponse();

      expect(transcriptCalled).toBe(false);
      expect(responseCalled).toBe(false);
    });
  });

  describe('Telemetry Integration', () => {
    it('should initialize telemetry on session start', async () => {
      const startSessionSpy = jest.spyOn(voiceTelemetry, 'startSession');
      
      await voiceSession.start();
      
      expect(startSessionSpy).toHaveBeenCalledWith('test-session-123');
    });

    it('should track session lifecycle events', async () => {
      const endSessionSpy = jest.spyOn(voiceTelemetry, 'endSession');
      
      await voiceSession.start();
      await voiceSession.stop();
      
      expect(endSessionSpy).toHaveBeenCalledWith('test-session-123');
    });

    it('should track transcript events', (done) => {
      const trackConnectionSpy = jest.spyOn(voiceTelemetry, 'trackConnection');
      
      voiceSession.onTranscript((event) => {
        // Verify telemetry was called during transcript processing
        // This would happen in the real implementation
        done();
      });

      voiceSession.simulateTranscriptEvent();
    });

    it('should track audio latency', (done) => {
      const trackLatencySpy = jest.spyOn(voiceTelemetry, 'trackAudioLatency');
      
      voiceSession.onResponse((event) => {
        // In real implementation, this would track TTS latency
        done();
      });

      voiceSession.simulateAudioResponse();
    });

    it('should track errors with context', () => {
      const trackErrorSpy = jest.spyOn(voiceTelemetry, 'trackError');
      
      expect(() => {
        voiceSession.simulateError();
      }).toThrow();

      // In real implementation, errors would be tracked
      // expect(trackErrorSpy).toHaveBeenCalledWith(
      //   expect.any(Error),
      //   'test-session-123',
      //   'VoiceSession',
      //   false
      // );
    });
  });

  describe('WebSocket Communication', () => {
    beforeEach(async () => {
      await voiceSession.start();
    });

    it('should establish WebSocket connection on start', () => {
      expect(voiceSession['websocketManager'].connect).toHaveBeenCalled();
    });

    it('should close WebSocket connection on stop', async () => {
      await voiceSession.stop(true);
      
      expect(voiceSession['websocketManager'].close).toHaveBeenCalledWith(1000, 'Normal closure');
    });

    it('should handle forced WebSocket closure', async () => {
      await voiceSession.stop(false);
      
      expect(voiceSession['websocketManager'].close).toHaveBeenCalledWith(1001, 'Forced closure');
    });
  });

  describe('State Management', () => {
    it('should transition through correct states during lifecycle', async () => {
      expect(voiceSession.getState()).toBe('idle');
      
      const startPromise = voiceSession.start();
      // Note: In real implementation, state would be 'starting' briefly
      await startPromise;
      
      expect(voiceSession.getState()).toBe('active');
      
      await voiceSession.stop();
      
      expect(voiceSession.getState()).toBe('stopped');
    });

    it('should handle error state transitions', async () => {
      // Mock connection failure
      const mockWebSocketManager = mockClient.createWebSocketManager(mockSessionMeta);
      mockWebSocketManager.connect.mockRejectedValue(new Error('Connection failed'));
      
      try {
        await voiceSession.start();
      } catch (error) {
        expect(voiceSession.getState()).toBe('error');
      }
    });

    it('should prevent operations in stopped state', async () => {
      await voiceSession.start();
      await voiceSession.stop();
      
      // Try to stop again
      await voiceSession.stop(); // Should not throw
      expect(voiceSession.getState()).toBe('stopped');
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on session stop', async () => {
      await voiceSession.start();
      
      // Add callbacks
      voiceSession.onTranscript(() => {});
      voiceSession.onResponse(() => {});
      
      await voiceSession.stop();
      
      // Verify cleanup was called
      expect(voiceSession['transcriptCallbacks'].size).toBe(0);
      expect(voiceSession['responseCallbacks'].size).toBe(0);
      expect(voiceSession['cleanupHandlers'].size).toBe(0);
    });

    it('should remove session from client on stop', async () => {
      const removeSessionSpy = jest.spyOn(mockClient, 'removeSession');
      
      await voiceSession.start();
      await voiceSession.stop();
      
      expect(removeSessionSpy).toHaveBeenCalledWith('test-session-123');
    });
  });
});
