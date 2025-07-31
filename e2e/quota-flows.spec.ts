// e2e/quota-flows.spec.ts - DISABLED (quota system removed)
// This test file has been disabled because the quota middleware and payment system
// have been removed to eliminate usage restrictions from the application.

/*
import { test, expect, type Page } from '@playwright/test';

// Test users for different subscription tiers
const FREE_USER = {
  email: 'free-user@example.com',
  password: 'freeuser123',
  name: 'Free User'
};

const PREMIUM_USER = {
  email: 'premium-user@example.com', 
  password: 'premiumuser123',
  name: 'Premium User'
};

// Helper functions
async function signIn(page: Page, user: typeof FREE_USER) {
  await page.goto('/sign-in');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
}

async function clearAuthState(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.log('Storage access denied');
    }
  });
}

async function generateInterviews(page: Page, count: number = 1): Promise<boolean> {
  for (let i = 0; i < count; i++) {
    // Navigate to interview generation page
    await page.goto('/dashboard/interview');
    
    // Fill out interview generation form
    await page.selectOption('select[name="type"]', 'technical');
    await page.fill('input[name="role"]', 'Software Engineer');
    await page.selectOption('select[name="level"]', 'Senior');
    await page.fill('input[name="techstack"]', 'React, Node.js');
    await page.fill('input[name="amount"]', '3');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check if request was successful or quota exceeded
    const isQuotaExceeded = await page.locator('text=upgrade').isVisible({ timeout: 5000 }).catch(() => false);
    if (isQuotaExceeded) {
      return false; // Quota exceeded
    }
    
    // Wait for generation to complete
    await page.waitForSelector('text=Interview questions generated', { timeout: 30000 });
  }
  return true; // All generations successful
}

async function tailorResume(page: Page): Promise<boolean> {
  await page.goto('/dashboard/resume-tailor');
  
  // Upload or paste resume text
  await page.fill('textarea[name="resumeText"]', 'John Doe\nSoftware Engineer\n5 years experience with React and Node.js');
  await page.fill('textarea[name="jobDescription"]', 'Looking for Senior React Developer with TypeScript experience');
  
  await page.click('button[type="submit"]');
  
  // Check if quota exceeded
  const isQuotaExceeded = await page.locator('text=upgrade').isVisible({ timeout: 5000 }).catch(() => false);
  return !isQuotaExceeded;
}

async function applyToJob(page: Page): Promise<boolean> {
  await page.goto('/dashboard/auto-apply');
  
  // Mock job application
  await page.fill('input[name="jobTitle"]', 'Senior React Developer');
  await page.fill('input[name="company"]', 'Tech Corp');
  await page.fill('input[name="jobUrl"]', 'https://example.com/job/123');
  
  await page.click('button[type="submit"]');
  
  // Check if quota exceeded
  const isQuotaExceeded = await page.locator('text=upgrade').isVisible({ timeout: 5000 }).catch(() => false);
  return !isQuotaExceeded;
}

test.describe('Quota Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test.describe('Free User Quota Limits', () => {
    test('free user hits interview generation limit and sees upgrade prompt', async ({ page }) => {
      await signIn(page, FREE_USER);
      
      console.log('Testing interview generation quota for free user...');
      
      // Generate interviews until quota is hit
      let generationCount = 0;
      let quotaExceeded = false;
      
      for (let i = 0; i < 10; i++) { // Max 10 attempts to avoid infinite loop
        const success = await generateInterviews(page, 1);
        
        if (success) {
          generationCount++;
          console.log(`✓ Generated interview #${generationCount}`);
        } else {
          quotaExceeded = true;
          console.log(`❌ Quota exceeded after ${generationCount} generations`);
          break;
        }
      }
      
      expect(quotaExceeded).toBe(true);
      
      // Verify upgrade prompt is displayed
      await expect(page.locator('text=upgrade')).toBeVisible();
      await expect(page.locator('text=premium', { exact: false })).toBeVisible();
      
      // Check for upgrade CTA button
      const upgradeButton = page.locator('a[href="/account/billing"], button:has-text("upgrade")').first();
      await expect(upgradeButton).toBeVisible();
      
      // Click upgrade button and verify redirect to billing
      await upgradeButton.click();
      await expect(page).toHaveURL(/.*\/account\/billing/, { timeout: 10000 });
      
      console.log('✓ Free user successfully redirected to pricing after hitting quota limit');
    });

    test('free user hits resume tailoring limit', async ({ page }) => {
      await signIn(page, FREE_USER);
      
      console.log('Testing resume tailoring quota for free user...');
      
      let tailoringCount = 0;
      let quotaExceeded = false;
      
      // Attempt resume tailoring until quota exceeded
      for (let i = 0; i < 10; i++) {
        const success = await tailorResume(page);
        
        if (success) {
          tailoringCount++;
          console.log(`✓ Tailored resume #${tailoringCount}`);
          await page.waitForTimeout(2000); // Prevent rate limiting
        } else {
          quotaExceeded = true;
          console.log(`❌ Resume tailoring quota exceeded after ${tailoringCount} attempts`);
          break;
        }
      }
      
      if (quotaExceeded) {
        // Verify upgrade messaging
        await expect(page.locator('text*=resume tailoring limit')).toBeVisible();
        await expect(page.locator('text=upgrade')).toBeVisible();
        
        console.log('✓ Resume tailoring quota properly enforced for free user');
      } else {
        console.log('⚠ Resume tailoring quota not reached in test limits');
      }
    });

    test('free user hits auto-apply limit', async ({ page }) => {
      await signIn(page, FREE_USER);
      
      console.log('Testing auto-apply quota for free user...');
      
      let applicationCount = 0;
      let quotaExceeded = false;
      
      // Attempt auto-apply until quota exceeded
      for (let i = 0; i < 20; i++) { // Auto-apply typically has higher limits
        const success = await applyToJob(page);
        
        if (success) {
          applicationCount++;
          console.log(`✓ Applied to job #${applicationCount}`);
          await page.waitForTimeout(1000);
        } else {
          quotaExceeded = true;
          console.log(`❌ Auto-apply quota exceeded after ${applicationCount} applications`);
          break;
        }
      }
      
      if (quotaExceeded) {
        // Verify upgrade messaging
        await expect(page.locator('text*=auto-apply.*limit')).toBeVisible();
        await expect(page.locator('text=upgrade')).toBeVisible();
        
        console.log('✓ Auto-apply quota properly enforced for free user');
      } else {
        console.log('⚠ Auto-apply quota not reached in test limits');
      }
    });
  });

  test.describe('Premium User Unlimited Access', () => {
    test('premium user has unlimited interview generations', async ({ page }) => {
      await signIn(page, PREMIUM_USER);
      
      console.log('Testing unlimited interview generation for premium user...');
      
      // Test multiple generations to ensure no quota limits
      const testGenerations = 15; // More than free tier limit
      let successCount = 0;
      
      for (let i = 0; i < testGenerations; i++) {
        const success = await generateInterviews(page, 1);
        
        if (success) {
          successCount++;
          console.log(`✓ Premium user generated interview #${successCount}`);
        } else {
          console.error(`❌ Premium user hit quota limit at generation #${successCount}`);
          break;
        }
        
        // Small delay to prevent overwhelming the system
        if (i % 5 === 0) {
          await page.waitForTimeout(2000);
        }
      }
      
      expect(successCount).toBeGreaterThanOrEqual(10); // Should be well above free limit
      console.log(`✓ Premium user successfully generated ${successCount} interviews without quota limits`);
    });

    test('premium user has unlimited resume tailoring', async ({ page }) => {
      await signIn(page, PREMIUM_USER);
      
      console.log('Testing unlimited resume tailoring for premium user...');
      
      const testTailoring = 8; // More than free tier limit
      let successCount = 0;
      
      for (let i = 0; i < testTailoring; i++) {
        const success = await tailorResume(page);
        
        if (success) {
          successCount++;
          console.log(`✓ Premium user tailored resume #${successCount}`);
        } else {
          console.error(`❌ Premium user hit quota limit at tailoring #${successCount}`);
          break;
        }
        
        await page.waitForTimeout(3000); // Longer delay for AI processing
      }
      
      expect(successCount).toBeGreaterThanOrEqual(5); // Should be well above free limit
      console.log(`✓ Premium user successfully tailored ${successCount} resumes without quota limits`);
    });

    test('premium user has unlimited auto-apply', async ({ page }) => {
      await signIn(page, PREMIUM_USER);
      
      console.log('Testing unlimited auto-apply for premium user...');
      
      const testApplications = 25; // More than free tier limit
      let successCount = 0;
      
      for (let i = 0; i < testApplications; i++) {
        const success = await applyToJob(page);
        
        if (success) {
          successCount++;
          console.log(`✓ Premium user applied to job #${successCount}`);
        } else {
          console.error(`❌ Premium user hit quota limit at application #${successCount}`);
          break;
        }
        
        await page.waitForTimeout(1000);
      }
      
      expect(successCount).toBeGreaterThanOrEqual(20); // Should be well above free limit
      console.log(`✓ Premium user successfully applied to ${successCount} jobs without quota limits`);
    });
  });

  test.describe('Quota Reset and Edge Cases', () => {
    test('quota counters display correctly in dashboard', async ({ page }) => {
      await signIn(page, FREE_USER);
      
      // Navigate to dashboard usage/stats section
      await page.goto('/dashboard/usage');
      
      // Verify usage counters are displayed
      await expect(page.locator('text*=interview')).toBeVisible();
      await expect(page.locator('text*=resume')).toBeVisible();
      await expect(page.locator('text*=applications')).toBeVisible();
      
      // Check for progress bars or usage indicators
      const usageIndicators = page.locator('[data-testid*="usage"], .usage-progress, .progress-bar');
      const indicatorCount = await usageIndicators.count();
      expect(indicatorCount).toBeGreaterThan(0);
      
      console.log('✓ Usage counters properly displayed in dashboard');
    });

    test('mixed feature usage within quotas', async ({ page }) => {
      await signIn(page, FREE_USER);
      
      console.log('Testing mixed feature usage for free user...');
      
      // Use a mix of features within reasonable limits
      let interviewSuccess = await generateInterviews(page, 2);
      expect(interviewSuccess).toBe(true);
      console.log('✓ Generated 2 interviews');
      
      let resumeSuccess = await tailorResume(page);
      expect(resumeSuccess).toBe(true);
      console.log('✓ Tailored 1 resume');
      
      let applySuccess = await applyToJob(page);
      expect(applySuccess).toBe(true);
      console.log('✓ Applied to 1 job');
      
      console.log('✓ Mixed feature usage successful within quota limits');
    });
  });

  test.describe('Upgrade Flow Integration', () => {
    test('upgrade flow from quota limit screen', async ({ page }) => {
      await signIn(page, FREE_USER);
      
      // Navigate to a feature and use until quota exceeded
      await page.goto('/dashboard/interviews');
      
      // Simulate quota exceeded state (might need to generate multiple interviews first)
      // For testing purposes, we can simulate this condition
      
      console.log('Testing upgrade flow integration...');
      
      // Check if upgrade prompt appears or navigate to pricing directly
      await page.goto('/pricing');
      
      // Verify pricing page loads correctly
      await expect(page.locator('text=premium', { exact: false })).toBeVisible();
      await expect(page.locator('text=upgrade', { exact: false })).toBeVisible();
      
      // Look for pricing tiers
      const pricingCards = page.locator('.pricing-card, [data-testid*="pricing"], .plan-card');
      const cardCount = await pricingCards.count();
      expect(cardCount).toBeGreaterThan(0);
      
      console.log('✓ Pricing page displays correctly from quota limit');
    });
  });
});
*/
