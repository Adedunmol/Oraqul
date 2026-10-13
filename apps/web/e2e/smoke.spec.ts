import { expect, test } from '@playwright/test';

test('home renders without broken values', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('body').innerText();
  expect(text).toContain('Holds');
  expect(text).not.toContain('undefined');
  expect(text).not.toContain('NaN');
});

test('no horizontal scroll at 400px', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('tokens switch with the colour scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await background()).toBe('rgb(244, 244, 241)');

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await background()).toBe('rgb(13, 14, 16)');
});
