import { test, expect } from '@playwright/test';

/**
 * Firebase 401 Error Diagnostic Test Suite
 * 
 * Tests Firebase Admin SDK authentication flows to identify 401 errors
 * and validate diagnostic endpoints work correctly in different environments.
 */

test.describe('Firebase 401 Authentication Diagnostics', () => {
  test('should access Firebase configuration debug endpoint', async ({ request }) => {
    // Test the debug endpoint that we created
    const response = await request.get('/api/debug/firebase-config', {
      headers: {
        'x-debug-auth': 'debug-firebase-2024'
      }
    });

    console.log(`🔍 Debug endpoint status: ${response.status()}`);
    
    if (response.status() === 200) {
      const data = await response.json();
      console.log('✅ Firebase configuration debug data:', JSON.stringify(data, null, 2));
      
      // Validate the diagnostic response structure
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('firebaseAdmin');
      expect(data).toHaveProperty('unifiedAuth');
      expect(data).toHaveProperty('summary');
      
      // Check for critical issues
      if (data.summary?.criticalIssues?.length > 0) {
        console.warn('🚨 Critical Firebase configuration issues detected:', data.summary.criticalIssues);
      } else {
        console.log('✅ No critical Firebase configuration issues detected');
      }
      
      // Validate Firebase Admin SDK status
      expect(data.firebaseAdmin?.adminSDKAvailable).toBe(true);
      
    } else {
      console.log(`ℹ️  Debug endpoint response: ${await response.text()}`);
    }
  });

  test('should test authentication API responses', async ({ page }) => {
    const responses: any[] = [];

    // Monitor authentication API responses
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/auth/')) {
        console.log(`📡 Auth API response: ${response.status()} ${url}`);
        
        if (response.status() === 401 || response.status() >= 500) {
          try {
            const errorData = await response.json();
            responses.push({ url, status: response.status(), error: errorData });
            console.error(`🚨 Error at ${url}:`, errorData);
          } catch (e) {
            const errorText = await response.text();
            responses.push({ url, status: response.status(), error: errorText });
            console.error(`🚨 Error at ${url}:`, errorText);
          }
        }
      }
    });

    // Navigate to sign-in page
    await page.goto('/sign-in');
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
    
    // Wait for any initialization
    await page.waitForTimeout(3000);

    // Report authentication errors
    const authErrors = responses.filter(r => r.status === 401 || r.status >= 500);
    if (authErrors.length > 0) {
      console.log('🚨 Authentication/Server errors detected:');
      authErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.url} - Status: ${error.status}`);
        console.log(`     Error: ${JSON.stringify(error.error, null, 2)}`);
      });
    } else {
      console.log('✅ No authentication errors detected');
    }
  });

  test('should validate Firebase logging', async ({ page }) => {
    const consoleMessages: string[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('🔥') || text.includes('Firebase') || text.includes('UnifiedAuth')) {
        console.log(`📝 Firebase log: ${text}`);
        consoleMessages.push(text);
      }
    });

    // Navigate to trigger Firebase initialization
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(3000);

    const firebaseLogs = consoleMessages.filter(msg => 
      msg.includes('Firebase') || msg.includes('🔥')
    );
    
    if (firebaseLogs.length > 0) {
      console.log(`✅ Found ${firebaseLogs.length} Firebase diagnostic log messages`);
    } else {
      console.log('⚠️  No Firebase diagnostic logs detected');
    }
  });
});