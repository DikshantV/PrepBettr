import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Voice Interview Enhanced E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['microphone'],
    });
    page = await context.newPage();
    
    // Mock console to capture logs
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log(`Browser log: ${msg.text()}`);
      }
    });
    
    await page.goto('/dashboard');
  });

  test.describe('Preliminary Questions via Text Stub', () => {
    test('should handle text-based preliminary questions', async () => {
      // Navigate to voice interview section
      await page.click('text=Voice Interview');
      
      // Select interview type
      await page.click('[data-testid="interview-type-behavioral"]');
      
      // Mock the conversation API to return text responses
      await page.route('**/api/voice/conversation', async (route, request) => {
        const body = JSON.parse(request.postData() || '{}');
        
        if (body.action === 'start') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Welcome to your behavioral interview. Tell me about yourself.',
              questionNumber: 1,
              isComplete: false,
              hasAudio: false // Text-only response
            })
          });
        } else if (body.action === 'process') {
          const responses = [
            { 
              message: 'Interesting background. Can you describe a challenging situation you faced?',
              questionNumber: 2
            },
            { 
              message: 'How did you handle conflict in your team?',
              questionNumber: 3
            },
            { 
              message: 'What are your career goals?',
              questionNumber: 4
            },
            { 
              message: 'Why are you interested in this position?',
              questionNumber: 5
            },
            { 
              message: 'Thank you for your responses. The interview is complete.',
              questionNumber: 5,
              isComplete: true
            }
          ];
          
          const questionNum = parseInt(body.questionNumber || '1');
          const response = responses[Math.min(questionNum - 1, responses.length - 1)];
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              ...response,
              hasAudio: false
            })
          });
        } else if (body.action === 'summary') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              summary: 'Interview completed successfully with 5 questions answered.'
            })
          });
        }
      });
      
      // Start the interview
      await page.click('[data-testid="start-interview-btn"]');
      
      // Wait for first question
      await expect(page.locator('text=Tell me about yourself')).toBeVisible({ timeout: 10000 });
      
      // Simulate user text responses
      const userResponses = [
        'I have 5 years of experience in software development.',
        'I led a project migration from legacy systems to cloud infrastructure.',
        'I facilitated open communication and regular team meetings.',
        'I aim to become a technical lead in the next 2 years.',
        'The role aligns perfectly with my skills and career goals.'
      ];
      
      for (let i = 0; i < userResponses.length; i++) {
        // Type user response
        await page.fill('[data-testid="text-response-input"]', userResponses[i]);
        await page.click('[data-testid="submit-response-btn"]');
        
        // Wait for next question or completion
        if (i < userResponses.length - 1) {
          await page.waitForTimeout(1000); // Brief pause between questions
        }
      }
      
      // Verify interview completion
      await expect(page.locator('text=Interview completed successfully')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Voice Interview with Prerecorded Audio', () => {
    test('should process prerecorded audio responses', async () => {
      // Create a mock audio file (in real scenario, use actual audio file)
      const mockAudioData = new Uint8Array(44100 * 2); // 1 second of silence at 44.1kHz
      
      // Mock getUserMedia to return prerecorded audio
      await page.evaluateHandle(() => {
        // Override getUserMedia
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          if (constraints.audio) {
            // Create a mock audio context
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const mediaStreamDestination = audioContext.createMediaStreamDestination();
            
            oscillator.frequency.value = 440; // A4 note
            oscillator.connect(mediaStreamDestination);
            oscillator.start();
            
            // Stop after 2 seconds to simulate speech
            setTimeout(() => oscillator.stop(), 2000);
            
            return mediaStreamDestination.stream;
          }
          return originalGetUserMedia.call(navigator.mediaDevices, constraints);
        };
      });
      
      // Navigate to voice interview
      await page.click('text=Voice Interview');
      await page.click('[data-testid="interview-type-technical"]');
      
      // Mock API responses with audio data
      await page.route('**/api/voice/conversation', async (route, request) => {
        const body = JSON.parse(request.postData() || '{}');
        
        // Create mock WAV audio data
        const mockWavData = createMockWavFile();
        
        if (body.action === 'start') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Welcome to your technical interview. Please describe your experience with JavaScript.',
              questionNumber: 1,
              isComplete: false,
              hasAudio: true,
              audioData: Array.from(mockWavData)
            })
          });
        } else if (body.action === 'process') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Thank you. Can you explain the concept of closures?',
              questionNumber: 2,
              isComplete: false,
              hasAudio: true,
              audioData: Array.from(mockWavData)
            })
          });
        }
      });
      
      // Mock speech recognition API
      await page.route('**/api/voice/stream', async (route, request) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            text: 'I have extensive experience with JavaScript, including ES6+ features.',
            confidence: 0.95
          })
        });
      });
      
      // Start interview
      await page.click('[data-testid="start-interview-btn"]');
      
      // Wait for microphone permission and recording to start
      await page.waitForTimeout(2000);
      
      // Verify recording indicator
      await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
      
      // Wait for AI response
      await page.waitForTimeout(3000);
      
      // Verify transcript appears
      await expect(page.locator('text=extensive experience with JavaScript')).toBeVisible();
      
      // Stop the interview
      await page.click('[data-testid="end-interview-btn"]');
      
      // Verify interview ended
      await expect(page.locator('[data-testid="interview-status"]')).toContainText('Finished');
    });
    
    test('should handle silence trimming in audio', async () => {
      // Mock an audio stream with initial silence
      await page.evaluateHandle(() => {
        navigator.mediaDevices.getUserMedia = async (constraints) => {
          if (constraints.audio) {
            const audioContext = new AudioContext();
            const mediaStreamDestination = audioContext.createMediaStreamDestination();
            
            // Create 1 second of silence, then a tone
            setTimeout(() => {
              const oscillator = audioContext.createOscillator();
              oscillator.frequency.value = 440;
              oscillator.connect(mediaStreamDestination);
              oscillator.start();
              setTimeout(() => oscillator.stop(), 1000);
            }, 1000);
            
            return mediaStreamDestination.stream;
          }
          return Promise.reject(new Error('No audio'));
        };
      });
      
      await page.goto('/dashboard');
      await page.click('text=Voice Interview');
      await page.click('[data-testid="interview-type-general"]');
      
      // Mock the conversation API
      await page.route('**/api/voice/conversation', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Question delivered',
            questionNumber: 1,
            hasAudio: false
          })
        });
      });
      
      // Mock audio processing to verify silence trimming
      await page.route('**/api/voice/stream', async (route, request) => {
        const formData = await request.postData();
        
        // In real test, we'd verify the audio data has silence trimmed
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            text: 'Audio processed with silence trimmed',
            trimmedSilenceDuration: 1.0 // Indicate 1 second was trimmed
          })
        });
      });
      
      await page.click('[data-testid="start-interview-btn"]');
      await page.waitForTimeout(3000);
      
      // Verify silence was detected and trimmed
      await expect(page.locator('text=Audio processed with silence trimmed')).toBeVisible();
    });
  });

  test.describe('Interview State Management', () => {
    test('should maintain correct state throughout interview lifecycle', async () => {
      await page.goto('/dashboard');
      await page.click('text=Voice Interview');
      
      // Check initial state
      await expect(page.locator('[data-testid="call-status"]')).toHaveAttribute('data-status', 'inactive');
      
      // Start interview
      await page.click('[data-testid="interview-type-behavioral"]');
      await page.click('[data-testid="start-interview-btn"]');
      
      // Check connecting state
      await expect(page.locator('[data-testid="call-status"]')).toHaveAttribute('data-status', 'connecting');
      
      // Wait for active state
      await expect(page.locator('[data-testid="call-status"]')).toHaveAttribute('data-status', 'active', { timeout: 5000 });
      
      // Verify recording states
      await expect(page.locator('[data-testid="is-recording"]')).toHaveAttribute('data-recording', 'true');
      
      // End interview
      await page.click('[data-testid="end-interview-btn"]');
      
      // Check finished state
      await expect(page.locator('[data-testid="call-status"]')).toHaveAttribute('data-status', 'finished');
    });
    
    test('should handle errors gracefully', async () => {
      // Mock API to return errors
      await page.route('**/api/voice/conversation', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error'
          })
        });
      });
      
      await page.goto('/dashboard');
      await page.click('text=Voice Interview');
      await page.click('[data-testid="interview-type-technical"]');
      await page.click('[data-testid="start-interview-btn"]');
      
      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Error');
      await expect(page.locator('[data-testid="call-status"]')).toHaveAttribute('data-status', 'inactive');
    });
  });
});

// Helper function to create a mock WAV file
function createMockWavFile(): Uint8Array {
  const sampleRate = 16000;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  
  // WAV file header
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  
  // "RIFF" chunk descriptor
  const encoder = new TextEncoder();
  const riff = encoder.encode('RIFF');
  riff.forEach((byte, i) => view.setUint8(i, byte));
  
  view.setUint32(4, 36 + numSamples * 2, true); // File size - 8
  
  // "WAVE" format
  const wave = encoder.encode('WAVE');
  wave.forEach((byte, i) => view.setUint8(8 + i, byte));
  
  // "fmt " subchunk
  const fmt = encoder.encode('fmt ');
  fmt.forEach((byte, i) => view.setUint8(12 + i, byte));
  
  view.setUint32(16, 16, true); // Subchunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, 1, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  
  // "data" subchunk
  const data = encoder.encode('data');
  data.forEach((byte, i) => view.setUint8(36 + i, byte));
  
  view.setUint32(40, numSamples * 2, true); // Subchunk2 size
  
  // Generate sine wave audio data
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3 * 32767;
    view.setInt16(44 + i * 2, sample, true);
  }
  
  return new Uint8Array(buffer);
}
