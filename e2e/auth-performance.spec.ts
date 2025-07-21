import { test, expect } from '@playwright/test';
import { AuthHelper, PerformanceHelper, NetworkHelper, TEST_USERS, getTestConfig } from './helpers/test-utils';

test.describe('Authentication Performance Tests', () => {
  let authHelper: AuthHelper;
  let performanceHelper: PerformanceHelper;
  let networkHelper: NetworkHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    performanceHelper = new PerformanceHelper(page);
    networkHelper = new NetworkHelper(page);
    
    // Clear authentication state
    await authHelper.clearAuthState();
  });

  test('should complete authentication flow within performance thresholds', async ({ page }) => {
    const config = getTestConfig();
    console.log(`Testing performance on ${config.isProduction ? 'production' : 'development'}...`);

    // Measure complete authentication flow
    const metrics = await performanceHelper.measureAuthFlowPerformance();

    console.log('Performance Metrics:');
    console.log(`- Sign-in page load: ${metrics.signInPageLoad}ms`);
    console.log(`- Form submission + redirect: ${metrics.signInSubmission}ms`);
    console.log(`- Dashboard load: ${metrics.dashboardLoad}ms`);
    console.log(`- Total authentication flow: ${metrics.total}ms`);

    // Set performance thresholds based on environment
    const thresholds = {
      signInPageLoad: config.isProduction ? 5000 : 3000,
      signInSubmission: config.isProduction ? 10000 : 5000,
      dashboardLoad: config.isProduction ? 5000 : 3000,
      total: config.isProduction ? 15000 : 8000,
    };

    // Assert performance meets thresholds
    expect(metrics.signInPageLoad).toBeLessThan(thresholds.signInPageLoad);
    expect(metrics.signInSubmission).toBeLessThan(thresholds.signInSubmission);
    expect(metrics.dashboardLoad).toBeLessThan(thresholds.dashboardLoad);
    expect(metrics.total).toBeLessThan(thresholds.total);

    console.log('✓ All performance thresholds met');
  });

  test('should handle network monitoring during authentication', async ({ page }) => {
    console.log('Testing network requests during authentication...');

    // Start monitoring network requests
    const authRequests = await networkHelper.monitorAuthRequests();

    // Perform authentication
    await authHelper.signIn(TEST_USERS.existing);

    // Wait for network to settle
    await networkHelper.waitForNetworkIdle();

    // Analyze network requests
    console.log(`Captured ${authRequests.length} auth-related requests`);
    
    // Look for critical auth API calls
    const signInRequest = authRequests.find(req => req.url.includes('/api/auth/signin'));
    if (signInRequest) {
      console.log(`Sign-in API response time: ${signInRequest.responseTime}ms`);
      expect(signInRequest.status).toBe(200);
      expect(signInRequest.responseTime).toBeLessThan(5000);
    }

    // Check for any failed requests
    const failedRequests = authRequests.filter(req => req.status >= 400);
    if (failedRequests.length > 0) {
      console.warn('Failed requests detected:', failedRequests);
    }
    expect(failedRequests.length).toBe(0);

    console.log('✓ Network monitoring completed successfully');
  });

  test('should measure page load times across auth flow', async ({ page }) => {
    console.log('Measuring individual page load times...');

    // Measure sign-in page load
    const signInLoadTime = await performanceHelper.measurePageLoadTime('/sign-in');
    console.log(`Sign-in page load time: ${signInLoadTime}ms`);

    // Measure sign-up page load  
    const signUpLoadTime = await performanceHelper.measurePageLoadTime('/sign-up');
    console.log(`Sign-up page load time: ${signUpLoadTime}ms`);

    // After authentication, measure dashboard load
    await authHelper.signIn(TEST_USERS.existing);
    
    const dashboardLoadTime = await performanceHelper.measurePageLoadTime('/dashboard');
    console.log(`Dashboard page load time: ${dashboardLoadTime}ms`);

    // Assert reasonable load times
    const config = getTestConfig();
    const maxLoadTime = config.isProduction ? 8000 : 5000;

    expect(signInLoadTime).toBeLessThan(maxLoadTime);
    expect(signUpLoadTime).toBeLessThan(maxLoadTime);
    expect(dashboardLoadTime).toBeLessThan(maxLoadTime);

    console.log('✓ All page load times within acceptable limits');
  });

  test('should perform under different network conditions', async ({ page, context }) => {
    console.log('Testing performance under throttled network conditions...');

    // Simulate slower network conditions
    await context.route('**/*', async (route) => {
      // Add artificial delay to simulate slower network
      await new Promise(resolve => setTimeout(resolve, 100));
      await route.continue();
    });

    const startTime = Date.now();
    
    // Perform authentication under throttled conditions
    await authHelper.signIn(TEST_USERS.existing);
    
    const throttledTime = Date.now() - startTime;
    console.log(`Authentication under throttled network: ${throttledTime}ms`);

    // Should still complete within reasonable time even under slow conditions
    const config = getTestConfig();
    const maxThrottledTime = config.isProduction ? 30000 : 20000;
    
    expect(throttledTime).toBeLessThan(maxThrottledTime);
    console.log('✓ Performance acceptable under throttled network');
  });

  test('should handle concurrent authentication requests', async ({ browser }) => {
    console.log('Testing concurrent authentication performance...');

    const concurrentUsers = 3;
    const contexts = [];
    const results = [];

    // Create multiple browser contexts
    for (let i = 0; i < concurrentUsers; i++) {
      const context = await browser.newContext();
      contexts.push(context);
    }

    try {
      // Run concurrent authentication flows
      const promises = contexts.map(async (context, index) => {
        const page = await context.newPage();
        const helper = new AuthHelper(page);
        const perfHelper = new PerformanceHelper(page);
        
        await helper.clearAuthState();
        
        const startTime = Date.now();
        await helper.signIn(TEST_USERS.existing);
        const endTime = Date.now();
        
        await page.close();
        
        return {
          user: index + 1,
          duration: endTime - startTime
        };
      });

      const concurrentResults = await Promise.all(promises);
      
      console.log('Concurrent authentication results:');
      concurrentResults.forEach(result => {
        console.log(`User ${result.user}: ${result.duration}ms`);
        results.push(result.duration);
      });

      // Calculate statistics
      const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);
      
      console.log(`Average time: ${avgTime.toFixed(0)}ms`);
      console.log(`Maximum time: ${maxTime}ms`);

      // Assert that concurrent requests don't significantly degrade performance
      const config = getTestConfig();
      const maxConcurrentTime = config.isProduction ? 20000 : 10000;
      
      expect(maxTime).toBeLessThan(maxConcurrentTime);
      console.log('✓ Concurrent authentication performance acceptable');

    } finally {
      // Clean up contexts
      for (const context of contexts) {
        await context.close();
      }
    }
  });
});
