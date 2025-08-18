import { Page, expect } from '@playwright/test';

// Environment-specific configuration
export const getTestConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseURL = isProduction ? 'https://prepbettr.azurewebsites.net' : 'http://localhost:3000';
  
  return {
    baseURL,
    isProduction,
    // Adjust timeouts based on environment
    defaultTimeout: isProduction ? 30000 : 15000,
    shortTimeout: isProduction ? 10000 : 5000,
  };
};

// Test data management
export const TEST_USERS = {
  existing: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'testpassword123',
    name: 'Test User'
  },
  new: {
    email: `newuser+${Date.now()}@example.com`, // Unique email for each test run
    password: 'newpassword123',
    name: 'New Test User'
  }
};

// Authentication helper functions
export class AuthHelper {
  constructor(private page: Page) {}

  async clearAuthState() {
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  async signUp(user: { name: string; email: string; password: string }) {
    const config = getTestConfig();
    
    await this.page.goto('/sign-up');
    await expect(this.page).toHaveURL(/.*\/sign-up/);

    // Fill the form
    await this.page.fill('input[name="name"]', user.name);
    await this.page.fill('input[name="email"]', user.email);
    await this.page.fill('input[name="password"]', user.password);

    // Submit and wait for response
    await this.page.click('button[type="submit"]');
    
    // Wait for redirect to sign-in page
    await expect(this.page).toHaveURL(/.*\/sign-in/, { timeout: config.defaultTimeout });
    
    return { success: true };
  }

  async signIn(user: { email: string; password: string }) {
    const config = getTestConfig();
    
    await this.page.goto('/sign-in');
    await expect(this.page).toHaveURL(/.*\/sign-in/);

    // Fill credentials
    await this.page.fill('input[name="email"]', user.email);
    await this.page.fill('input[name="password"]', user.password);

    // Submit form
    await this.page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(this.page).toHaveURL(/.*\/dashboard/, { timeout: config.defaultTimeout });
    
    return { success: true };
  }

  async signOut() {
    const config = getTestConfig();
    
    // Look for sign-out button - try multiple selectors
    const signOutSelectors = [
      'text=Sign out',
      '[data-testid="logout"]',
      'button:has-text("Sign out")',
      'a:has-text("Sign out")'
    ];

    let signedOut = false;
    for (const selector of signOutSelectors) {
      try {
        await this.page.click(selector, { timeout: config.shortTimeout });
        signedOut = true;
        break;
      } catch (error) {
        // Try next selector
        continue;
      }
    }

    if (!signedOut) {
      throw new Error('Could not find sign-out button');
    }

    // Wait for redirect to sign-in
    await expect(this.page).toHaveURL(/.*\/sign-in/, { timeout: config.defaultTimeout });
    
    return { success: true };
  }

  async isAuthenticated(): Promise<boolean> {
    const config = getTestConfig();
    
    try {
      await this.page.goto('/dashboard');
      await this.page.waitForURL(/.*\/dashboard/, { timeout: config.shortTimeout });
      return true;
    } catch (error) {
      return false;
    }
  }

  async waitForAuthenticationState(shouldBeAuthenticated: boolean) {
    const config = getTestConfig();
    
    if (shouldBeAuthenticated) {
      await expect(this.page).toHaveURL(/.*\/dashboard/, { timeout: config.defaultTimeout });
      await expect(this.page.locator('text="PrepBettr"')).toBeVisible();
    } else {
      await this.page.goto('/dashboard');
      await expect(this.page).toHaveURL(/.*\/sign-in/, { timeout: config.defaultTimeout });
    }
  }
}

// Network monitoring helper
export class NetworkHelper {
  constructor(private page: Page) {}

  async monitorAuthRequests() {
    const authRequests: any[] = [];
    
    this.page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/auth/') || url.includes('/sign-in') || url.includes('/dashboard')) {
        authRequests.push({
          method: request.method(),
          url: url,
          timestamp: Date.now()
        });
      }
    });

    this.page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/auth/') || url.includes('/sign-in') || url.includes('/dashboard')) {
        const matchingRequest = authRequests.find(req => req.url === url);
        if (matchingRequest) {
          matchingRequest.status = response.status();
          matchingRequest.responseTime = Date.now() - matchingRequest.timestamp;
        }
      }
    });

    return authRequests;
  }

  async waitForNetworkIdle(timeout = 5000) {
    await this.page.waitForLoadState('networkidle', { timeout });
  }
}

// Visual regression helper
export class VisualHelper {
  constructor(private page: Page) {}

  async takeScreenshot(name: string) {
    const config = getTestConfig();
    const screenshotPath = `screenshots/${config.isProduction ? 'prod' : 'dev'}-${name}.png`;
    await this.page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  }

  async compareVisualState(name: string) {
    await expect(this.page).toHaveScreenshot(`${name}.png`);
  }
}

// Error handling helper
export class ErrorHelper {
  constructor(private page: Page) {}

  async captureConsoleErrors() {
    const errors: string[] = [];
    
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    this.page.on('pageerror', error => {
      errors.push(`Page error: ${error.message}`);
    });

    return errors;
  }

  async checkForAuthErrors() {
    const config = getTestConfig();
    
    // Look for common error messages
    const errorSelectors = [
      'text*="error"',
      'text*="Error"',
      'text*="failed"',
      'text*="Failed"',
      '[role="alert"]',
      '.error',
      '.alert-error'
    ];

    const errors = [];
    for (const selector of errorSelectors) {
      try {
        const element = await this.page.locator(selector).first();
        if (await element.isVisible({ timeout: config.shortTimeout })) {
          const text = await element.textContent();
          errors.push(text);
        }
      } catch (error) {
        // Element not found, continue
      }
    }

    return errors;
  }
}

// Performance monitoring helper  
export class PerformanceHelper {
  constructor(private page: Page) {}

  async measurePageLoadTime(url: string) {
    const startTime = Date.now();
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
    const endTime = Date.now();
    
    return endTime - startTime;
  }

  async measureAuthFlowPerformance() {
    const metrics = {
      signInPageLoad: 0,
      signInSubmission: 0,
      dashboardLoad: 0,
      total: 0
    };

    const totalStart = Date.now();

    // Measure sign-in page load
    const signInStart = Date.now();
    await this.page.goto('/sign-in');
    await this.page.waitForLoadState('domcontentloaded');
    metrics.signInPageLoad = Date.now() - signInStart;

    // Measure form submission and redirect
    const submissionStart = Date.now();
    await this.page.fill('input[name="email"]', TEST_USERS.existing.email);
    await this.page.fill('input[name="password"]', TEST_USERS.existing.password);
    await this.page.click('button[type="submit"]');
    
    // Wait for dashboard
    await expect(this.page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
    metrics.signInSubmission = Date.now() - submissionStart;

    // Measure dashboard load
    const dashboardStart = Date.now();
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.locator('text="PrepBettr"')).toBeVisible();
    metrics.dashboardLoad = Date.now() - dashboardStart;

    metrics.total = Date.now() - totalStart;

    return metrics;
  }
}
