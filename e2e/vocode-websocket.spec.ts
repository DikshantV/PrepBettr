import { test, expect } from '@playwright/test';

test('Vocode WebSocket connection states', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const connectButton = page.locator('text=Call');
  await connectButton.click();

  const connectingIndicator = page.locator('text=CONNECTING');
  await expect(connectingIndicator).toBeVisible();

  const activeIndicator = page.locator('text=ACTIVE');
  await expect(activeIndicator).toBeVisible();

  // Simulate conversation end
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('conversation-end'));
  });

  const finishedIndicator = page.locator('text=FINISHED');
  await expect(finishedIndicator).toBeVisible();
});

