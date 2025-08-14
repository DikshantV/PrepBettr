import { defineConfig, devices } from '@playwright/test';

/**
 * Production-specific Playwright configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false, // More conservative for production
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* More retries for production due to potential network issues */
  retries: 3,
  /* Fewer workers for production to avoid overwhelming the server */
  workers: 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Timeout settings for production environment */
  timeout: 30000,
  expect: {
    timeout: 15000,
  },
  /* Shared settings for all the projects below */
  use: {
    /* Base URL for production testing */
    baseURL: process.env.BASE_URL || 'https://prepbettr.com',

    /* Collect trace for all tests in production */
    trace: 'on',
    
    /* Take screenshots on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
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

    /* Test against mobile viewports for production */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* No local dev server for production testing */
});
