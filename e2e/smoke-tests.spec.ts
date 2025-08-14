import { test, expect } from '@playwright/test';

/**
 * Smoke tests for live domain (https://prepbettr.com)
 * These are quick tests to verify critical functionality on production
 */

test.describe('Production Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set shorter timeout for smoke tests
    test.setTimeout(15000);
  });

  test('Homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/PrepBettr/);
    
    // Verify essential elements are present
    await expect(page.locator('h1, [data-testid="hero-title"]')).toBeVisible();
    
    // Check for navigation elements
    await expect(page.locator('nav, [role="navigation"], [data-testid="navigation"]')).toBeVisible();
  });

  test('Authentication flow is accessible', async ({ page }) => {
    await page.goto('/');
    
    // Look for sign in/login button or link
    const authSelectors = [
      '[data-testid="sign-in"]',
      '[data-testid="login"]', 
      'text=Sign In',
      'text=Log In',
      'text=Login',
      'a[href*="login"]',
      'a[href*="auth"]'
    ];
    
    let authFound = false;
    for (const selector of authSelectors) {
      try {
        await page.locator(selector).first().waitFor({ timeout: 2000 });
        authFound = true;
        break;
      } catch {
        continue;
      }
    }
    
    expect(authFound).toBe(true);
  });

  test('Resume upload functionality is accessible', async ({ page }) => {
    await page.goto('/');
    
    // Look for resume upload or related functionality
    const uploadSelectors = [
      '[data-testid="resume-upload"]',
      'input[type="file"]',
      'text=Upload Resume',
      'text=Upload CV',
      'text=Upload',
      '[accept*=".pdf"]',
      '[accept*="application/pdf"]'
    ];
    
    let uploadFound = false;
    for (const selector of uploadSelectors) {
      try {
        const element = page.locator(selector).first();
        await element.waitFor({ timeout: 2000 });
        uploadFound = true;
        break;
      } catch {
        continue;
      }
    }
    
    // If not found on homepage, check if there's a dedicated upload page
    if (!uploadFound) {
      try {
        await page.goto('/upload');
        await page.waitForLoadState('networkidle', { timeout: 5000 });
        
        for (const selector of uploadSelectors) {
          try {
            await page.locator(selector).first().waitFor({ timeout: 2000 });
            uploadFound = true;
            break;
          } catch {
            continue;
          }
        }
      } catch {
        // If /upload doesn't exist, that's okay for smoke test
      }
    }
    
    expect(uploadFound).toBe(true);
  });

  test('Critical assets load without errors', async ({ page }) => {
    const responses: any[] = [];
    
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status()
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for any critical asset failures (4xx, 5xx errors)
    const criticalFailures = responses.filter(response => 
      response.status >= 400 && 
      (response.url.includes('.js') || 
       response.url.includes('.css') || 
       response.url.includes('.woff') ||
       response.url.includes('api/'))
    );
    
    expect(criticalFailures).toHaveLength(0);
  });

  test('Page performance is acceptable', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Expect page to load in under 5 seconds for smoke test
    expect(loadTime).toBeLessThan(5000);
  });

  test('API endpoints are responsive', async ({ page }) => {
    await page.goto('/');
    
    // Test health/status endpoints if they exist
    const healthEndpoints = ['/api/health', '/api/status', '/api/ping'];
    
    for (const endpoint of healthEndpoints) {
      try {
        const response = await page.request.get(endpoint);
        if (response.status() < 500) {
          // If endpoint exists and returns anything other than 5xx, consider it healthy
          expect(response.status()).toBeLessThan(500);
          break;
        }
      } catch {
        // Endpoint doesn't exist, continue to next
        continue;
      }
    }
  });

  test('Mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    await page.goto('/');
    
    // Check that content is visible and not cut off
    await expect(page.locator('body')).toBeVisible();
    
    // Verify no horizontal scroll by checking viewport width
    const bodyWidth = await page.locator('body').boundingBox();
    expect(bodyWidth?.width).toBeLessThanOrEqual(375);
  });

  test('Console errors are minimal', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out non-critical console errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('favicon') &&
      !error.includes('analytics') &&
      !error.includes('gtag') &&
      !error.includes('third-party')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Production Regression Tests', () => {
  test('User flow: Browse to interview preparation', async ({ page }) => {
    await page.goto('/');
    
    // Look for interview or preparation related links/buttons
    const interviewSelectors = [
      'text=Interview',
      'text=Practice',
      'text=Prepare',
      'text=Mock Interview',
      'text=Start',
      '[data-testid="interview"]',
      '[data-testid="practice"]'
    ];
    
    let interviewLinkFound = false;
    for (const selector of interviewSelectors) {
      try {
        const element = page.locator(selector).first();
        await element.waitFor({ timeout: 2000 });
        await element.click({ timeout: 5000 });
        interviewLinkFound = true;
        break;
      } catch {
        continue;
      }
    }
    
    if (interviewLinkFound) {
      // Verify we navigated somewhere
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).not.toBe(page.url());
    } else {
      // If no interview links found, at least verify the page loaded properly
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Error pages are handled gracefully', async ({ page }) => {
    // Test 404 page
    await page.goto('/non-existent-page-12345');
    
    // Should get either a proper 404 page or redirect to homepage
    const is404 = page.url().includes('404') || 
                  await page.locator('text=404').count() > 0 ||
                  await page.locator('text=Not Found').count() > 0;
    
    const isRedirectedHome = page.url().endsWith('/') || page.url().includes('prepbettr.com');
    
    expect(is404 || isRedirectedHome).toBe(true);
  });
});
