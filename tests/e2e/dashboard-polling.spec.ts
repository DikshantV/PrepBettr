import { test, expect } from '@playwright/test';

/**
 * Dashboard Polling Prevention Test
 * 
 * Ensures that the /dashboard page does not trigger continuous API calls
 * and only makes initial necessary requests for data loading
 */

test.describe('Dashboard - Polling Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Set up a mock authenticated session
    await page.evaluateOnNewDocument(() => {
      // Mock session cookie and auth token
      document.cookie = 'session=mock-session-token-dashboard-test; path=/; max-age=3600';
      localStorage.setItem('auth_token', 'mock-token-dashboard-user-12345');
    });
  });

  test('should not trigger continuous API requests on dashboard load', async ({ page }) => {
    let apiCallCount = 0;
    let authVerifyCallCount = 0;
    let dashboardCallCount = 0;
    let syncFirebaseCallCount = 0;
    
    const apiCalls: Array<{url: string, method: string, timestamp: number}> = [];

    // Monitor all network requests
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      
      // Track all API calls
      if (url.includes('/api/')) {
        apiCallCount++;
        apiCalls.push({
          url,
          method,
          timestamp: Date.now()
        });
        
        console.log(`📡 API Call #${apiCallCount}: ${method} ${url}`);
      }
      
      // Track specific endpoints that shouldn't poll
      if (url.includes('/api/auth/verify')) {
        authVerifyCallCount++;
        console.log(`🔍 /api/auth/verify call #${authVerifyCallCount}`);
      }
      
      if (url.includes('/api/dashboard/') || url.includes('/dashboard')) {
        dashboardCallCount++;
        console.log(`📊 Dashboard API call #${dashboardCallCount}: ${url}`);
      }
      
      if (url.includes('/api/auth/sync-firebase')) {
        syncFirebaseCallCount++;
        console.log(`🔄 /api/auth/sync-firebase call #${syncFirebaseCallCount}`);
      }
    });

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Wait for initial page load
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Verify dashboard components are visible
    await expect(page.locator('h2:has-text("Get Interview-Ready")')).toBeVisible();
    
    // Record initial API call count
    const initialApiCallCount = apiCallCount;
    const initialAuthVerifyCount = authVerifyCallCount;
    const initialDashboardCount = dashboardCallCount;
    const initialSyncFirebaseCount = syncFirebaseCallCount;
    
    console.log(`📊 Initial counts - API: ${initialApiCallCount}, Auth: ${initialAuthVerifyCount}, Dashboard: ${initialDashboardCount}, Sync: ${initialSyncFirebaseCount}`);

    // Wait 10 seconds to detect any polling loops
    console.log('⏳ Waiting 10 seconds to detect potential polling...');
    await page.waitForTimeout(10000);

    // Check for any new API calls (should be minimal or zero)
    const finalApiCallCount = apiCallCount;
    const finalAuthVerifyCount = authVerifyCallCount;
    const finalDashboardCount = dashboardCallCount;
    const finalSyncFirebaseCount = syncFirebaseCallCount;
    
    console.log(`📊 Final counts - API: ${finalApiCallCount}, Auth: ${finalAuthVerifyCount}, Dashboard: ${finalDashboardCount}, Sync: ${finalSyncFirebaseCount}`);
    
    // Calculate increases
    const apiCallIncrease = finalApiCallCount - initialApiCallCount;
    const authVerifyIncrease = finalAuthVerifyCount - initialAuthVerifyCount;
    const dashboardCallIncrease = finalDashboardCount - initialDashboardCount;
    const syncFirebaseIncrease = finalSyncFirebaseCount - initialSyncFirebaseCount;

    // Assertions - should have no or minimal increases
    expect(authVerifyIncrease, 
      `Expected ≤1 additional /api/auth/verify calls, but got ${authVerifyIncrease} new calls. This indicates auth verification polling.`
    ).toBeLessThanOrEqual(1);
    
    expect(dashboardCallIncrease,
      `Expected 0 additional dashboard API calls, but got ${dashboardCallIncrease}. This indicates dashboard data polling.`
    ).toBe(0);
    
    expect(syncFirebaseIncrease,
      `Expected 0 additional /api/auth/sync-firebase calls, but got ${syncFirebaseIncrease}. This indicates Firebase sync polling.`
    ).toBe(0);
    
    expect(apiCallIncrease,
      `Expected ≤2 additional API calls total, but got ${apiCallIncrease}. This indicates overall polling behavior.`
    ).toBeLessThanOrEqual(2);

    console.log(`✅ Dashboard polling test passed - ${apiCallIncrease} additional API calls detected`);
  });

  test('should load dashboard content properly without polling', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');

    // Wait for dashboard to load
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Verify main dashboard sections are loaded
    await expect(page.locator('h2:has-text("Get Interview-Ready")')).toBeVisible();
    await expect(page.locator('text=Practice real interview questions')).toBeVisible();
    
    // Verify start interview button is present
    await expect(page.locator('a[href="/dashboard/interview"]:has-text("Start an Interview")')).toBeVisible();
    
    // Verify interview sections are present
    await expect(page.locator('h2:has-text("Your Recent Interviews")')).toBeVisible();
    await expect(page.locator('h2:has-text("Community Mock Interviews")')).toBeVisible();
    
    // Check if mock interview cards are displayed
    const userInterviewsSection = page.locator('text=Your Recent Interviews').locator('..');
    const publicInterviewsSection = page.locator('text=Community Mock Interviews').locator('..');
    
    // At least one section should show content or appropriate empty state
    const hasUserContent = await userInterviewsSection.locator('.interviews-section').count() > 0;
    const hasPublicContent = await publicInterviewsSection.locator('li').count() > 0;
    
    if (!hasUserContent && !hasPublicContent) {
      // Check for empty states
      const hasEmptyState = await page.locator('text=no interviews').count() > 0;
      expect(hasEmptyState).toBeTruthy();
    }
    
    console.log('✅ Dashboard content loaded successfully without polling');
  });

  test('should handle dashboard navigation without triggering polling', async ({ page }) => {
    let apiCallCount = 0;
    
    // Monitor API calls during navigation
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        apiCallCount++;
      }
    });

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const initialCount = apiCallCount;
    
    // Interact with dashboard elements (scroll, hover, etc.)
    await page.locator('h2:has-text("Get Interview-Ready")').hover();
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    
    // Check if interactions triggered additional API calls
    const finalCount = apiCallCount;
    const interactionCallIncrease = finalCount - initialCount;
    
    expect(interactionCallIncrease,
      `Expected 0 API calls from dashboard interactions, but got ${interactionCallIncrease}. Interactions should not trigger API polling.`
    ).toBe(0);
    
    console.log('✅ Dashboard navigation test passed without triggering polling');
  });
});
