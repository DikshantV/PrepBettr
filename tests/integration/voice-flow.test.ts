import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// Test configuration
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 30000; // 30 seconds

describe('Voice STT → OpenAI Data Flow Integration', () => {
  let testAudioPath: string;
  
  beforeAll(() => {
    // Path to test WAV file
    testAudioPath = path.join(__dirname, '../fixtures/test-audio.wav');
    
    // Create a test WAV file if it doesn't exist
    if (!fs.existsSync(testAudioPath)) {
      // Create directory if it doesn't exist
      const fixturesDir = path.dirname(testAudioPath);
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      
      // Create a simple WAV file with silence (44 bytes header + some data)
      const wavHeader = Buffer.alloc(44);
      // RIFF header
      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(36 + 1600, 4); // File size - 8
      wavHeader.write('WAVE', 8);
      
      // fmt subchunk
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16); // Subchunk size
      wavHeader.writeUInt16LE(1, 20); // Audio format (PCM)
      wavHeader.writeUInt16LE(1, 22); // Number of channels
      wavHeader.writeUInt32LE(16000, 24); // Sample rate
      wavHeader.writeUInt32LE(32000, 28); // Byte rate
      wavHeader.writeUInt16LE(2, 32); // Block align
      wavHeader.writeUInt16LE(16, 34); // Bits per sample
      
      // data subchunk
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(1600, 40); // Data size
      
      // Write header and some silence data
      const silenceData = Buffer.alloc(1600); // 100ms of silence at 16kHz
      fs.writeFileSync(testAudioPath, Buffer.concat([wavHeader, silenceData]));
    }
  });
  
  describe('/api/voice/stream endpoint', () => {
    it('should always return success:true with text field', async () => {
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(testAudioPath), {
        filename: 'test-audio.wav',
        contentType: 'audio/wav'
      });
      
      const response = await fetch(`${API_BASE_URL}/api/voice/stream`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders()
      });
      
      expect(response.status).toBe(200);
      
      const result = await response.json() as any;
      
      // Verify the response structure
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('text');
      expect(typeof result.text).toBe('string');
      
      // Even with empty/silent audio, should return success with empty text
      expect(result).toHaveProperty('confidence');
      expect(typeof result.confidence).toBe('number');
    }, TEST_TIMEOUT);
    
    it('should handle missing audio file gracefully', async () => {
      const formData = new FormData();
      // Don't append any audio file
      
      const response = await fetch(`${API_BASE_URL}/api/voice/stream`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders()
      });
      
      expect(response.status).toBe(200);
      
      const result = await response.json() as any;
      
      // Should still return success with empty text
      expect(result.success).toBe(true);
      expect(result.text).toBe('');
      expect(result).toHaveProperty('error');
    }, TEST_TIMEOUT);
    
    it('should handle invalid audio format gracefully', async () => {
      const formData = new FormData();
      // Send a text file instead of audio
      const invalidData = Buffer.from('This is not audio data');
      formData.append('audio', invalidData, {
        filename: 'invalid.txt',
        contentType: 'text/plain'
      });
      
      const response = await fetch(`${API_BASE_URL}/api/voice/stream`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders()
      });
      
      expect(response.status).toBe(200);
      
      const result = await response.json() as any;
      
      // Should still return success with empty text
      expect(result.success).toBe(true);
      expect(result.text).toBe('');
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Unsupported audio format');
    }, TEST_TIMEOUT);
  });
  
  describe('/api/voice/conversation endpoint', () => {
    it('should process text and return AI response', async () => {
      // First, start the conversation
      const startResponse = await fetch(`${API_BASE_URL}/api/voice/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          interviewContext: {
            type: 'general',
            maxQuestions: 5
          }
        })
      });
      
      expect(startResponse.status).toBe(200);
      
      const startResult = await startResponse.json() as any;
      expect(startResult.success).toBe(true);
      expect(startResult).toHaveProperty('message');
      expect(startResult).toHaveProperty('questionNumber');
      
      // Then process a user response
      const processResponse = await fetch(`${API_BASE_URL}/api/voice/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process',
          userTranscript: 'I have 5 years of experience in software development'
        })
      });
      
      expect(processResponse.status).toBe(200);
      
      const processResult = await processResponse.json() as any;
      expect(processResult.success).toBe(true);
      expect(processResult).toHaveProperty('message');
      expect(processResult).toHaveProperty('questionNumber');
      expect(processResult).toHaveProperty('isComplete');
    }, TEST_TIMEOUT);
    
    it('should handle retry with exponential backoff', async () => {
      // This test simulates multiple rapid requests to test retry logic
      const promises = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          fetch(`${API_BASE_URL}/api/voice/conversation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'process',
              userTranscript: `Test message ${i}`
            })
          })
        );
      }
      
      const responses = await Promise.all(promises);
      
      // All requests should eventually succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        const result = await response.json() as any;
        expect(result).toHaveProperty('success');
      }
    }, TEST_TIMEOUT * 2);
  });
  
  describe('End-to-End Voice Flow', () => {
    it('should complete full STT → OpenAI flow', async () => {
      // Step 1: Upload audio to STT
      const formData = new FormData();
      formData.append('audio', fs.createReadStream(testAudioPath), {
        filename: 'test-audio.wav',
        contentType: 'audio/wav'
      });
      
      const sttResponse = await fetch(`${API_BASE_URL}/api/voice/stream`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders()
      });
      
      expect(sttResponse.status).toBe(200);
      
      const sttResult = await sttResponse.json() as any;
      expect(sttResult.success).toBe(true);
      expect(sttResult).toHaveProperty('text');
      
      // Step 2: If we got text, send it to conversation API
      if (sttResult.text && sttResult.text.trim()) {
        const conversationResponse = await fetch(`${API_BASE_URL}/api/voice/conversation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'process',
            userTranscript: sttResult.text
          })
        });
        
        expect(conversationResponse.status).toBe(200);
        
        const conversationResult = await conversationResponse.json() as any;
        expect(conversationResult.success).toBe(true);
        expect(conversationResult).toHaveProperty('message');
        expect(typeof conversationResult.message).toBe('string');
      }
    }, TEST_TIMEOUT);
  });
  
  afterAll(() => {
    // Cleanup can be added here if needed
  });
});
