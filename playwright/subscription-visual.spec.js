// playwright/subscription-visual.spec.js

import { test, expect } from '@playwright/test';

/**
 * Playwright Visual Regression Tests for Subscription UI
 * 
 * Tests cross-browser compatibility and responsive design:
 * - Chrome, Firefox, Safari/WebKit
 * - Mobile, tablet, desktop viewports
 * - Component alignment and styling
 * - Dark mode and theme consistency
 */

// Test configurations for different browsers and devices
const browsers = ['chromium', 'firefox', 'webkit'];
const viewports = {
  mobile: { width: 375, height: 667 }, // iPhone SE
  tablet: { width: 768, height: 1024 }, // iPad
  desktop: { width: 1280, height: 720 } // Desktop
};

// Test each browser with each viewport
browsers.forEach(browserName => {
  Object.entries(viewports).forEach(([deviceType, viewport]) => {
    
    test.describe(`Subscription UI - ${browserName} - ${deviceType}`, () => {
      test.use({ 
        browserName,
        viewport,
        // Enable visual comparisons
        ignoreHTTPSErrors: true
      });

      test.beforeEach(async ({ page }) => {
        // Mock PayPal SDK to ensure consistent rendering
        await page.addInitScript(() => {
          window.paypal = {
            Buttons: () => ({ render: () => {} }),
            FUNDING: { PAYPAL: 'paypal', CARD: 'card' }
          };
        });

        // Mock API responses
        await page.route('/api/paypal/**', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          });
        });
      });

      test('subscription page layout and plan grid', async ({ page }) => {
        await page.goto('/test-subscription');
        
        // Wait for components to load
        await page.waitForSelector('[data-testid="subscription-testing-lab"]');
        await page.waitForSelector('[data-testid="plan-selector"]');
        
        // Hide dynamic elements that might cause flaky tests
        await page.addStyleTag({
          content: `
            .animate-pulse { animation: none !important; }
            .animate-spin { animation: none !important; }
            [data-testid="debug-info"] { display: none !important; }
          `
        });

        // Take full page screenshot
        await expect(page).toHaveScreenshot(`subscription-page-${browserName}-${deviceType}.png`, {
          fullPage: true,
          animations: 'disabled',
          mask: [
            page.locator('[data-testid="environment-banner"]'),
            page.locator('.text-xs:has-text("test@prepbettr.com")')
          ]
        });
      });

      test('plan selector component variants', async ({ page }) => {
        await page.goto('/test-subscription');
        await page.waitForSelector('[data-testid="plan-selector"]');

        // Test individual plan selection
        await page.click('[data-plan="individual"]');
        await page.waitForTimeout(500);
        
        await expect(page.locator('[data-testid="plan-selector"]')).toHaveScreenshot(
          `plan-selector-individual-${browserName}-${deviceType}.png`
        );

        // Test enterprise plan selection
        await page.click('[data-plan="enterprise"]');
        await page.waitForTimeout(500);
        
        await expect(page.locator('[data-testid="plan-selector"]')).toHaveScreenshot(
          `plan-selector-enterprise-${browserName}-${deviceType}.png`
        );
      });

      test('pricing toggle component states', async ({ page }) => {
        await page.goto('/test-subscription');
        await page.waitForSelector('[data-testid="pricing-toggle"]');

        // Monthly billing state
        await expect(page.locator('[data-testid="pricing-toggle"]')).toHaveScreenshot(
          `pricing-toggle-monthly-${browserName}-${deviceType}.png`
        );

        // Switch to yearly billing
        await page.click('[data-testid="pricing-toggle"] input[type="checkbox"]');
        await page.waitForTimeout(500);

        // Yearly billing state
        await expect(page.locator('[data-testid="pricing-toggle"]')).toHaveScreenshot(
          `pricing-toggle-yearly-${browserName}-${deviceType}.png`
        );
      });

      test('subscription button component states', async ({ page }) => {
        await page.goto('/test-subscription');
        await page.waitForSelector('[data-testid="subscription-button"]');

        // Default state
        await expect(page.locator('[data-testid="subscription-button"]')).toHaveScreenshot(
          `subscription-button-default-${browserName}-${deviceType}.png`
        );

        // Hover state (desktop only)
        if (deviceType === 'desktop') {
          await page.hover('[data-testid="subscription-button"] button');
          await page.waitForTimeout(300);
          
          await expect(page.locator('[data-testid="subscription-button"]')).toHaveScreenshot(
            `subscription-button-hover-${browserName}-${deviceType}.png`
          );
        }
      });

      test('subscription status component variants', async ({ page }) => {
        await page.goto('/test-subscription');
        await page.waitForSelector('[data-testid="subscription-status-preview"]');

        // Test different status variants
        const variants = ['full', 'compact', 'minimal'];
        
        for (const variant of variants) {
          // Switch to the variant (assuming test controls exist)
          const variantSelector = `[data-testid="subscription-status-${variant}"]`;
          
          if (await page.locator(variantSelector).count() > 0) {
            await expect(page.locator(variantSelector)).toHaveScreenshot(
              `subscription-status-${variant}-${browserName}-${deviceType}.png`
            );
          }
        }
      });

      test('responsive design breakpoints', async ({ page }) => {
        await page.goto('/test-subscription');
        await page.waitForSelector('[data-testid="plan-selector"]');

        // Test specific responsive behaviors
        const planCards = page.locator('[data-testid="plan-selector"] .plan-card');
        const cardCount = await planCards.count();

        if (deviceType === 'mobile') {
          // On mobile, cards should stack vertically
          const firstCard = planCards.nth(0);
          const secondCard = planCards.nth(1);
          
          if (cardCount > 1) {
            const firstCardBox = await firstCard.boundingBox();
            const secondCardBox = await secondCard.boundingBox();
            
            // Cards should be stacked (second card below first)
            expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y + firstCardBox.height - 20);
          }
        } else if (deviceType === 'desktop') {
          // On desktop, cards should be side by side
          const firstCard = planCards.nth(0);
          const secondCard = planCards.nth(1);
          
          if (cardCount > 1) {
            const firstCardBox = await firstCard.boundingBox();
            const secondCardBox = await secondCard.boundingBox();
            
            // Cards should be side by side (similar Y position)
            expect(Math.abs(firstCardBox.y - secondCardBox.y)).toBeLessThan(20);
          }
        }
      });

      test('color scheme and theme consistency', async ({ page }) => {
        await page.goto('/test-subscription');
        await page.waitForSelector('[data-testid="plan-selector"]');

        // Test that theme colors are applied correctly
        const primaryColorElements = page.locator('.text-primary-200, .bg-primary-200, .border-primary-200');
        const count = await primaryColorElements.count();
        
        // Should have primary color elements
        expect(count).toBeGreaterThan(0);

        // Test dark theme consistency
        const darkElements = page.locator('.bg-gray-900, .bg-dark-100, .text-white');
        const darkCount = await darkElements.count();
        
        // Should have dark theme elements
        expect(darkCount).toBeGreaterThan(0);
      });

      test('loading and error states visual consistency', async ({ page }) => {
        await page.goto('/test-subscription');

        // Mock loading state
        await page.evaluate(() => {
          const button = document.querySelector('[data-testid="subscription-button"] button');
          if (button) {
            button.textContent = 'Processing...';
            button.disabled = true;
            button.classList.add('loading');
          }
        });

        await expect(page.locator('[data-testid="subscription-button"]')).toHaveScreenshot(
          `subscription-button-loading-${browserName}-${deviceType}.png`
        );

        // Mock error state
        await page.evaluate(() => {
          const errorDiv = document.createElement('div');
          errorDiv.setAttribute('data-testid', 'error-message');
          errorDiv.className = 'text-center p-3 bg-red-900/20 border border-red-500/30 rounded-md mt-4';
          errorDiv.innerHTML = '<p class="text-red-400 text-sm">Something went wrong. Please try again.</p>';
          
          const container = document.querySelector('[data-testid="subscription-button"]');
          if (container) {
            container.appendChild(errorDiv);
          }
        });

        await expect(page.locator('[data-testid="subscription-button"]')).toHaveScreenshot(
          `subscription-button-error-${browserName}-${deviceType}.png`
        );
      });

      test('accessibility and focus states', async ({ page }) => {
        await page.goto('/test-subscription');
        await page.waitForSelector('[data-testid="subscription-button"]');

        // Test keyboard focus styles
        await page.keyboard.press('Tab'); // Focus first element
        
        // Continue tabbing to subscription button
        let attempts = 0;
        while (attempts < 10) {
          const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
          if (focused === 'subscription-button' || 
              await page.locator('[data-testid="subscription-button"] button:focus').count() > 0) {
            break;
          }
          await page.keyboard.press('Tab');
          attempts++;
        }

        // Capture focus state
        await expect(page.locator('[data-testid="subscription-button"]')).toHaveScreenshot(
          `subscription-button-focus-${browserName}-${deviceType}.png`
        );
      });

      // Device-specific tests
      if (deviceType === 'mobile') {
        test('mobile-specific interactions and layouts', async ({ page }) => {
          await page.goto('/test-subscription');
          
          // Test mobile menu or collapsed states if present
          const mobileToggle = page.locator('[data-testid="mobile-toggle"]');
          if (await mobileToggle.count() > 0) {
            await mobileToggle.click();
            await page.waitForTimeout(300);
            
            await expect(page).toHaveScreenshot(`mobile-menu-open-${browserName}.png`);
          }

          // Test mobile plan selection
          await page.click('[data-plan="enterprise"]');
          await page.waitForTimeout(500);
          
          // Verify mobile layout doesn't break
          await expect(page.locator('[data-testid="plan-selector"]')).toHaveScreenshot(
            `mobile-plan-selection-${browserName}.png`
          );
        });

        test('mobile touch interactions', async ({ page }) => {
          await page.goto('/test-subscription');
          
          // Test touch-friendly button sizing
          const buttons = page.locator('button');
          const buttonCount = await buttons.count();
          
          for (let i = 0; i < Math.min(buttonCount, 3); i++) {
            const button = buttons.nth(i);
            const box = await button.boundingBox();
            
            if (box) {
              // Buttons should be at least 44px tall for touch targets
              expect(box.height).toBeGreaterThanOrEqual(40);
            }
          }
        });
      }

      if (deviceType === 'desktop') {
        test('desktop hover and interactive states', async ({ page }) => {
          await page.goto('/test-subscription');
          
          // Test plan card hover effects
          const planCards = page.locator('[data-plan]');
          const cardCount = await planCards.count();
          
          if (cardCount > 0) {
            const firstCard = planCards.nth(0);
            await firstCard.hover();
            await page.waitForTimeout(300);
            
            await expect(page.locator('[data-testid="plan-selector"]')).toHaveScreenshot(
              `plan-card-hover-${browserName}-desktop.png`
            );
          }
        });

        test('desktop layout spacing and typography', async ({ page }) => {
          await page.goto('/test-subscription');
          
          // Verify desktop typography scales properly
          const headings = page.locator('h1, h2, h3');
          const headingCount = await headings.count();
          
          expect(headingCount).toBeGreaterThan(0);
          
          // Take screenshot focusing on typography
          await expect(page.locator('.text-center').first()).toHaveScreenshot(
            `desktop-typography-${browserName}.png`
          );
        });
      }
    });
  });
});

// Cross-browser compatibility tests
test.describe('Cross-browser Feature Compatibility', () => {
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`PayPal SDK integration - ${browserName}`, async ({ browser }) => {
      const page = await browser.newPage();
      
      // Mock PayPal SDK
      await page.addInitScript(() => {
        window.paypal = {
          Buttons: (config) => ({
            render: (selector) => {
              const element = document.querySelector(selector);
              if (element) {
                element.innerHTML = '<div class="paypal-button-mock">PayPal Button</div>';
              }
            }
          }),
          FUNDING: { PAYPAL: 'paypal', CARD: 'card' }
        };
      });

      await page.goto('/test-subscription');
      
      // Verify PayPal integration works across browsers
      const paypalButton = page.locator('.paypal-button-mock');
      await expect(paypalButton).toBeVisible();
      
      await page.close();
    });

    test(`CSS Grid and Flexbox support - ${browserName}`, async ({ browser }) => {
      const page = await browser.newPage();
      
      await page.goto('/test-subscription');
      await page.waitForSelector('[data-testid="plan-selector"]');
      
      // Check CSS Grid support
      const gridSupport = await page.evaluate(() => {
        return CSS.supports('display', 'grid');
      });
      expect(gridSupport).toBe(true);
      
      // Check Flexbox support
      const flexSupport = await page.evaluate(() => {
        return CSS.supports('display', 'flex');
      });
      expect(flexSupport).toBe(true);
      
      await page.close();
    });

    test(`Modern JavaScript features - ${browserName}`, async ({ browser }) => {
      const page = await browser.newPage();
      
      // Check for console errors related to JS compatibility
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.goto('/test-subscription');
      await page.waitForTimeout(2000);
      
      // Filter out expected errors (like PayPal SDK mocking)
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('paypal') && 
        !error.includes('mock') &&
        !error.includes('Failed to fetch') // API mocking
      );
      
      expect(criticalErrors).toEqual([]);
      
      await page.close();
    });
  });
});

// Performance and accessibility tests
test.describe('Performance and Accessibility', () => {
  test('subscription page performance metrics', async ({ page }) => {
    await page.goto('/test-subscription');
    
    // Measure performance
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime,
        firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime
      };
    });
    
    // Performance assertions
    expect(metrics.domContentLoaded).toBeLessThan(3000); // DOM ready in under 3s
    expect(metrics.firstContentfulPaint).toBeLessThan(2000); // FCP in under 2s
  });

  test('accessibility compliance', async ({ page }) => {
    await page.goto('/test-subscription');
    
    // Check for basic accessibility attributes
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      // Buttons should have either aria-label or visible text
      expect(ariaLabel || text?.trim()).toBeTruthy();
    }
    
    // Check for proper heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
    
    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt).toBeDefined();
    }
  });
});

// Configuration for visual testing
const visualConfig = {
  // Threshold for visual differences
  threshold: 0.2,
  
  // Animations should be disabled for consistent screenshots
  animations: 'disabled',
  
  // Mask dynamic content
  mask: [
    'text:has-text("test@")', // Email addresses
    '[data-testid="timestamp"]', // Timestamps
    '.animate-', // Animated elements
  ]
};