/**
 * E2E Tests for Voice Interview Flow
 * 
 * Validates the complete voice interview workflow including session creation,
 * audio streaming simulation, transcript processing, agent responses, error handling,
 * and interview completion.
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_USER = {
  name: 'Test User',
  email: 'test@example.com',
  userId: 'test-user-123'
};

const MOCK_INTERVIEW_CONFIG = {
  type: 'technical',
  questions: [
    'Tell me about your experience with React',
    'How do you handle state management?',
    'What is your approach to testing?'
  ]
};

// Mock WebSocket server responses
const mockWebSocketResponses = {
  sessionCreated: {
    type: 'session.created',
    session: {
      id: 'session_mock_123',
      model: 'gpt-4o-realtime-preview',
      voice: 'alloy',
      status: 'active'
    }
  },
  responseStart: {
    type: 'response.audio_transcript.delta',
    delta: 'Hello! Thank you for joining the interview today. '
  },
  responseComplete: {
    type: 'response.audio_transcript.done',
    transcript: 'Hello! Thank you for joining the interview today. Please tell me about your experience with React.'
  },
  transcriptDelta: {
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'I have been working with React for about 3 years now...'
  }
};

// Utility functions
async function mockVoiceAPIs(page: Page) {
  // Mock voice session creation API
  await page.route('/api/voice/session/start', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 'mock-session-123',
        wsUrl: 'ws://localhost:3001/mock-ws',
        token: 'mock-jwt-token',
        deploymentId: 'gpt-4o-realtime-preview'
      })
    });
  });

  // Mock voice session stop API
  await page.route('/api/voice/session/*/stop', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true })
    });
  });

  // Mock voice session transcript API
  await page.route('/api/voice/session/*/transcript', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transcript: [
          {
            id: 'transcript-1',
            timestamp: Date.now(),
            speaker: 'user',
            text: 'I have experience with React',
            confidence: 0.95
          },
          {
            id: 'transcript-2',
            timestamp: Date.now(),
            speaker: 'agent',
            text: 'That\'s great! Can you tell me more?',
            confidence: 1.0
          }
        ]
      })
    });
  });
}

async function mockWebSocket(page: Page) {
  // Mock WebSocket connection
  await page.addInitScript(() => {
    class MockWebSocket extends EventTarget {
      url: string;
      readyState: number = 1; // OPEN
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url: string) {
        super();
        this.url = url;
        
        // Simulate connection success
        setTimeout(() => {
          this.dispatchEvent(new Event('open'));
          
          // Send mock session created event
          setTimeout(() => {
            const sessionEvent = new MessageEvent('message', {
              data: JSON.stringify({
                type: 'session.created',
                session: {
                  id: 'mock-session-123',
                  model: 'gpt-4o-realtime-preview',
                  voice: 'alloy'
                }
              })
            });
            this.dispatchEvent(sessionEvent);
          }, 100);
        }, 50);
      }

      send(data: string) {
        // Mock processing user input
        const message = JSON.parse(data);
        
        if (message.type === 'input_audio_buffer.commit') {
          // Simulate transcript response
          setTimeout(() => {
            const transcriptEvent = new MessageEvent('message', {
              data: JSON.stringify({
                type: 'conversation.item.input_audio_transcription.completed',
                transcript: 'I have been working with React for about 3 years now and I really enjoy it.'
              })
            });
            this.dispatchEvent(transcriptEvent);
          }, 200);
          
          // Simulate AI response
          setTimeout(() => {
            const responseEvent = new MessageEvent('message', {
              data: JSON.stringify({
                type: 'response.audio_transcript.done',
                transcript: 'That\'s excellent! Can you tell me about a challenging React project you\'ve worked on?'
              })
            });
            this.dispatchEvent(responseEvent);
          }, 1000);
        }
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        this.dispatchEvent(new Event('close'));
      }

      // Add event listener methods
      addEventListener(type: string, listener: any) {
        super.addEventListener(type, listener);
      }

      removeEventListener(type: string, listener: any) {
        super.removeEventListener(type, listener);
      }
    }

    // Replace global WebSocket with mock
    (window as any).WebSocket = MockWebSocket;
  });
}

async function setupUserContext(page: Page) {
  // Mock authentication
  await page.addInitScript((user) => {
    localStorage.setItem('mockUser', JSON.stringify(user));
    
    // Mock auth verification endpoint
    (window as any).fetch = new Proxy((window as any).fetch, {
      apply: async (target, thisArg, args) => {
        const [url, options] = args;
        
        if (url.includes('/api/auth/verify')) {
          return Promise.resolve(new Response(JSON.stringify({
            success: true,
            user: user
          }), { status: 200 }));
        }
        
        return target.apply(thisArg, args);
      }
    });
  }, TEST_USER);
}

async function enableVoiceFeatureFlag(page: Page) {
  // Mock feature flag API
  await page.route('/api/config/features.voiceInterviewV2', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        key: 'features.voiceInterviewV2',
        value: true,
        source: 'default',
        success: true
      })
    });
  });
}

async function simulateAudioInput(page: Page) {
  // Mock getUserMedia for audio input
  await page.addInitScript(() => {
    const mockMediaStream = {
      getTracks: () => [
        {
          kind: 'audio',
          stop: () => {},
          addEventListener: () => {},
          removeEventListener: () => {}
        }
      ],
      getAudioTracks: () => [
        {
          kind: 'audio',
          stop: () => {},
          addEventListener: () => {},
          removeEventListener: () => {}
        }
      ]
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () => Promise.resolve(mockMediaStream),
        enumerateDevices: () => Promise.resolve([
          { kind: 'audioinput', deviceId: 'mock-mic', label: 'Mock Microphone' }
        ])
      },
      writable: true
    });

    // Mock AudioContext
    (window as any).AudioContext = class MockAudioContext {
      state = 'running';
      sampleRate = 16000;
      
      createMediaStreamSource() {
        return {
          connect: () => {},
          disconnect: () => {}
        };
      }
      
      createScriptProcessor() {
        const node = {
          connect: () => {},
          disconnect: () => {},
          onaudioprocess: null
        };
        
        // Simulate audio processing
        setTimeout(() => {
          if (node.onaudioprocess) {
            node.onaudioprocess({
              inputBuffer: {
                getChannelData: () => new Float32Array(1024).fill(0.1)
              }
            });
          }
        }, 100);
        
        return node;
      }
      
      resume() {
        return Promise.resolve();
      }
      
      close() {
        return Promise.resolve();
      }
    };
  });
}

// Test suite
test.describe('Voice Interview E2E Flow', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Setup mocks and context
    await setupUserContext(page);
    await enableVoiceFeatureFlag(page);
    await mockVoiceAPIs(page);
    await mockWebSocket(page);
    await simulateAudioInput(page);
  });

  test('should complete full voice interview workflow', async () => {
    // Navigate to interview page
    await page.goto('/dashboard/interview/technical');
    
    // Wait for page to load and feature flag to be checked
    await page.waitForLoadState('networkidle');
    
    // Verify Azure AI Foundry voice agent is loaded
    await expect(page.locator('[data-testid="foundry-voice-agent"]')).toBeVisible({ timeout: 10000 });
    
    // Check initial state
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/idle/i);
    await expect(page.locator('[data-testid="start-interview-btn"]')).toBeEnabled();
    
    // Start interview
    await page.locator('[data-testid="start-interview-btn"]').click();
    
    // Wait for session initialization
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/connecting/i, { timeout: 5000 });
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/connected/i, { timeout: 10000 });
    
    // Verify interview controls are now visible
    await expect(page.locator('[data-testid="start-recording-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="stop-recording-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="end-interview-btn"]')).toBeVisible();
    
    // Check that AI greeting appears in transcript
    await expect(page.locator('[data-testid="conversation-history"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="ai-message"]').first()).toContainText(/hello|greeting/i);
    
    // Simulate user recording interaction
    await page.locator('[data-testid="start-recording-btn"]').click();
    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-display"]')).toContainText(/listening/i);
    
    // Wait for mock audio processing
    await page.waitForTimeout(1000);
    
    // Stop recording to trigger transcription
    await page.locator('[data-testid="stop-recording-btn"]').click();
    await expect(page.locator('[data-testid="status-display"]')).toContainText(/processing/i);
    
    // Verify user transcript appears
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText(/react/i, { timeout: 5000 });
    
    // Wait for AI response
    await expect(page.locator('[data-testid="status-display"]')).toContainText(/speaking/i, { timeout: 3000 });
    
    // Verify AI response appears in conversation
    await expect(page.locator('[data-testid="ai-message"]').last()).toContainText(/challenging|project/i, { timeout: 5000 });
    
    // Check conversation state returns to ready
    await expect(page.locator('[data-testid="status-display"]')).toContainText(/ready/i, { timeout: 8000 });
    
    // Verify metrics are being tracked
    await expect(page.locator('[data-testid="session-metrics"]')).toBeVisible();
    
    // End interview
    await page.locator('[data-testid="end-interview-btn"]').click();
    
    // Verify cleanup
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/disconnected/i, { timeout: 5000 });
    await expect(page.locator('[data-testid="interview-completed"]')).toBeVisible();
  });

  test('should handle voice session connection errors', async () => {
    // Mock API to return error
    await page.route('/api/voice/session/start', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Connection failed' })
      });
    });

    await page.goto('/dashboard/interview/technical');
    await page.waitForLoadState('networkidle');
    
    // Attempt to start interview
    await page.locator('[data-testid="start-interview-btn"]').click();
    
    // Verify error state
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="connection-error"]')).toContainText(/connection failed/i);
    
    // Verify retry button appears
    await expect(page.locator('[data-testid="retry-connection-btn"]')).toBeVisible();
    
    // Mock successful retry
    await page.route('/api/voice/session/start', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: 'retry-session-123',
          wsUrl: 'ws://localhost:3001/mock-ws',
          token: 'mock-jwt-token'
        })
      });
    });
    
    // Attempt retry
    await page.locator('[data-testid="retry-connection-btn"]').click();
    
    // Verify successful connection after retry
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/connected/i, { timeout: 10000 });
    await expect(page.locator('[data-testid="connection-error"]')).not.toBeVisible();
  });

  test('should handle WebSocket disconnection gracefully', async () => {
    await page.goto('/dashboard/interview/technical');
    await page.waitForLoadState('networkidle');
    
    // Start interview successfully
    await page.locator('[data-testid="start-interview-btn"]').click();
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/connected/i, { timeout: 10000 });
    
    // Simulate WebSocket disconnection
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocketInstance;
      if (mockWs) {
        mockWs.dispatchEvent(new CloseEvent('close', { code: 1006, reason: 'Connection lost' }));
      }
    });
    
    // Verify disconnect handling
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/disconnected/i, { timeout: 5000 });
    await expect(page.locator('[data-testid="connection-error"]')).toContainText(/connection lost/i);
    
    // Verify auto-retry or manual retry options
    await expect(page.locator('[data-testid="retry-connection-btn"]')).toBeVisible();
  });

  test('should provide accessibility for voice interview controls', async () => {
    await page.goto('/dashboard/interview/technical');
    await page.waitForLoadState('networkidle');
    
    // Check ARIA labels and keyboard navigation
    const startBtn = page.locator('[data-testid="start-interview-btn"]');
    await expect(startBtn).toHaveAttribute('aria-label', /start.*interview/i);
    
    // Test keyboard navigation
    await startBtn.focus();
    await expect(startBtn).toBeFocused();
    
    // Start interview
    await startBtn.press('Enter');
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/connected/i, { timeout: 10000 });
    
    // Check recording button accessibility
    const recordBtn = page.locator('[data-testid="start-recording-btn"]');
    await expect(recordBtn).toHaveAttribute('aria-label', /start.*recording/i);
    await expect(recordBtn).toHaveAttribute('aria-pressed', 'false');
    
    // Test recording state accessibility
    await recordBtn.click();
    await expect(recordBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="recording-indicator"]')).toHaveAttribute('aria-live', 'polite');
  });

  test('should measure and track performance metrics', async () => {
    await page.goto('/dashboard/interview/technical');
    await page.waitForLoadState('networkidle');
    
    // Track session creation latency
    const startTime = Date.now();
    await page.locator('[data-testid="start-interview-btn"]').click();
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/connected/i, { timeout: 10000 });
    const connectionTime = Date.now() - startTime;
    
    // Verify reasonable connection time (should be under 5 seconds for mocked connection)
    expect(connectionTime).toBeLessThan(5000);
    
    // Check that metrics are being displayed
    const metricsPanel = page.locator('[data-testid="session-metrics"]');
    await expect(metricsPanel).toBeVisible();
    
    // Verify latency metrics are tracked
    await expect(metricsPanel).toContainText(/latency/i);
    await expect(metricsPanel).toContainText(/accuracy/i);
    
    // Test transcript processing latency
    await page.locator('[data-testid="start-recording-btn"]').click();
    const transcriptStart = Date.now();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="stop-recording-btn"]').click();
    
    // Wait for transcript to appear
    await expect(page.locator('[data-testid="user-message"]').last()).toBeVisible({ timeout: 3000 });
    const transcriptTime = Date.now() - transcriptStart;
    
    // Verify reasonable transcript processing time
    expect(transcriptTime).toBeLessThan(3000);
  });

  test('should handle interview completion and feedback generation', async () => {
    await page.goto('/dashboard/interview/technical');
    await page.waitForLoadState('networkidle');
    
    // Mock feedback generation API
    await page.route('/api/feedback', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            feedbackId: 'feedback-123',
            summary: 'Great interview performance!'
          })
        });
      }
    });
    
    // Start and complete interview
    await page.locator('[data-testid="start-interview-btn"]').click();
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/connected/i, { timeout: 10000 });
    
    // Simulate completing all questions (mock auto-completion)
    await page.evaluate(() => {
      // Trigger interview completion through state management
      (window as any).__TEST_COMPLETE_INTERVIEW__ = true;
    });
    
    // End interview
    await page.locator('[data-testid="end-interview-btn"]').click();
    
    // Verify completion state
    await expect(page.locator('[data-testid="interview-completed"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="feedback-button"]')).toBeVisible();
    
    // Verify feedback generation
    await expect(page.locator('[data-testid="feedback-status"]')).toContainText(/generated/i, { timeout: 8000 });
    
    // Test navigation to feedback
    await page.locator('[data-testid="feedback-button"]').click();
    await expect(page).toHaveURL(/.*feedback.*/);
  });

  test('should support multiple concurrent sessions (edge case)', async () => {
    // This test ensures the system handles multiple tabs/sessions gracefully
    const context = page.context();
    const page2 = await context.newPage();
    
    await setupUserContext(page2);
    await enableVoiceFeatureFlag(page2);
    await mockVoiceAPIs(page2);
    await mockWebSocket(page2);
    await simulateAudioInput(page2);
    
    // Start interview in first page
    await page.goto('/dashboard/interview/technical');
    await page.locator('[data-testid="start-interview-btn"]').click();
    await expect(page.locator('[data-testid="session-status"]')).toHaveText(/connected/i, { timeout: 10000 });
    
    // Attempt to start interview in second page
    await page2.goto('/dashboard/interview/behavioral');
    await page2.locator('[data-testid="start-interview-btn"]').click();
    
    // Should either:
    // 1. Show warning about existing session
    // 2. Terminate first session and start new one
    // 3. Queue the second session
    
    // Verify one of these behaviors
    const warningVisible = await page2.locator('[data-testid="existing-session-warning"]').isVisible();
    const secondSessionConnected = await page2.locator('[data-testid="session-status"]').textContent();
    
    if (warningVisible) {
      await expect(page2.locator('[data-testid="existing-session-warning"]')).toContainText(/already.*active/i);
    } else if (secondSessionConnected?.includes('connected')) {
      // Second session started, verify first is terminated
      await expect(page.locator('[data-testid="session-status"]')).toHaveText(/disconnected/i, { timeout: 5000 });
    }
  });
});
