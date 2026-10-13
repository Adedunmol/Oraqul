import { expect, test } from '@playwright/test';

const token = 'A'.repeat(43);

for (const route of [
  { path: '/team', heading: 'We could not load your team.' },
  { path: `/invite/${token}`, heading: 'We could not open this invite.' },
]) {
  test(`${route.path} shows a plain error with a retry when the API is down`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('fetch failed');
  });

  test(`${route.path} error has no horizontal scroll at 400px`, async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await page.goto(route.path);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
