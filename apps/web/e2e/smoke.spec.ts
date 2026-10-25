import { expect, test } from '@playwright/test';

test('the landing page shows the pitch, the example and the ways in', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('body').innerText();
  expect(text).toContain('Holds');
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
