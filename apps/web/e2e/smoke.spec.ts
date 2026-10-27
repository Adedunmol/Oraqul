import { expect, test } from '@playwright/test';

test('the landing page shows the pitch, the example and the ways in', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('body').innerText();
  // The first thing a visitor reads is the promise, with a line under it that says what the product
  // is, and the real product is shown under that.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Plan your launch right');
  expect(text).toContain(
    'culturally grounded AI agent for launch planning in media & entertainment',
  );
  expect(text).toContain('Night Ferry');
  expect(text).toContain('Agent trace');
  await expect(page.getByRole('link', { name: 'Create account' }).first()).toHaveAttribute(
    'href',
    '/sign-up',
  );
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute(
    'href',
    '/sign-in',
  );
  for (const name of ['How it works', 'Guide', 'Categories']) {
    await expect(page.getByRole('link', { name, exact: true }).first()).toBeAttached();
  }
  await expect(page.locator('[aria-label="Six categories"]')).toBeAttached();
  expect(text).not.toContain('undefined');
  expect(text).not.toContain('NaN');
});

test('no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
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
  expect(await background()).toBe('rgb(255, 255, 255)');

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await background()).toBe('rgb(9, 9, 10)');
});

test('the phone menu is a hamburger that closes from the dim or the close icon', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  const menu = page.getByRole('dialog', { name: 'Main menu' });

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'How it works' })).toBeVisible();
  await page.screenshot({ path: process.env.MENU_SHOT ?? 'test-results/menu-open.png' });

  await page.mouse.click(20, 400);
  await expect(menu).toBeHidden();

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(menu).toBeHidden();
});

test('the header tucks away reading down and comes back on the way up', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // The header says when its scroll listener is live, so the first scroll is never lost to hydration.
  await page.locator('header[data-ready]').first().waitFor({ state: 'attached', timeout: 30000 });
  // A dev server can reload the page once while it compiles, which ends a read in flight.
  const top = () =>
    page
      .evaluate(() =>
        Math.round(document.querySelector('header')?.getBoundingClientRect().top ?? 0),
      )
      .catch(() => Number.NaN);
  await expect.poll(top, { timeout: 15000 }).toBe(0);
  await page.mouse.wheel(0, 900);
  await expect.poll(top, { timeout: 8000 }).toBeLessThan(0);
  await page.mouse.wheel(0, -200);
  await expect.poll(top, { timeout: 8000 }).toBe(0);
  await page.mouse.wheel(0, 600);
  await expect.poll(top, { timeout: 8000 }).toBeLessThan(0);
  // Focus inside the header always brings it back, so a keyboard never loses it.
  await page.keyboard.press('Tab');
  await expect.poll(top, { timeout: 8000 }).toBe(0);
});
