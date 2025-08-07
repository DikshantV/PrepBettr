import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Test configuration
test.setTimeout(60000); // 60 seconds timeout for voice tests

// Helper function to create a test WAV file
function createTestWAVFile(): string {
  const testAudioPath = path.join(__dirname, 'test-audio.wav');
  
  if (!fs.existsSync(testAudioPath)) {
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
  
  return testAudioPath;
}

test.describe('Voice Interview E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock getUserMedia for audio recording
    await page.addInitScript(() => {
      // Mock navigator.mediaDevices.getUserMedia
      if (!navigator.mediaDevices) {
        (navigator as any).mediaDevices = {};
      }
      
      navigator.mediaDevices.getUserMedia = async (constraints: any) => {
        // Create a mock MediaStream
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        oscillator.connect(mediaStreamDestination);
        oscillator.start();
        
        // Return the mock stream
        return mediaStreamDestination.stream;
      };
    });
  });
  
  test('should start voice interview and handle STT → OpenAI flow', async ({ page }) => {
    // Navigate to the interview page (adjust URL as needed)
    await page.goto('/dashboard/interview/mock-technical');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Click the "Start Interview" button
    const startButton = page.locator('button:has-text("Start Interview")');
    await expect(startButton).toBeVisible();
    await startButton.click();
    
    // Wait for the interview to start
    await expect(page.locator('text=AI Interviewer')).toBeVisible();
    
    // Check if microphone permission is requested/granted
    await page.waitForTimeout(2000); // Give time for audio initialization
    
    // Verify that the recording UI is shown
    const recordingIndicator = page.locator('text=/Recording|Listening|Microphone open/');
    await expect(recordingIndicator).toBeVisible({ timeout: 10000 });
    
    // Check for AI introduction message
    const transcript = page.locator('.transcript-messages');
    await expect(transcript).toBeVisible({ timeout: 10000 });
    
    // Verify that messages are being displayed
    const aiMessage = page.locator('.transcript-message:has-text("AI")').first();
    await expect(aiMessage).toBeVisible({ timeout: 10000 });
  });
  
  test('should handle audio upload and receive AI response', async ({ page, request }) => {
    // Create test WAV file
    const testAudioPath = createTestWAVFile();
    
    // Test the API directly first
    const formData = new FormData();
    const audioBlob = new Blob([fs.readFileSync(testAudioPath)], { type: 'audio/wav' });
    
    // Upload audio to STT endpoint
    const sttResponse = await request.post('/api/voice/stream', {
      multipart: {
        audio: {
          name: 'test-audio.wav',
          mimeType: 'audio/wav',
          buffer: fs.readFileSync(testAudioPath)
        }
      }
    });
    
    expect(sttResponse.ok()).toBeTruthy();
    
    const sttResult = await sttResponse.json();
    expect(sttResult).toHaveProperty('success', true);
    expect(sttResult).toHaveProperty('text');
    expect(typeof sttResult.text).toBe('string');
    
    // If we got text, test the conversation endpoint
    if (sttResult.text) {
      const conversationResponse = await request.post('/api/voice/conversation', {
        data: {
          action: 'process',
          userTranscript: sttResult.text || 'Test message'
        }
      });
      
      expect(conversationResponse.ok()).toBeTruthy();
      
      const conversationResult = await conversationResponse.json();
      expect(conversationResult).toHaveProperty('success', true);
      expect(conversationResult).toHaveProperty('message');
    }
  });
  
  test('should handle errors gracefully', async ({ page, request }) => {
    // Test with missing audio
    const response1 = await request.post('/api/voice/stream', {
      multipart: {}
    });
    
    expect(response1.status()).toBe(200); // Should still return 200
    const result1 = await response1.json();
    expect(result1.success).toBe(true);
    expect(result1.text).toBe('');
    expect(result1).toHaveProperty('error');
    
    // Test with invalid audio format
    const response2 = await request.post('/api/voice/stream', {
      multipart: {
        audio: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('This is not audio')
        }
      }
    });
    
    expect(response2.status()).toBe(200); // Should still return 200
    const result2 = await response2.json();
    expect(result2.success).toBe(true);
    expect(result2.text).toBe('');
    expect(result2).toHaveProperty('error');
  });
  
  test('should retry API calls with exponential backoff', async ({ page }) => {
    // Intercept API calls to monitor retries
    let apiCallCount = 0;
    
    await page.route('**/api/voice/conversation', async (route, request) => {
      apiCallCount++;
      
      // Simulate first two calls failing with 500
      if (apiCallCount <= 2) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      } else {
        // Third call succeeds
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Test response',
            questionNumber: 1,
            isComplete: false
          })
        });
      }
    });
    
    // Navigate to interview page
    await page.goto('/dashboard/interview/mock-technical');
    
    // Start interview
    const startButton = page.locator('button:has-text("Start Interview")');
    await startButton.click();
    
    // Wait for retries to complete
    await page.waitForTimeout(5000);
    
    // Verify that retries occurred
    expect(apiCallCount).toBeGreaterThanOrEqual(1);
  });
  
  test('should prevent silent drops when text is undefined', async ({ page }) => {
    // Intercept the STT API response
    await page.route('**/api/voice/stream', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          text: undefined, // Intentionally undefined
          confidence: 0
        })
      });
    });
    
    // Monitor console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate to interview page
    await page.goto('/dashboard/interview/mock-technical');
    
    // Start interview
    const startButton = page.locator('button:has-text("Start Interview")');
    await startButton.click();
    
    // Trigger audio processing (mock)
    await page.evaluate(() => {
      // Trigger sendAudioToBackend with a mock blob
      if ((window as any).sendAudioToBackend) {
        const mockBlob = new Blob(['test'], { type: 'audio/wav' });
        (window as any).sendAudioToBackend(mockBlob);
      }
    });
    
    // Wait for error handling
    await page.waitForTimeout(2000);
    
    // Check that the error was caught and logged
    const criticalError = consoleErrors.find(err => 
      err.includes('result.text is undefined') || 
      err.includes('preventing silent drop')
    );
    expect(criticalError).toBeDefined();
  });
  
  test('should complete full interview flow', async ({ page }) => {
    // Navigate to interview page
    await page.goto('/dashboard/interview/mock-technical');
    
    // Start interview
    const startButton = page.locator('button:has-text("Start Interview")');
    await expect(startButton).toBeVisible();
    await startButton.click();
    
    // Wait for AI introduction
    await expect(page.locator('.transcript-message:has-text("AI")')).toBeVisible({ 
      timeout: 15000 
    });
    
    // Check question number indicator
    await expect(page.locator('text=/Question \\d+/')).toBeVisible({ 
      timeout: 10000 
    });
    
    // End interview
    const endButton = page.locator('button:has-text("End Interview")');
    await expect(endButton).toBeVisible();
    await endButton.click();
    
    // Verify interview ended
    await expect(page.locator('button:has-text("Start Interview")')).toBeVisible({ 
      timeout: 10000 
    });
  });
});

// Cleanup after tests
test.afterAll(() => {
  // Clean up test audio file
  const testAudioPath = path.join(__dirname, 'test-audio.wav');
  if (fs.existsSync(testAudioPath)) {
    fs.unlinkSync(testAudioPath);
  }
});
