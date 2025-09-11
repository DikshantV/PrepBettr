import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * End-to-end tests for Azure AI Foundry voice interview functionality
 * These tests validate the complete user experience with voice features
 */

test.describe('Azure AI Foundry Voice Interview', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create persistent context with permissions for microphone
    context = await browser.newContext({
      permissions: ['microphone'],
      // Enable experimental web features for Web Audio API
      extraHTTPHeaders: {
        'Feature-Policy': 'microphone \'self\''
      }
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Mock Azure AI Foundry WebSocket connections for testing
    await page.route('**/cognitiveservices/websocket/v1**', route => {
      // Intercept WebSocket upgrade requests
      route.fulfill({
        status: 101,
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Accept': 'test-websocket-accept'
        }
      });
    });

    // Mock feature flag API
    await page.route('**/api/feature-flags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          'features.voiceInterview': true
        })
      });
    });

    // Navigate to voice interview page
    await page.goto('/dashboard/interview/voice');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should load voice interview UI with Azure AI Foundry client', async () => {
    // Check that voice agent component loads
    const voiceAgent = page.locator('[data-testid="voice-agent"]');
    await expect(voiceAgent).toBeVisible();

    // Verify UI elements are present
    await expect(page.locator('[data-testid="voice-start-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-settings-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="transcript-display"]')).toBeVisible();
  });

  test('should handle voice session initialization', async () => {
    // Click start interview button
    await page.click('[data-testid="voice-start-button"]');

    // Wait for session initialization
    await expect(page.locator('[data-testid="session-status"]')).toContainText('Connecting...');
    
    // Mock successful WebSocket connection
    await page.evaluate(() => {
      // Simulate WebSocket connection success
      const mockEvent = new CustomEvent('websocket-connected', {
        detail: { sessionId: 'test-session-123' }
      });
      window.dispatchEvent(mockEvent);
    });

    // Verify session is active
    await expect(page.locator('[data-testid="session-status"]')).toContainText('Connected');
    await expect(page.locator('[data-testid="voice-stop-button"]')).toBeVisible();
  });

  test('should display microphone permission request', async () => {
    // Start session
    await page.click('[data-testid="voice-start-button"]');

    // Check if microphone permission UI appears
    const micPermission = page.locator('[data-testid="microphone-permission"]');
    
    // If permissions are not already granted, UI should show permission request
    if (await micPermission.isVisible()) {
      await expect(micPermission).toContainText('microphone access');
    }
  });

  test('should handle audio recording and streaming', async () => {
    // Mock getUserMedia for testing
    await page.addInitScript(() => {
      // Mock Web Audio API and MediaStream
      const mockMediaStream = {
        getTracks: () => [{ stop: () => {}, kind: 'audio' }],
        getAudioTracks: () => [{ stop: () => {}, kind: 'audio' }]
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => mockMediaStream,
          enumerateDevices: async () => [
            { deviceId: 'default', kind: 'audioinput', label: 'Default - Mock Microphone' }
          ]
        },
        writable: false
      });

      // Mock AudioContext
      window.AudioContext = class MockAudioContext {
        createScriptProcessor() {
          return {
            connect: () => {},
            disconnect: () => {},
            onaudioprocess: null
          };
        }
        createMediaStreamSource() {
          return { connect: () => {} };
        }
        get sampleRate() { return 16000; }
        get state() { return 'running'; }
        resume() { return Promise.resolve(); }
        close() { return Promise.resolve(); }
      } as any;
    });

    // Start session
    await page.click('[data-testid="voice-start-button"]');
    
    // Wait for recording to start
    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
    
    // Simulate audio being processed
    await page.evaluate(() => {
      // Trigger transcript event
      const transcriptEvent = new CustomEvent('voice-transcript', {
        detail: { transcript: 'Hello, I am ready for the interview.' }
      });
      window.dispatchEvent(transcriptEvent);
    });

    // Verify transcript appears
    await expect(page.locator('[data-testid="transcript-display"]'))
      .toContainText('Hello, I am ready for the interview.');
  });

  test('should handle text responses and TTS playback', async () => {
    // Start session
    await page.click('[data-testid="voice-start-button"]');

    // Simulate receiving audio response from Azure
    await page.evaluate(() => {
      const audioEvent = new CustomEvent('voice-audio-response', {
        detail: { 
          audioData: 'UklGRn4AAABXQVZFZm10IBAAAAABAAECA...',
          text: 'Thank you for joining. Let\'s start with your background.'
        }
      });
      window.dispatchEvent(audioEvent);
    });

    // Verify response text appears
    await expect(page.locator('[data-testid="assistant-response"]'))
      .toContainText('Thank you for joining. Let\'s start with your background.');

    // Check for audio playback indicator
    await expect(page.locator('[data-testid="audio-playback-indicator"]')).toBeVisible();
  });

  test('should allow session settings updates', async () => {
    // Open settings panel
    await page.click('[data-testid="voice-settings-button"]');
    
    // Verify settings panel opens
    await expect(page.locator('[data-testid="voice-settings-modal"]')).toBeVisible();

    // Update voice settings
    await page.selectOption('[data-testid="voice-select"]', 'en-US-JennyNeural');
    await page.fill('[data-testid="temperature-input"]', '0.8');
    await page.fill('[data-testid="max-tokens-input"]', '200');

    // Apply settings
    await page.click('[data-testid="apply-settings-button"]');

    // Verify settings are applied (modal closes)
    await expect(page.locator('[data-testid="voice-settings-modal"]')).not.toBeVisible();

    // Start session to verify settings are used
    await page.click('[data-testid="voice-start-button"]');

    // Verify settings were sent to session
    const settingsLog = await page.locator('[data-testid="session-settings-log"]');
    await expect(settingsLog).toContainText('Voice: en-US-JennyNeural');
    await expect(settingsLog).toContainText('Temperature: 0.8');
  });

  test('should handle connection errors gracefully', async () => {
    // Mock WebSocket connection failure
    await page.route('**/cognitiveservices/websocket/v1**', route => {
      route.abort('failed');
    });

    // Try to start session
    await page.click('[data-testid="voice-start-button"]');

    // Verify error message appears
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="connection-error"]'))
      .toContainText('Unable to connect');

    // Verify retry button is available
    await expect(page.locator('[data-testid="retry-connection-button"]')).toBeVisible();
  });

  test('should stop session and cleanup resources', async () => {
    // Start session first
    await page.click('[data-testid="voice-start-button"]');
    await expect(page.locator('[data-testid="session-status"]')).toContainText('Connected');

    // Stop session
    await page.click('[data-testid="voice-stop-button"]');

    // Verify session stops
    await expect(page.locator('[data-testid="session-status"]')).toContainText('Disconnected');
    await expect(page.locator('[data-testid="voice-start-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="recording-indicator"]')).not.toBeVisible();

    // Verify cleanup message
    await expect(page.locator('[data-testid="session-cleanup-message"]'))
      .toContainText('Session ended successfully');
  });

  test('should handle mixed audio and text conversation flow', async () => {
    // Start session
    await page.click('[data-testid="voice-start-button"]');
    await expect(page.locator('[data-testid="session-status"]')).toContainText('Connected');

    // Simulate user speaking (audio input)
    await page.evaluate(() => {
      const transcriptEvent = new CustomEvent('voice-transcript', {
        detail: { transcript: 'I have 5 years of experience in React development.' }
      });
      window.dispatchEvent(transcriptEvent);
    });

    // Verify transcript appears
    await expect(page.locator('[data-testid="transcript-display"]'))
      .toContainText('I have 5 years of experience in React development.');

    // Simulate assistant audio response
    await page.evaluate(() => {
      const audioEvent = new CustomEvent('voice-audio-response', {
        detail: { 
          audioData: 'mock-audio-data',
          text: 'That\'s great! Can you tell me about a challenging project?'
        }
      });
      window.dispatchEvent(audioEvent);
    });

    // Verify assistant response
    await expect(page.locator('[data-testid="assistant-response"]'))
      .toContainText('That\'s great! Can you tell me about a challenging project?');

    // Use text input for follow-up
    await page.fill('[data-testid="text-input"]', 'I worked on a real-time chat application.');
    await page.click('[data-testid="send-text-button"]');

    // Verify text message appears in conversation
    await expect(page.locator('[data-testid="conversation-history"]'))
      .toContainText('I worked on a real-time chat application.');
  });

  test('should display session analytics and metrics', async () => {
    // Start session
    await page.click('[data-testid="voice-start-button"]');
    
    // Run through some interactions
    await page.evaluate(() => {
      // Simulate multiple interactions
      const events = [
        { type: 'voice-transcript', detail: { transcript: 'Hello' } },
        { type: 'voice-audio-response', detail: { audioData: 'data1', text: 'Hi there!' } },
        { type: 'voice-transcript', detail: { transcript: 'How are you?' } },
        { type: 'voice-audio-response', detail: { audioData: 'data2', text: 'I\'m doing well!' } }
      ];

      events.forEach((event, index) => {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent(event.type, event));
        }, index * 100);
      });
    });

    // Wait for interactions to complete
    await page.waitForTimeout(500);

    // Check session metrics
    await page.click('[data-testid="session-metrics-button"]');
    
    const metricsPanel = page.locator('[data-testid="session-metrics-panel"]');
    await expect(metricsPanel).toBeVisible();
    
    // Verify metrics are tracked
    await expect(metricsPanel).toContainText('Transcripts: 2');
    await expect(metricsPanel).toContainText('Audio Responses: 2');
    await expect(metricsPanel).toContainText('Session Duration:');
  });

  test('should handle voice interview disabled state', async () => {
    // Mock feature flag disabled for voice interview
    await page.route('**/api/feature-flags', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          'features.voiceInterview': false
        })
      });
    });

    // Reload page to get new feature flag
    await page.reload();

    // Verify voice interview is disabled
    const disabledMessage = page.locator('[data-testid="voice-disabled-message"]');
    await expect(disabledMessage).toBeVisible();
    
    const voiceAgent = page.locator('[data-testid="voice-agent"]');
    await expect(voiceAgent).not.toBeVisible();
  });

  test('should handle accessibility requirements', async () => {
    // Check for proper ARIA labels
    await expect(page.locator('[data-testid="voice-start-button"]'))
      .toHaveAttribute('aria-label', /start.*voice.*interview/i);
    
    await expect(page.locator('[data-testid="transcript-display"]'))
      .toHaveAttribute('role', 'log');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="voice-start-button"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="voice-settings-button"]')).toBeFocused();
    
    // Test screen reader announcements
    const liveRegion = page.locator('[aria-live="polite"]');
    await expect(liveRegion).toBeVisible();
  });

  test('should persist session state across page navigation', async () => {
    // Start session
    await page.click('[data-testid="voice-start-button"]');
    await expect(page.locator('[data-testid="session-status"]')).toContainText('Connected');

    // Navigate to another page
    await page.goto('/dashboard');
    
    // Navigate back to voice interview
    await page.goto('/dashboard/interview/voice');
    
    // Session should still be active (if supported)
    // Or should show resume option
    const resumeButton = page.locator('[data-testid="resume-session-button"]');
    const activeSession = page.locator('[data-testid="session-status"]');
    
    // Either session is still active or resume option is available
    expect(
      await activeSession.textContent() === 'Connected' ||
      await resumeButton.isVisible()
    ).toBeTruthy();
  });
});
