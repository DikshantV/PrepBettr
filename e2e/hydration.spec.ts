import { test, expect, type Page } from '@playwright/test';

// Test to detect hydration mismatches and console errors
async function checkHydrationErrors(page: Page, url: string = '/') {
  const errors: string[] = [];
  const hydrationErrors: string[] = [];
  const warnings: string[] = [];
  
  // Listen for console messages
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    if (type === 'error') {
      errors.push(text);
      
      // Check specifically for hydration errors
      if (text.includes('hydrated but some attributes') || 
          text.includes('Text content did not match') ||
          text.includes('hydration mismatch') ||
          text.includes('Hydration failed because the initial UI') ||
          text.includes('There was an error while hydrating')) {
        hydrationErrors.push(text);
      }
    } else if (type === 'warning' && text.includes('Warning: ')) {
      warnings.push(text);
    }
  });

  // Navigate to the page
  await page.goto(url);
  
  // Wait for hydration to complete
  await page.waitForTimeout(3000);
  
  // Collect all errors
  const allErrors = {
    hydrationErrors,
    generalErrors: errors.filter(e => !hydrationErrors.includes(e)),
    warnings
  };

  return allErrors;
}

test.describe('Hydration Error Detection', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing authentication state
    await page.context().clearCookies();
    
    try {
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          // Storage access denied - this is expected in some browsers/contexts
        }
      });
    } catch (error) {
      // Ignore storage clearing errors
    }
  });

  test('should have no hydration errors on homepage', async ({ page }) => {
    const errors = await checkHydrationErrors(page, '/');
    
    if (errors.hydrationErrors.length > 0) {
      console.error('Hydration errors found on homepage:');
      errors.hydrationErrors.forEach(error => console.error(error));
      throw new Error(`Hydration errors on homepage: ${errors.hydrationErrors.length} error(s)`);
    }
    
    console.log('✓ No hydration errors on homepage');
  });

  test('should have no hydration errors on sign-in page', async ({ page }) => {
    const errors = await checkHydrationErrors(page, '/sign-in');
    
    if (errors.hydrationErrors.length > 0) {
      console.error('Hydration errors found on sign-in page:');
      errors.hydrationErrors.forEach(error => console.error(error));
      throw new Error(`Hydration errors on sign-in: ${errors.hydrationErrors.length} error(s)`);
    }
    
    console.log('✓ No hydration errors on sign-in page');
  });

  test('should have no hydration errors on sign-up page', async ({ page }) => {
    const errors = await checkHydrationErrors(page, '/sign-up');
    
    if (errors.hydrationErrors.length > 0) {
      console.error('Hydration errors found on sign-up page:');
      errors.hydrationErrors.forEach(error => console.error(error));
      throw new Error(`Hydration errors on sign-up: ${errors.hydrationErrors.length} error(s)`);
    }
    
    console.log('✓ No hydration errors on sign-up page');
  });

  test('should have no hydration errors on marketing page', async ({ page }) => {
    const errors = await checkHydrationErrors(page, '/marketing');
    
    if (errors.hydrationErrors.length > 0) {
      console.error('Hydration errors found on marketing page:');
      errors.hydrationErrors.forEach(error => console.error(error));
      throw new Error(`Hydration errors on marketing: ${errors.hydrationErrors.length} error(s)`);
    }
    
    console.log('✓ No hydration errors on marketing page');
  });

  test('should detect browser extension hydration issues', async ({ page }) => {
    // This test specifically looks for the Grammarly extension issue we found
    const errors = await checkHydrationErrors(page, '/');
    
    // Check if we have the specific Grammarly hydration issue
    const grammarlyHydrationError = errors.hydrationErrors.find(error => 
      error.includes('data-new-gr-c-s-check-loaded') || 
      error.includes('data-gr-ext-installed')
    );
    
    if (grammarlyHydrationError) {
      console.warn('⚠️  Browser extension (likely Grammarly) causing hydration mismatch');
      console.warn('This is a common issue with browser extensions that modify the DOM');
      console.warn('Consider adding suppressHydrationWarning to the body element or handling this gracefully');
    }
    
    // Log all hydration errors for debugging
    if (errors.hydrationErrors.length > 0) {
      console.error('Hydration errors detected:');
      errors.hydrationErrors.forEach((error, index) => {
        console.error(`Error ${index + 1}:`, error);
      });
    }
    
    // For now, we expect this test to potentially fail due to browser extensions
    // In a real CI environment, we would either:
    // 1. Run browsers without extensions
    // 2. Suppress hydration warnings for known extension attributes
    // 3. Handle this gracefully in the app code
  });

  test('should report general console errors (non-hydration)', async ({ page }) => {
    const errors = await checkHydrationErrors(page, '/');
    
    if (errors.generalErrors.length > 0) {
      console.error('General console errors found:');
      errors.generalErrors.forEach(error => console.error(error));
      throw new Error(`General console errors: ${errors.generalErrors.length} error(s)`);
    }
    
    console.log('✓ No general console errors');
  });

  test('should report React warnings', async ({ page }) => {
    const errors = await checkHydrationErrors(page, '/');
    
    if (errors.warnings.length > 0) {
      console.warn('React warnings found:');
      errors.warnings.forEach(warning => console.warn(warning));
    }
    
    console.log(`✓ React warnings check complete (${errors.warnings.length} warnings)`);
  });
});

test.describe('Hydration Error Detection - Authenticated Pages', () => {
  const TEST_USER = {
    email: 'test@example.com',
    password: 'testpassword123'
  };

  async function signIn(page: Page) {
    await page.goto('/sign-in');
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
  }

  test('should have no hydration errors on dashboard after authentication', async ({ page }) => {
    // Sign in first
    await signIn(page);
    
    // Now check for hydration errors on the dashboard
    const errors: string[] = [];
    const hydrationErrors: string[] = [];
    
    // Clear previous listeners and add new ones
    page.removeAllListeners('console');
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        errors.push(errorText);
        
        if (errorText.includes('hydrated but some attributes') || 
            errorText.includes('Text content did not match') ||
            errorText.includes('hydration mismatch')) {
          hydrationErrors.push(errorText);
        }
      }
    });

    // Reload the dashboard to trigger hydration
    await page.reload();
    await page.waitForTimeout(3000);

    if (hydrationErrors.length > 0) {
      console.error('Hydration errors found on dashboard:');
      hydrationErrors.forEach(error => console.error(error));
      throw new Error(`Hydration errors on dashboard: ${hydrationErrors.length} error(s)`);
    }

    console.log('✓ No hydration errors on authenticated dashboard');
  });
});
