/**
 * Playwright Configuration for PrepBettr Integration Testing
 * 
 * Comprehensive end-to-end testing setup for Azure-centric architecture
 * covering complete user workflows and cross-service interactions.
 * 
 * @version 2.0.0
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['line']
  ],

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 
             (process.env.NODE_ENV === 'production' ? 'https://prepbettr.azurewebsites.net' : 'http://localhost:3000'),

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    
    /* Screenshots on failure */
    screenshot: 'only-on-failure',
    
    /* Video recording */
    video: 'retain-on-failure',

    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },

    /* Timeout for each action */
    actionTimeout: 10000,
    
    /* Navigation timeout */
    navigationTimeout: 15000,
  },

  /* Global test timeout */
  timeout: 60000,

  /* Expect timeout */
  expect: {
    /* Timeout for expect assertions */
    timeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Global setup and teardown */
  // globalSetup: require.resolve('./tests/global-setup.ts'), // Disabled for auth testing

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
  },

  /* Output directory for test artifacts */
  outputDir: 'test-results/artifacts',

  /* Test files patterns */
  testMatch: [
    '**/tests/integration/**/*.test.ts',
    '**/tests/e2e/**/*.test.ts',
    '**/tests/e2e/**/*.spec.ts',
    '**/e2e/**/*.test.ts', // Keep backward compatibility
    '**/e2e/**/*.spec.ts'
  ],

  /* Files to ignore */
  testIgnore: [
    '**/tests/unit/**/*',
    '**/node_modules/**/*'
  ],
});
