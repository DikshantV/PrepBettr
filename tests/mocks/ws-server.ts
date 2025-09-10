/**
 * WebSocket Mock Server for Voice Session Tests
 */

import WS from 'jest-websocket-mock';

export function createMockWebSocketServer(url = 'ws://localhost:1234'): WS {
  return new WS(url);
}

// Mock voice message payloads
export const mockVoiceMessages = {
  sessionReady: {
    type: 'session_ready',
    session_id: 'test-session-123',
    timestamp: Date.now()
  },
  
  transcriptPartial: {
    type: 'transcript_partial',
    text: 'Hello, this is a test',
    confidence: 0.95,
    timestamp: Date.now()
  },
  
  transcriptFinal: {
    type: 'transcript_final',
    text: 'Hello, this is a test message',
    confidence: 0.98,
    timestamp: Date.now()
  },
  
  audioResponse: {
    type: 'audio_response',
    audio_data: 'base64EncodedAudioData==',
    format: 'wav',
    timestamp: Date.now()
  },
  
  error: {
    type: 'error',
    error: 'PARSE_ERROR',
    message: 'Invalid message format',
    timestamp: Date.now()
  },
  
  disconnect: {
    type: 'disconnect',
    code: 1006,
    reason: 'Connection lost',
    timestamp: Date.now()
  }
};
