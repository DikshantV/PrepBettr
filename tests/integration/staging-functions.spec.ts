import { test, expect } from '@playwright/test';

// Test configuration for staging environment
const STAGING_BASE_URL = process.env.STAGING_BASE_URL || 'https://prepbettr-staging.vercel.app';
const FIREBASE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';

test.describe('Staging Functions Integration Tests', () => {
  test.beforeAll(async ({ request }) => {
    // Setup test data in Firestore emulator
    await request.post('http://localhost:8080/emulator/v1/projects/test-project/databases/(default)/documents:clear');
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to staging environment
    await page.goto(STAGING_BASE_URL);
  });

  test.describe('Interview Generation Flow', () => {
    test('should create interview with job description', async ({ page, request }) => {
      // Mock authentication for testing
      await page.addInitScript(() => {
        window.localStorage.setItem('test_user', JSON.stringify({
          uid: 'test-user-staging',
          email: 'test@staging.com'
        }));
      });

      // Navigate to interview creation
      await page.goto(`${STAGING_BASE_URL}/dashboard/interviews/new`);

      // Fill job details
      await page.fill('[data-testid="job-title-input"]', 'Senior Frontend Developer');
      await page.fill('[data-testid="company-input"]', 'Tech Innovations Inc.');
      
      const jobDescription = `
        We are seeking a Senior Frontend Developer with expertise in React, TypeScript, and modern web technologies.
        
        Requirements:
        - 5+ years of React development experience
        - Strong TypeScript skills
        - Experience with state management (Redux, Zustand)
        - Knowledge of testing frameworks (Jest, React Testing Library)
        - Familiarity with CI/CD pipelines
      `;
      
      await page.fill('[data-testid="job-description-textarea"]', jobDescription);

      // Submit interview creation
      await page.click('[data-testid="generate-interview-button"]');

      // Wait for interview generation (this hits staging Cloud Functions)
      await expect(page.locator('[data-testid="interview-questions-container"]')).toBeVisible({ timeout: 30000 });

      // Verify questions were generated
      const questions = page.locator('[data-testid="interview-question"]');
      await expect(questions).toHaveCount(5); // Assuming 5 questions are generated

      // Verify questions are relevant to the job
      const firstQuestion = await questions.first().textContent();
      expect(firstQuestion).toMatch(/(React|TypeScript|JavaScript|Frontend)/i);

      // Verify data is stored in Firestore emulator
      const response = await request.get(
        `http://${FIREBASE_EMULATOR_HOST}/emulator/v1/projects/test-project/databases/(default)/documents/interviews`,
        {
          headers: {
            'Authorization': 'Bearer test-token',
          }
        }
      );
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.documents).toBeDefined();
      expect(data.documents.length).toBeGreaterThan(0);
    });

    test('should handle interview generation errors gracefully', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('test_user', JSON.stringify({
          uid: 'test-user-error',
          email: 'test@staging.com'
        }));
      });

      await page.goto(`${STAGING_BASE_URL}/dashboard/interviews/new`);

      // Submit with invalid data to trigger error
      await page.fill('[data-testid="job-title-input"]', '');
      await page.fill('[data-testid="company-input"]', '');
      await page.click('[data-testid="generate-interview-button"]');

      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      const errorText = await page.locator('[data-testid="error-message"]').textContent();
      expect(errorText).toContain('Job title is required');
    });
  });

  test.describe('Resume Processing Flow', () => {
    test('should upload and process resume file', async ({ page, request }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('test_user', JSON.stringify({
          uid: 'test-user-resume',
          email: 'resume@staging.com'
        }));
      });

      await page.goto(`${STAGING_BASE_URL}/dashboard/resumes/upload`);

      // Create a test PDF file (mock)
      const testPdfContent = Buffer.from('Mock PDF content for testing');
      
      // Upload file
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('[data-testid="file-upload-button"]');
      const fileChooser = await fileChooserPromise;
      
      await fileChooser.setFiles({
        name: 'test-resume.pdf',
        mimeType: 'application/pdf',
        buffer: testPdfContent,
      });

      // Wait for processing (hits staging Cloud Functions for text extraction)
      await expect(page.locator('[data-testid="resume-processing-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="resume-processing-complete"]')).toBeVisible({ timeout: 30000 });

      // Verify extracted sections are displayed
      await expect(page.locator('[data-testid="resume-sections-container"]')).toBeVisible();
      await expect(page.locator('[data-testid="resume-summary-section"]')).toBeVisible();

      // Verify data is stored in Firestore emulator
      const response = await request.get(
        `http://${FIREBASE_EMULATOR_HOST}/emulator/v1/projects/test-project/databases/(default)/documents/resumes`,
        {
          headers: {
            'Authorization': 'Bearer test-token',
          }
        }
      );
      
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.documents).toBeDefined();
    });

    test('should handle unsupported file types', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('test_user', JSON.stringify({
          uid: 'test-user-invalid-file',
          email: 'test@staging.com'
        }));
      });

      await page.goto(`${STAGING_BASE_URL}/dashboard/resumes/upload`);

      // Try to upload unsupported file type
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('[data-testid="file-upload-button"]');
      const fileChooser = await fileChooserPromise;
      
      await fileChooser.setFiles({
        name: 'test-image.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake image content'),
      });

      // Verify error message
      await expect(page.locator('[data-testid="file-type-error"]')).toBeVisible();
      const errorText = await page.locator('[data-testid="file-type-error"]').textContent();
      expect(errorText).toContain('Unsupported file type');
    });
  });

  test.describe('Voice Interview Flow', () => {
    test('should start voice interview session', async ({ page, browserName }) => {
      // Skip Safari for voice tests due to limited WebRTC support in testing
      test.skip(browserName === 'webkit', 'Voice tests not reliable in WebKit');

      await page.addInitScript(() => {
        window.localStorage.setItem('test_user', JSON.stringify({
          uid: 'test-user-voice',
          email: 'voice@staging.com'
        }));
      });

      // Grant microphone permissions
      await page.context().grantPermissions(['microphone']);

      await page.goto(`${STAGING_BASE_URL}/dashboard/interviews/voice/new`);

      // Start voice interview
      await page.click('[data-testid="start-voice-interview-button"]');

      // Wait for microphone access and Azure Speech Service connection
      await expect(page.locator('[data-testid="voice-status-connected"]')).toBeVisible({ timeout: 10000 });

      // Verify voice controls are available
      await expect(page.locator('[data-testid="mute-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="end-interview-button"]')).toBeVisible();

      // Simulate voice interaction (in real test, this would use actual audio)
      await page.click('[data-testid="next-question-button"]');
      
      // Verify question progression
      const questionText = page.locator('[data-testid="current-question-text"]');
      await expect(questionText).toBeVisible();
      
      // End interview
      await page.click('[data-testid="end-interview-button"]');
      
      // Verify interview completion
      await expect(page.locator('[data-testid="interview-completed"]')).toBeVisible();
    });

    test('should handle voice recognition errors', async ({ page, browserName }) => {
      test.skip(browserName === 'webkit', 'Voice tests not reliable in WebKit');

      await page.addInitScript(() => {
        window.localStorage.setItem('test_user', JSON.stringify({
          uid: 'test-user-voice-error',
          email: 'voice-error@staging.com'
        }));
      });

      await page.goto(`${STAGING_BASE_URL}/dashboard/interviews/voice/new`);

      // Deny microphone permissions to trigger error
      await page.context().clearPermissions();
      
      await page.click('[data-testid="start-voice-interview-button"]');

      // Verify error handling
      await expect(page.locator('[data-testid="microphone-error"]')).toBeVisible({ timeout: 10000 });
      const errorMessage = await page.locator('[data-testid="microphone-error"]').textContent();
      expect(errorMessage).toContain('microphone access');
    });
  });

  test.describe('API Integration Tests', () => {
    test('should handle rate limiting properly', async ({ request }) => {
      const requests = [];
      
      // Send multiple rapid requests to test rate limiting
      for (let i = 0; i < 10; i++) {
        requests.push(
          request.post(`${STAGING_BASE_URL}/api/interviews/generate`, {
            data: {
              jobTitle: `Test Job ${i}`,
              company: 'Test Company',
              jobDescription: 'Test description'
            },
            headers: {
              'Authorization': 'Bearer test-token'
            }
          })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should succeed, others should be rate limited
      const successCount = responses.filter(r => r.status() === 200).length;
      const rateLimitedCount = responses.filter(r => r.status() === 429).length;
      
      expect(successCount).toBeGreaterThan(0);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should validate API authentication', async ({ request }) => {
      // Test without authentication
      const response = await request.post(`${STAGING_BASE_URL}/api/interviews/generate`, {
        data: {
          jobTitle: 'Test Job',
          company: 'Test Company'
        }
      });

      expect(response.status()).toBe(401);
    });

    test('should handle malformed requests', async ({ request }) => {
      const response = await request.post(`${STAGING_BASE_URL}/api/interviews/generate`, {
        data: {
          // Missing required fields
          invalidField: 'invalid'
        },
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData.error).toContain('validation');
    });
  });

  test.describe('Firebase Integration', () => {
    test('should respect Firestore security rules', async ({ request }) => {
      // Try to access another user's data
      const response = await request.get(
        `${STAGING_BASE_URL}/api/interviews/user-123-interviews`,
        {
          headers: {
            'Authorization': 'Bearer different-user-token'
          }
        }
      );

      expect(response.status()).toBe(403);
    });

    test('should handle Firestore connection issues', async ({ page }) => {
      // Simulate Firestore connection issue by intercepting requests
      await page.route('**/firestore.googleapis.com/**', route => {
        route.abort();
      });

      await page.addInitScript(() => {
        window.localStorage.setItem('test_user', JSON.stringify({
          uid: 'test-user-db-error',
          email: 'db-error@staging.com'
        }));
      });

      await page.goto(`${STAGING_BASE_URL}/dashboard/interviews`);

      // Verify error state is displayed
      await expect(page.locator('[data-testid="database-error"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Performance Tests', () => {
    test('should load dashboard within performance budget', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(`${STAGING_BASE_URL}/dashboard`);
      await expect(page.locator('[data-testid="dashboard-content"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // 3 second budget
    });

    test('should handle large resume files efficiently', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('test_user', JSON.stringify({
          uid: 'test-user-large-file',
          email: 'large-file@staging.com'
        }));
      });

      await page.goto(`${STAGING_BASE_URL}/dashboard/resumes/upload`);

      // Monitor network activity during upload
      const responses = [];
      page.on('response', response => {
        if (response.url().includes('/api/resumes/upload')) {
          responses.push(response);
        }
      });

      // Upload large file (simulated)
      const largePdfContent = Buffer.alloc(5 * 1024 * 1024, 'x'); // 5MB
      
      const fileChooserPromise = page.waitForEvent('filechooser');
      await page.click('[data-testid="file-upload-button"]');
      const fileChooser = await fileChooserPromise;
      
      await fileChooser.setFiles({
        name: 'large-resume.pdf',
        mimeType: 'application/pdf',
        buffer: largePdfContent,
      });

      // Verify upload progresses properly
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="resume-processing-complete"]')).toBeVisible({ timeout: 60000 });

      // Verify no timeout errors
      expect(responses.length).toBeGreaterThan(0);
      expect(responses[0].status()).toBe(200);
    });
  });
});
