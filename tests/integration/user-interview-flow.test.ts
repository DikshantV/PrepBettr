/**
 * Complete User Interview Flow Integration Test
 * 
 * Tests end-to-end user journey from signup through interview completion,
 * validating Azure service integrations and data consistency.
 * 
 * @version 2.0.0
 */

import { test, expect, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';

// Test data generators
const generateTestUser = () => ({
  email: faker.internet.email(),
  password: faker.internet.password({ length: 12, memorable: true }),
  name: faker.person.fullName(),
  jobTitle: faker.person.jobTitle(),
  company: faker.company.name()
});

const TEST_RESUME_PATH = './tests/fixtures/sample-resume.pdf';

// Page Object Model for better maintainability
class AuthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/auth/signin');
  }

  async signUp(user: any) {
    await this.page.click('[data-testid="signup-tab"]');
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    await this.page.fill('[data-testid="name-input"]', user.name);
    
    // Wait for signup button and click
    await this.page.click('[data-testid="signup-button"]');
    
    // Wait for signup completion
    await this.page.waitForURL('/dashboard');
  }

  async signIn(email: string, password: string) {
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="signin-button"]');
    
    // Wait for sign in completion
    await this.page.waitForURL('/dashboard');
  }

  async signOut() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="signout-button"]');
    await this.page.waitForURL('/');
  }
}

class InterviewPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/interview');
  }

  async startVoiceInterview(jobTitle: string, company: string) {
    await this.page.click('[data-testid="start-interview-button"]');
    
    // Configure interview settings
    await this.page.fill('[data-testid="job-title-input"]', jobTitle);
    await this.page.fill('[data-testid="company-input"]', company);
    await this.page.selectOption('[data-testid="difficulty-select"]', 'medium');
    
    // Start the interview
    await this.page.click('[data-testid="begin-interview-button"]');
    
    // Wait for SignalR connection and initial AI response
    await this.page.waitForSelector('[data-testid="interview-active"]');
    await this.page.waitForSelector('[data-testid="ai-response"]', { timeout: 10000 });
  }

  async simulateVoiceResponse(response: string) {
    // Simulate microphone input (in real scenario, this would be actual voice)
    await this.page.evaluate((text) => {
      // Mock speech recognition result
      window.dispatchEvent(new CustomEvent('mock-speech-result', {
        detail: { transcript: text, confidence: 0.95 }
      }));
    }, response);

    // Wait for AI to process and respond
    await this.page.waitForSelector('[data-testid="ai-thinking"]');
    await this.page.waitForSelector('[data-testid="ai-response"]', { timeout: 15000 });
  }

  async endInterview() {
    await this.page.click('[data-testid="end-interview-button"]');
    await this.page.waitForSelector('[data-testid="interview-summary"]');
  }

  async getInterviewSummary() {
    const summary = await this.page.textContent('[data-testid="interview-summary"]');
    return summary;
  }
}

class ProfilePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/profile');
  }

  async uploadResume(filePath: string) {
    await this.page.setInputFiles('[data-testid="resume-upload"]', filePath);
    
    // Wait for upload completion
    await this.page.waitForSelector('[data-testid="upload-success"]', { timeout: 30000 });
    
    // Wait for AI processing
    await this.page.waitForSelector('[data-testid="resume-processed"]', { timeout: 60000 });
  }

  async getGeneratedQuestions() {
    const questions = await this.page.locator('[data-testid="generated-question"]').allTextContents();
    return questions;
  }
}

// Test suite
test.describe('Complete User Interview Flow', () => {
  let testUser: ReturnType<typeof generateTestUser>;
  let authPage: AuthPage;
  let interviewPage: InterviewPage;
  let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    testUser = generateTestUser();
    authPage = new AuthPage(page);
    interviewPage = new InterviewPage(page);
    profilePage = new ProfilePage(page);

    // Set up test environment
    await page.addInitScript(() => {
      // Mock browser APIs for testing
      window.navigator.mediaDevices = {
        getUserMedia: () => Promise.resolve(new MediaStream()),
        enumerateDevices: () => Promise.resolve([])
      };
      
      // Mock WebRTC APIs
      window.RTCPeerConnection = class MockRTCPeerConnection {
        createOffer() { return Promise.resolve({}); }
        createAnswer() { return Promise.resolve({}); }
        setLocalDescription() { return Promise.resolve(); }
        setRemoteDescription() { return Promise.resolve(); }
        addIceCandidate() { return Promise.resolve(); }
        close() {}
      };
    });
  });

  test('complete user journey: signup → profile setup → interview session', async ({ page }) => {
    // Step 1: User Sign Up
    test.step('User signs up with Firebase Auth', async () => {
      await authPage.goto();
      await authPage.signUp(testUser);
      
      // Verify user is redirected to dashboard
      await expect(page).toHaveURL('/dashboard');
      
      // Verify user profile data is synced to Cosmos DB
      const userProfile = await page.evaluate(() => {
        return fetch('/api/profile')
          .then(res => res.json())
          .catch(() => null);
      });
      
      expect(userProfile).toBeTruthy();
      expect(userProfile.email).toBe(testUser.email);
    });

    // Step 2: Profile Setup and Resume Upload
    test.step('User uploads resume and gets AI-generated questions', async () => {
      await profilePage.goto();
      
      // Upload resume to Azure Blob Storage
      await profilePage.uploadResume(TEST_RESUME_PATH);
      
      // Verify resume is processed and stored
      await expect(page.locator('[data-testid="resume-processed"]')).toBeVisible();
      
      // Verify AI-generated questions are created
      const questions = await profilePage.getGeneratedQuestions();
      expect(questions.length).toBeGreaterThan(0);
      
      // Verify questions are stored in Cosmos DB
      const storedQuestions = await page.evaluate(() => {
        return fetch('/api/profile/questions')
          .then(res => res.json())
          .catch(() => []);
      });
      
      expect(storedQuestions.length).toBeGreaterThan(0);
    });

    // Step 3: Interview Session Lifecycle
    test.step('Complete interview session with voice interaction', async () => {
      await interviewPage.goto();
      
      // Start voice interview
      await interviewPage.startVoiceInterview(testUser.jobTitle, testUser.company);
      
      // Verify SignalR connection is established
      await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
      
      // Verify initial AI response
      await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();
      
      // Simulate conversation flow
      const responses = [
        "Hello, I'm excited to be here for this interview.",
        "I have 5 years of experience in software development, primarily working with React and Node.js.",
        "My biggest achievement was leading a team of 4 developers to successfully launch a customer portal that increased user engagement by 40%.",
        "I'm passionate about creating user-friendly applications and continuously learning new technologies."
      ];

      for (const response of responses) {
        await interviewPage.simulateVoiceResponse(response);
        
        // Verify each response is processed
        await expect(page.locator('[data-testid="ai-response"]')).toBeVisible();
        
        // Add small delay to simulate natural conversation flow
        await page.waitForTimeout(2000);
      }
      
      // End the interview
      await interviewPage.endInterview();
      
      // Verify interview summary is generated
      const summary = await interviewPage.getInterviewSummary();
      expect(summary).toBeTruthy();
      expect(summary).toContain('interview');
    });

    // Step 4: Data Consistency Verification
    test.step('Verify cross-service data consistency', async () => {
      // Verify interview data is stored in Cosmos DB
      const interviewData = await page.evaluate(() => {
        return fetch('/api/interviews/recent')
          .then(res => res.json())
          .catch(() => null);
      });
      
      expect(interviewData).toBeTruthy();
      expect(interviewData.userId).toBeTruthy();
      expect(interviewData.status).toBe('completed');
      
      // Verify usage quotas are updated
      const usageData = await page.evaluate(() => {
        return fetch('/api/usage')
          .then(res => res.json())
          .catch(() => null);
      });
      
      expect(usageData).toBeTruthy();
      expect(usageData.interviews.count).toBeGreaterThan(0);
      
      // Verify telemetry data is captured
      const telemetryEvents = await page.evaluate(() => {
        return window.appInsights?.getEvents?.() || [];
      });
      
      expect(telemetryEvents.length).toBeGreaterThan(0);
    });
  });

  test('user authentication state persistence', async ({ page }) => {
    test.step('Sign up and verify session persistence', async () => {
      await authPage.goto();
      await authPage.signUp(testUser);
      
      // Verify session cookie is set
      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find(c => c.name.includes('session'));
      expect(sessionCookie).toBeTruthy();
      
      // Refresh page and verify user remains authenticated
      await page.reload();
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      
      // Sign out and verify session is cleared
      await authPage.signOut();
      const cookiesAfterSignOut = await page.context().cookies();
      const sessionCookieAfter = cookiesAfterSignOut.find(c => c.name.includes('session'));
      expect(sessionCookieAfter).toBeFalsy();
    });
  });

  test('error handling and recovery', async ({ page }) => {
    test.step('Handle network failures gracefully', async () => {
      await authPage.goto();
      await authPage.signUp(testUser);
      
      // Simulate network failure during interview
      await interviewPage.goto();
      
      // Intercept and fail API requests
      await page.route('/api/interview/**', route => {
        route.abort('failed');
      });
      
      await interviewPage.startVoiceInterview(testUser.jobTitle, testUser.company);
      
      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Restore network and retry
      await page.unroute('/api/interview/**');
      await page.click('[data-testid="retry-button"]');
      
      // Verify recovery
      await expect(page.locator('[data-testid="interview-active"]')).toBeVisible();
    });
  });

  test('performance benchmarks', async ({ page }) => {
    test.step('Measure critical path performance', async () => {
      const performanceMetrics = {
        signupTime: 0,
        resumeUploadTime: 0,
        interviewStartTime: 0,
        aiResponseTime: 0
      };

      // Measure signup performance
      const signupStart = Date.now();
      await authPage.goto();
      await authPage.signUp(testUser);
      performanceMetrics.signupTime = Date.now() - signupStart;

      // Measure resume upload performance
      const uploadStart = Date.now();
      await profilePage.goto();
      await profilePage.uploadResume(TEST_RESUME_PATH);
      performanceMetrics.resumeUploadTime = Date.now() - uploadStart;

      // Measure interview start performance
      const interviewStart = Date.now();
      await interviewPage.goto();
      await interviewPage.startVoiceInterview(testUser.jobTitle, testUser.company);
      performanceMetrics.interviewStartTime = Date.now() - interviewStart;

      // Measure AI response performance
      const aiStart = Date.now();
      await interviewPage.simulateVoiceResponse("Tell me about yourself.");
      performanceMetrics.aiResponseTime = Date.now() - aiStart;

      // Verify performance benchmarks
      expect(performanceMetrics.signupTime).toBeLessThan(5000); // < 5 seconds
      expect(performanceMetrics.resumeUploadTime).toBeLessThan(30000); // < 30 seconds
      expect(performanceMetrics.interviewStartTime).toBeLessThan(10000); // < 10 seconds
      expect(performanceMetrics.aiResponseTime).toBeLessThan(15000); // < 15 seconds

      console.log('Performance Metrics:', performanceMetrics);
    });
  });

  test('mobile responsive behavior', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip('Mobile-specific test');
    }

    test.step('Verify mobile interview experience', async () => {
      await authPage.goto();
      await authPage.signUp(testUser);
      
      // Verify mobile-optimized interface
      await interviewPage.goto();
      await expect(page.locator('[data-testid="mobile-interview-ui"]')).toBeVisible();
      
      // Verify touch interactions work
      await page.tap('[data-testid="start-interview-button"]');
      await expect(page.locator('[data-testid="interview-config"]')).toBeVisible();
      
      // Verify mobile voice controls
      await page.tap('[data-testid="voice-button"]');
      await expect(page.locator('[data-testid="listening-indicator"]')).toBeVisible();
    });
  });
});
