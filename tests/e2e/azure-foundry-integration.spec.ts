/**
 * Azure AI Foundry Integration E2E Tests
 * 
 * Comprehensive end-to-end tests covering the complete Azure AI Foundry
 * integration workflow including resume processing, voice interviews,
 * multi-agent coordination, and API endpoint validation.
 * 
 * @version 2.0.0
 */

import { test, expect, Page, Browser, BrowserContext } from '@playwright/test';
import { 
  SAMPLE_RESUMES, 
  INTERVIEW_SCENARIOS, 
  PERFORMANCE_THRESHOLDS,
  AUDIO_TEST_DATA 
} from '../utils/foundry-fixtures';

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_USER = {
  email: 'test-foundry-user@prepbettr.com',
  password: 'TestPassword123!',
  name: 'Test Foundry User'
};

// Helper functions
async function loginUser(page: Page) {
  await page.goto(`${BASE_URL}/sign-in`);
  await page.fill('[data-testid="email-input"]', TEST_USER.email);
  await page.fill('[data-testid="password-input"]', TEST_USER.password);
  await page.click('[data-testid="sign-in-button"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

async function uploadResume(page: Page, resumeType: keyof typeof SAMPLE_RESUMES) {
  const resume = SAMPLE_RESUMES[resumeType];
  
  // Navigate to resume upload
  await page.goto(`${BASE_URL}/dashboard/resume-upload`);
  
  // Upload resume file (mock file upload)
  const fileInput = page.locator('[data-testid="resume-file-input"]');
  await fileInput.setInputFiles({
    name: resume.fileName,
    mimeType: 'application/pdf',
    buffer: Buffer.from(JSON.stringify(resume.content))
  });
  
  await page.click('[data-testid="upload-resume-button"]');
  await page.waitForSelector('[data-testid="upload-success-message"]');
}

async function startVoiceInterview(page: Page, scenario: keyof typeof INTERVIEW_SCENARIOS) {
  const interviewData = INTERVIEW_SCENARIOS[scenario];
  
  await page.goto(`${BASE_URL}/dashboard/interview`);
  
  // Configure interview settings
  await page.fill('[data-testid="job-role-input"]', interviewData.jobRole);
  await page.fill('[data-testid="company-name-input"]', interviewData.companyName);
  await page.selectOption('[data-testid="interview-type-select"]', 'voice');
  await page.selectOption('[data-testid="difficulty-select"]', interviewData.difficulty);
  
  // Start interview
  await page.click('[data-testid="start-interview-button"]');
  await page.waitForSelector('[data-testid="voice-interview-interface"]');
  
  return interviewData;
}

test.describe('Azure AI Foundry Integration', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser: b }) => {
    browser = b;
  });

  test.beforeEach(async () => {
    context = await browser.newContext({
      permissions: ['microphone'],
      // Enable microphone for voice tests
      extraHTTPHeaders: {
        'feature-policy': 'microphone=*'
      }
    });
    page = await context.newPage();
    
    // Mock WebRTC and microphone access
    await page.addInitScript(() => {
      // Mock getUserMedia
      navigator.mediaDevices.getUserMedia = async () => {
        const stream = new MediaStream();
        const track = {
          kind: 'audio',
          enabled: true,
          readyState: 'live',
          stop: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        } as any;
        stream.addTrack(track);
        return stream;
      };
      
      // Mock Web Audio API
      window.AudioContext = class MockAudioContext {
        createMediaStreamSource() { return { connect: () => {}, disconnect: () => {} }; }
        createScriptProcessor() { 
          return { 
            connect: () => {}, 
            disconnect: () => {},
            onaudioprocess: null
          }; 
        }
        createAnalyser() { return { connect: () => {}, disconnect: () => {} }; }
        createGain() { return { connect: () => {}, disconnect: () => {}, gain: { value: 1 } }; }
        get destination() { return { connect: () => {}, disconnect: () => {} }; }
        get sampleRate() { return 44100; }
        close() { return Promise.resolve(); }
        resume() { return Promise.resolve(); }
      } as any;
    });
    
    await loginUser(page);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('End-to-End Interview Workflow', () => {
    test('should complete full interview workflow: resume upload → parsing → voice interview', async () => {
      // Step 1: Upload resume
      await test.step('Upload and process resume', async () => {
        await uploadResume(page, 'SENIOR_DEVELOPER');
        
        // Verify resume processing
        await expect(page.locator('[data-testid="resume-status"]')).toContainText('Processed');
        
        // Check extracted skills and experience
        await page.click('[data-testid="view-resume-details"]');
        await expect(page.locator('[data-testid="extracted-skills"]')).toContainText('JavaScript');
        await expect(page.locator('[data-testid="extracted-skills"]')).toContainText('TypeScript');
        await expect(page.locator('[data-testid="experience-years"]')).toContainText('8+');
      });

      // Step 2: Generate interview questions
      await test.step('Generate AI interview questions', async () => {
        await page.click('[data-testid="generate-questions-button"]');
        await page.waitForSelector('[data-testid="questions-generated"]');
        
        const questions = await page.locator('[data-testid="generated-question"]').count();
        expect(questions).toBeGreaterThan(3);
        
        // Verify questions are relevant to resume
        const firstQuestion = await page.locator('[data-testid="generated-question"]').first().textContent();
        expect(firstQuestion).toMatch(/microservices|architecture|leadership|TypeScript|Node\.js/i);
      });

      // Step 3: Start voice interview
      await test.step('Conduct voice interview session', async () => {
        const interviewData = await startVoiceInterview(page, 'TECHNICAL_BACKEND');
        
        // Wait for voice session to initialize
        await page.waitForSelector('[data-testid="voice-status-connected"]', { timeout: 10000 });
        
        // Verify interview UI elements
        await expect(page.locator('[data-testid="candidate-name"]')).toContainText(interviewData.candidateName);
        await expect(page.locator('[data-testid="job-role"]')).toContainText(interviewData.jobRole);
        await expect(page.locator('[data-testid="company-name"]')).toContainText(interviewData.companyName);
        
        // Check microphone controls
        await expect(page.locator('[data-testid="mic-button"]')).toBeVisible();
        await expect(page.locator('[data-testid="end-interview-button"]')).toBeVisible();
      });

      // Step 4: Simulate voice interaction
      await test.step('Simulate voice interaction', async () => {
        // Click mic to start recording
        await page.click('[data-testid="mic-button"]');
        await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
        
        // Simulate speaking (wait for voice processing)
        await page.waitForTimeout(2000);
        
        // Stop recording
        await page.click('[data-testid="mic-button"]');
        await expect(page.locator('[data-testid="recording-indicator"]')).toBeHidden();
        
        // Wait for transcript
        await page.waitForSelector('[data-testid="transcript-text"]', { timeout: 5000 });
        await expect(page.locator('[data-testid="transcript-text"]')).not.toBeEmpty();
        
        // Wait for AI response
        await page.waitForSelector('[data-testid="ai-response"]', { timeout: 8000 });
        await expect(page.locator('[data-testid="ai-response"]')).not.toBeEmpty();
        
        // Verify audio playback indicator
        await expect(page.locator('[data-testid="audio-playing"]')).toBeVisible();
      });

      // Step 5: Complete interview and verify results
      await test.step('Complete interview and review results', async () => {
        // End interview
        await page.click('[data-testid="end-interview-button"]');
        await page.waitForSelector('[data-testid="interview-summary"]');
        
        // Verify interview summary
        await expect(page.locator('[data-testid="interview-duration"]')).toBeVisible();
        await expect(page.locator('[data-testid="questions-asked"]')).toContainText(/\d+/);
        await expect(page.locator('[data-testid="transcript-available"]')).toBeVisible();
        
        // Check performance metrics
        await expect(page.locator('[data-testid="voice-quality-score"]')).toBeVisible();
        await expect(page.locator('[data-testid="response-time-avg"]')).toBeVisible();
        
        // Verify interview is saved
        await page.goto(`${BASE_URL}/dashboard/interviews`);
        await expect(page.locator('[data-testid="interview-history-item"]').first()).toBeVisible();
      });
    });

    test('should handle interview with insufficient resume data gracefully', async () => {
      await uploadResume(page, 'MALFORMED');
      
      // Should show warning about incomplete data
      await expect(page.locator('[data-testid="resume-warning"]')).toContainText('incomplete');
      
      // Should still allow interview to proceed with generic questions
      const interviewData = await startVoiceInterview(page, 'ENTRY_LEVEL_FRONTEND');
      
      await page.waitForSelector('[data-testid="voice-status-connected"]');
      await expect(page.locator('[data-testid="generic-questions-notice"]')).toBeVisible();
    });
  });

  test.describe('Multi-Agent Handoff', () => {
    test('should seamlessly transition between technical and behavioral agents', async () => {
      await uploadResume(page, 'SENIOR_DEVELOPER');
      await startVoiceInterview(page, 'TECHNICAL_BACKEND');
      
      await page.waitForSelector('[data-testid="voice-status-connected"]');
      
      // Start with technical questions
      await test.step('Technical interview phase', async () => {
        await expect(page.locator('[data-testid="current-agent"]')).toContainText('Technical');
        
        // Simulate technical Q&A
        await page.click('[data-testid="mic-button"]');
        await page.waitForTimeout(1500);
        await page.click('[data-testid="mic-button"]');
        
        await page.waitForSelector('[data-testid="transcript-text"]');
        await page.waitForSelector('[data-testid="ai-response"]');
      });

      // Trigger agent handoff
      await test.step('Agent handoff transition', async () => {
        // Click transition button or wait for automatic transition
        await page.click('[data-testid="transition-to-behavioral"]');
        
        // Verify handoff is occurring
        await expect(page.locator('[data-testid="agent-transition"]')).toBeVisible();
        await page.waitForSelector('[data-testid="agent-transition"]', { state: 'hidden' });
        
        // Verify new agent is active
        await expect(page.locator('[data-testid="current-agent"]')).toContainText('Behavioral');
      });

      // Continue with behavioral questions
      await test.step('Behavioral interview phase', async () => {
        // Verify behavioral context is maintained
        await expect(page.locator('[data-testid="interview-context"]')).toContainText('leadership');
        
        // Test voice interaction with new agent
        await page.click('[data-testid="mic-button"]');
        await page.waitForTimeout(1500);
        await page.click('[data-testid="mic-button"]');
        
        await page.waitForSelector('[data-testid="transcript-text"]');
        await page.waitForSelector('[data-testid="ai-response"]');
        
        // Verify behavioral question style
        const response = await page.locator('[data-testid="ai-response"]').textContent();
        expect(response).toMatch(/team|leadership|challenge|experience/i);
      });

      // Verify context continuity
      await test.step('Verify context continuity', async () => {
        // Check that previous conversation is maintained
        await page.click('[data-testid="view-full-transcript"]');
        
        const transcript = await page.locator('[data-testid="full-transcript"]').textContent();
        expect(transcript).toContain('Technical');
        expect(transcript).toContain('Behavioral');
        
        // Verify smooth transition markers
        expect(transcript).toMatch(/transition|moving to|behavioral/i);
      });
    });

    test('should handle agent handoff failures gracefully', async () => {
      await uploadResume(page, 'SENIOR_DEVELOPER');
      await startVoiceInterview(page, 'TECHNICAL_BACKEND');
      
      // Simulate handoff failure by intercepting API calls
      await page.route('**/api/interview/handoff', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Agent handoff failed' })
        });
      });
      
      await page.waitForSelector('[data-testid="voice-status-connected"]');
      await page.click('[data-testid="transition-to-behavioral"]');
      
      // Should show error but maintain current session
      await expect(page.locator('[data-testid="handoff-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="current-agent"]')).toContainText('Technical');
      
      // Interview should continue with current agent
      await page.click('[data-testid="continue-interview"]');
      await expect(page.locator('[data-testid="handoff-error"]')).toBeHidden();
    });
  });

  test.describe('API Endpoint Validation', () => {
    test('should validate voice stream endpoints', async () => {
      let streamStarted = false;
      let streamEnded = false;
      
      // Monitor API calls
      page.on('request', request => {
        if (request.url().includes('/api/voice/stream')) {
          streamStarted = true;
        }
        if (request.url().includes('/api/voice/end')) {
          streamEnded = true;
        }
      });
      
      await startVoiceInterview(page, 'TECHNICAL_BACKEND');
      await page.waitForSelector('[data-testid="voice-status-connected"]');
      
      expect(streamStarted).toBe(true);
      
      await page.click('[data-testid="end-interview-button"]');
      await page.waitForSelector('[data-testid="interview-summary"]');
      
      expect(streamEnded).toBe(true);
    });

    test('should handle API errors gracefully', async () => {
      // Mock API failures
      await page.route('**/api/voice/stream', route => {
        route.fulfill({
          status: 503,
          body: JSON.stringify({ error: 'Service temporarily unavailable' })
        });
      });
      
      await startVoiceInterview(page, 'TECHNICAL_BACKEND');
      
      // Should show appropriate error message
      await expect(page.locator('[data-testid="connection-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="connection-error"]')).toContainText('temporarily unavailable');
      
      // Should provide fallback options
      await expect(page.locator('[data-testid="fallback-text-mode"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-connection"]')).toBeVisible();
    });

    test('should enforce quota limits', async () => {
      // Mock quota exceeded response
      await page.route('**/api/interview/start', route => {
        route.fulfill({
          status: 429,
          body: JSON.stringify({ 
            error: 'Quota exceeded',
            quotaType: 'voice_interviews',
            resetTime: Date.now() + 3600000
          })
        });
      });
      
      await page.goto(`${BASE_URL}/dashboard/interview`);
      await page.click('[data-testid="start-interview-button"]');
      
      // Should show quota exceeded message
      await expect(page.locator('[data-testid="quota-exceeded"]')).toBeVisible();
      await expect(page.locator('[data-testid="quota-reset-time"]')).toBeVisible();
      await expect(page.locator('[data-testid="upgrade-plan-button"]')).toBeVisible();
    });
  });

  test.describe('Mobile Compatibility', () => {
    test('should work on mobile viewport with touch controls', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await uploadResume(page, 'ENTRY_LEVEL');
      await startVoiceInterview(page, 'ENTRY_LEVEL_FRONTEND');
      
      await page.waitForSelector('[data-testid="voice-status-connected"]');
      
      // Verify mobile-optimized UI
      await expect(page.locator('[data-testid="mobile-voice-controls"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-mic-button"]')).toBeVisible();
      
      // Test touch interaction
      await page.tap('[data-testid="mobile-mic-button"]');
      await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
      
      // Verify mobile transcript display
      await page.tap('[data-testid="mobile-mic-button"]');
      await page.waitForSelector('[data-testid="mobile-transcript"]');
      await expect(page.locator('[data-testid="mobile-transcript"]')).toBeVisible();
      
      // Test mobile-specific features
      await expect(page.locator('[data-testid="mobile-progress-bar"]')).toBeVisible();
      await expect(page.locator('[data-testid="mobile-question-counter"]')).toBeVisible();
    });

    test('should handle mobile audio permissions properly', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Mock denied microphone permission
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = async () => {
          throw new Error('Permission denied');
        };
      });
      
      await startVoiceInterview(page, 'ENTRY_LEVEL_FRONTEND');
      
      // Should show permission request UI
      await expect(page.locator('[data-testid="mic-permission-request"]')).toBeVisible();
      await expect(page.locator('[data-testid="permission-instructions"]')).toContainText('microphone access');
      
      // Should provide fallback to text-based interview
      await page.click('[data-testid="use-text-mode"]');
      await expect(page.locator('[data-testid="text-interview-interface"]')).toBeVisible();
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should maintain performance under typical load', async () => {
      const startTime = Date.now();
      
      await uploadResume(page, 'SENIOR_DEVELOPER');
      const uploadTime = Date.now() - startTime;
      
      expect(uploadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DOCUMENT_PROCESSING.RESUME_PARSE_TIME);
      
      const voiceStartTime = Date.now();
      await startVoiceInterview(page, 'TECHNICAL_BACKEND');
      await page.waitForSelector('[data-testid="voice-status-connected"]');
      const voiceConnectionTime = Date.now() - voiceStartTime;
      
      expect(voiceConnectionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VOICE_SESSION.CONNECTION_TIMEOUT);
      
      // Test voice latency
      const responseStartTime = Date.now();
      await page.click('[data-testid="mic-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="mic-button"]');
      
      await page.waitForSelector('[data-testid="ai-response"]');
      const responseTime = Date.now() - responseStartTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VOICE_SESSION.FIRST_RESPONSE_TIME * 2);
    });

    test('should handle concurrent voice sessions', async () => {
      // This test would ideally run with multiple browser contexts
      // For now, we'll test rapid session cycling
      
      const sessions = 3;
      const sessionTimes = [];
      
      for (let i = 0; i < sessions; i++) {
        const startTime = Date.now();
        
        await startVoiceInterview(page, 'TECHNICAL_BACKEND');
        await page.waitForSelector('[data-testid="voice-status-connected"]');
        
        const sessionTime = Date.now() - startTime;
        sessionTimes.push(sessionTime);
        
        await page.click('[data-testid="end-interview-button"]');
        await page.waitForSelector('[data-testid="interview-summary"]');
        
        // Navigate back for next iteration
        if (i < sessions - 1) {
          await page.goto(`${BASE_URL}/dashboard/interview`);
        }
      }
      
      // Verify consistent performance
      const avgSessionTime = sessionTimes.reduce((a, b) => a + b, 0) / sessions;
      expect(avgSessionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.VOICE_SESSION.CONNECTION_TIMEOUT);
      
      // Check for performance degradation
      const maxSessionTime = Math.max(...sessionTimes);
      const minSessionTime = Math.min(...sessionTimes);
      expect(maxSessionTime - minSessionTime).toBeLessThan(2000); // Max 2s variation
    });
  });

  test.describe('Error Recovery and Resilience', () => {
    test('should recover from network interruptions', async () => {
      await startVoiceInterview(page, 'TECHNICAL_BACKEND');
      await page.waitForSelector('[data-testid="voice-status-connected"]');
      
      // Simulate network interruption
      await context.setOffline(true);
      
      // Should detect disconnection
      await expect(page.locator('[data-testid="connection-lost"]')).toBeVisible();
      
      // Restore network
      await context.setOffline(false);
      
      // Should attempt reconnection
      await expect(page.locator('[data-testid="reconnecting"]')).toBeVisible();
      await expect(page.locator('[data-testid="voice-status-connected"]')).toBeVisible({ timeout: 10000 });
      
      // Interview should continue normally
      await page.click('[data-testid="mic-button"]');
      await page.waitForTimeout(1000);
      await page.click('[data-testid="mic-button"]');
      
      await page.waitForSelector('[data-testid="transcript-text"]');
    });

    test('should handle Azure service outages gracefully', async () => {
      // Mock Azure service unavailable
      await page.route('**/api/voice/**', route => {
        route.fulfill({
          status: 503,
          body: JSON.stringify({ error: 'Azure services temporarily unavailable' })
        });
      });
      
      await startVoiceInterview(page, 'TECHNICAL_BACKEND');
      
      // Should show service outage message
      await expect(page.locator('[data-testid="service-outage"]')).toBeVisible();
      await expect(page.locator('[data-testid="fallback-options"]')).toBeVisible();
      
      // Should offer alternative interview methods
      await page.click('[data-testid="switch-to-text-interview"]');
      await expect(page.locator('[data-testid="text-interview-interface"]')).toBeVisible();
    });
  });
});
