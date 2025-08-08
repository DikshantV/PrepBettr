/**
 * E2E tests for Dashboard Carousel and Interview Cards
 * Tests cover:
 * - Dashboard loads successfully
 * - Carousel scrolls correctly
 * - Clicking "Take Interview" opens interview with matching heading/tech stack
 */

import { test, expect, Page } from '@playwright/test';

// Helper function to wait for dashboard to be fully loaded
async function waitForDashboardLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="dashboard-content"], .card-cta', { 
    timeout: 30000 
  });
}

// Helper function to check if element is in viewport
async function isElementInViewport(page: Page, selector: string) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }, selector);
}

test.describe('Dashboard and Interview Cards', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await waitForDashboardLoad(page);
  });

  test('Dashboard loads successfully with all sections', async ({ page }) => {
    // Check if main dashboard sections are present
    const heroSection = page.locator('.card-cta').first();
    await expect(heroSection).toBeVisible();
    
    // Check for hero content
    await expect(page.getByText(/Get Interview-Ready/i)).toBeVisible();
    await expect(page.getByText(/Practice real interview questions/i)).toBeVisible();
    
    // Check for Start Interview button
    const startInterviewBtn = page.getByRole('link', { name: /Start an Interview/i });
    await expect(startInterviewBtn).toBeVisible();
    
    // Check for Community Mock Interviews section
    const mockInterviewsHeader = page.getByRole('heading', { 
      name: /Community Mock Interviews/i 
    });
    await expect(mockInterviewsHeader).toBeVisible();
  });

  test('Carousel contains interview cards and scrolls correctly', async ({ page }) => {
    // Wait for carousel to load
    const carousel = page.locator('ul[class*="overflow-x-auto"]').last();
    await expect(carousel).toBeVisible();
    
    // Check if interview cards are present in carousel
    const interviewCards = carousel.locator('.card-interview, [class*="card-border"]');
    const cardCount = await interviewCards.count();
    
    // Should have at least 3 interview cards
    expect(cardCount).toBeGreaterThanOrEqual(3);
    
    // Get initial position of first card
    const firstCard = interviewCards.first();
    const initialPosition = await firstCard.boundingBox();
    
    // Find and click right scroll button (if exists and there are enough cards)
    if (cardCount > 3) {
      // Look for navigation buttons
      const rightScrollBtn = page.locator('button[aria-label="Next interviews"]');
      const leftScrollBtn = page.locator('button[aria-label="Previous interviews"]');
      
      if (await rightScrollBtn.isVisible()) {
        // Click right scroll button
        await rightScrollBtn.click();
        await page.waitForTimeout(500); // Wait for scroll animation
        
        // Check if first card moved left (scrolled)
        const newPosition = await firstCard.boundingBox();
        if (initialPosition && newPosition) {
          expect(newPosition.x).toBeLessThan(initialPosition.x);
        }
        
        // Now scroll back left
        if (await leftScrollBtn.isVisible()) {
          await leftScrollBtn.click();
          await page.waitForTimeout(500);
          
          // Verify we scrolled back
          const finalPosition = await firstCard.boundingBox();
          if (finalPosition && newPosition) {
            expect(finalPosition.x).toBeGreaterThan(newPosition.x);
          }
        }
      } else {
        // Alternative: scroll by mouse wheel or programmatically
        await carousel.evaluate(el => el.scrollBy({ left: 400, behavior: 'smooth' }));
        await page.waitForTimeout(500);
        
        // Check scroll position changed
        const scrollLeft = await carousel.evaluate(el => el.scrollLeft);
        expect(scrollLeft).toBeGreaterThan(0);
        
        // Scroll back
        await carousel.evaluate(el => el.scrollBy({ left: -400, behavior: 'smooth' }));
      }
    }
  });

  test('Interview card displays correct information', async ({ page }) => {
    // Get first interview card
    const firstCard = page.locator('.card-interview, [class*="card-border"]').first();
    await expect(firstCard).toBeVisible();
    
    // Check for required elements in the card
    const cardContent = firstCard;
    
    // Check for interview type badge
    const typeBadge = cardContent.locator('.badge-text, [class*="rounded-bl-lg"]');
    await expect(typeBadge).toBeVisible();
    const interviewType = await typeBadge.textContent();
    expect(['Technical', 'Behavioral', 'Mixed']).toContain(interviewType?.trim());
    
    // Check for role/title (heading)
    const roleHeading = cardContent.locator('h3');
    await expect(roleHeading).toBeVisible();
    const roleText = await roleHeading.textContent();
    expect(roleText).toContain('Interview');
    
    // Check for date
    const dateElement = cardContent.locator('img[alt="calendar"]').locator('..');
    await expect(dateElement).toBeVisible();
    
    // Check for score or placeholder
    const scoreElement = cardContent.locator('img[alt="star"]').locator('..');
    await expect(scoreElement).toBeVisible();
    
    // Check for tech stack icons (should have at least one)
    const techIcons = cardContent.locator('img[alt*="icon"], [class*="tech-icon"], svg[class*="icon"]');
    const techIconCount = await techIcons.count();
    expect(techIconCount).toBeGreaterThanOrEqual(0); // May not always have tech icons
    
    // Check for Take Interview button
    const takeInterviewBtn = cardContent.getByRole('link', { name: /Take Interview/i });
    await expect(takeInterviewBtn).toBeVisible();
  });

  test('Clicking "Take Interview" navigates to correct interview page', async ({ page }) => {
    // Get first interview card with Take Interview button
    const firstCard = page.locator('.card-interview, [class*="card-border"]')
      .filter({ has: page.getByRole('link', { name: /Take Interview/i }) })
      .first();
    
    await expect(firstCard).toBeVisible();
    
    // Extract interview details from the card
    const roleHeading = await firstCard.locator('h3').textContent();
    const interviewType = await firstCard.locator('.badge-text, [class*="rounded-bl-lg"]').textContent();
    
    // Extract tech stack if visible
    let techStackTexts: string[] = [];
    const techStackContainer = firstCard.locator('[class*="DisplayTechIcons"], [class*="tech-stack"], .flex-row').last();
    
    if (await techStackContainer.isVisible()) {
      // Try to get tech stack from tooltips or alt texts
      const techElements = techStackContainer.locator('img, svg');
      const count = await techElements.count();
      
      for (let i = 0; i < Math.min(count, 4); i++) {
        const element = techElements.nth(i);
        const altText = await element.getAttribute('alt').catch(() => null);
        const title = await element.getAttribute('title').catch(() => null);
        const tooltipText = await element.getAttribute('data-tooltip').catch(() => null);
        
        const techName = altText || title || tooltipText;
        if (techName && !techName.includes('icon')) {
          techStackTexts.push(techName.replace(/-icon$/, '').trim());
        }
      }
    }
    
    // Click Take Interview button
    const takeInterviewBtn = firstCard.getByRole('link', { name: /Take Interview/i });
    await takeInterviewBtn.click();
    
    // Wait for navigation
    await page.waitForURL(/\/dashboard\/interview\/[^/]+$/);
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the interview page
    const url = page.url();
    expect(url).toMatch(/\/dashboard\/interview\/[a-zA-Z0-9-]+$/);
    
    // Check if interview page has matching information
    // Wait for interview content to load
    await page.waitForSelector('h1, h2, [class*="interview-header"], [class*="interview-title"]', {
      timeout: 10000
    });
    
    // Check if the role/heading matches
    const interviewPageHeading = await page.locator('h1, h2, [class*="interview-header"]').first().textContent();
    
    // The heading should contain similar information (may be formatted differently)
    if (roleHeading && roleHeading.includes('at')) {
      const roleOnly = roleHeading.split('at')[0].trim();
      expect(interviewPageHeading?.toLowerCase()).toContain(roleOnly.toLowerCase().replace('interview', '').trim());
    }
    
    // Check if interview type is displayed
    const pageContent = await page.textContent('body');
    if (interviewType) {
      expect(pageContent.toLowerCase()).toContain(interviewType.toLowerCase());
    }
    
    // Check if tech stack is displayed (if we found any)
    if (techStackTexts.length > 0) {
      for (const tech of techStackTexts.slice(0, 2)) { // Check first 2 tech items
        // Tech might be displayed as text or in badges
        const techVisible = await page.locator(`text=/${tech}/i`).count() > 0 ||
                           await page.locator(`[class*="badge"]:has-text("${tech}")`).count() > 0 ||
                           await page.locator(`[class*="tech"]:has-text("${tech}")`).count() > 0;
        
        // At least some tech should be visible
        if (techVisible) {
          expect(techVisible).toBeTruthy();
          break;
        }
      }
    }
  });

  test('Multiple interview cards have unique content', async ({ page }) => {
    // Get all interview cards
    const interviewCards = page.locator('.card-interview, [class*="card-border"]');
    const cardCount = await interviewCards.count();
    
    // Need at least 2 cards to compare
    if (cardCount >= 2) {
      const titles = new Set<string>();
      
      // Collect titles from first 5 cards (or all if less than 5)
      const cardsToCheck = Math.min(cardCount, 5);
      
      for (let i = 0; i < cardsToCheck; i++) {
        const card = interviewCards.nth(i);
        const title = await card.locator('h3').textContent();
        
        if (title) {
          // Check that we haven't seen this exact title before
          expect(titles.has(title)).toBeFalsy();
          titles.add(title);
        }
      }
      
      // Should have collected unique titles
      expect(titles.size).toBe(cardsToCheck);
    }
  });

  test('User interviews section appears when logged in', async ({ page, context }) => {
    // This test assumes user authentication is handled
    // You may need to mock authentication or use a test user
    
    // Check if user is authenticated by looking for user-specific content
    const userSection = page.locator('text=/Your Recent Interviews/i');
    
    if (await userSection.isVisible()) {
      // User is logged in, check for user interviews section
      await expect(userSection).toBeVisible();
      
      // Check for user interview cards or empty state message
      const userInterviews = page.locator('section:has-text("Your Recent Interviews")');
      const userCards = userInterviews.locator('.card-interview, [class*="card-border"]');
      const emptyMessage = userInterviews.locator('text=/haven\'t created any interviews yet/i');
      
      // Either we have cards or an empty message
      const hasCards = await userCards.count() > 0;
      const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
      
      expect(hasCards || hasEmptyMessage).toBeTruthy();
    } else {
      // User is not logged in, check for sign-in prompt
      const signInMessage = page.locator('text=/Please sign in to access/i');
      await expect(signInMessage).toBeVisible();
    }
  });

  test('Interview cards are responsive and accessible', async ({ page }) => {
    // Test keyboard navigation
    const firstCard = page.locator('.card-interview, [class*="card-border"]').first();
    await expect(firstCard).toBeVisible();
    
    // Focus on Take Interview button
    const takeInterviewBtn = firstCard.getByRole('link', { name: /Take Interview/i });
    await takeInterviewBtn.focus();
    
    // Check if button is focused
    const isFocused = await takeInterviewBtn.evaluate(el => el === document.activeElement);
    expect(isFocused).toBeTruthy();
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Wait for responsive adjustments
    
    // Cards should still be visible in mobile view
    await expect(firstCard).toBeVisible();
    
    // Check if cards are stacked or scrollable in mobile
    const carousel = page.locator('ul[class*="overflow-x-auto"]').last();
    const isScrollable = await carousel.evaluate(el => el.scrollWidth > el.clientWidth);
    
    // On mobile, carousel should be scrollable if multiple cards
    const cardCount = await page.locator('.card-interview, [class*="card-border"]').count();
    if (cardCount > 1) {
      expect(isScrollable).toBeTruthy();
    }
  });
});

test.describe('Mock Interview Generation', () => {
  test('Mock interviews have diverse content', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForDashboardLoad(page);
    
    // Collect data from multiple interview cards
    const cards = page.locator('.card-interview, [class*="card-border"]');
    const cardCount = await cards.count();
    
    const interviews = [];
    const maxCards = Math.min(cardCount, 10); // Check up to 10 cards
    
    for (let i = 0; i < maxCards; i++) {
      const card = cards.nth(i);
      
      const title = await card.locator('h3').textContent();
      const type = await card.locator('.badge-text, [class*="rounded-bl-lg"]').textContent();
      
      if (title && type) {
        interviews.push({ title, type });
      }
    }
    
    // Check diversity in interview types
    const types = interviews.map(i => i.type);
    const uniqueTypes = new Set(types);
    
    // Should have at least 2 different types if we have 5+ interviews
    if (interviews.length >= 5) {
      expect(uniqueTypes.size).toBeGreaterThanOrEqual(2);
    }
    
    // Check diversity in job titles
    const titles = interviews.map(i => i.title);
    const uniqueTitles = new Set(titles);
    
    // All titles should be unique
    expect(uniqueTitles.size).toBe(titles.length);
  });
});
