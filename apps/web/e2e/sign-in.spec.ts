import { expect, test } from '@playwright/test';

test('every sign in way is reachable from /', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in with an email code' })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByLabel('Your name')).toBeVisible();

  await page.getByRole('button', { name: 'Sign in with a password' }).click();
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();

  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/undefined|NaN/);
});

test('the Google link carries a safe next path', async ({ page }) => {
  await page.goto('/?next=//evil.com');
  const href = await page.getByRole('link', { name: 'Continue with Google' }).getAttribute('href');
  expect(new URL(href ?? '').searchParams.get('next')).toBe('/projects');
});

test('a failed Google sign in shows a message', async ({ page }) => {
  await page.goto('/?error=google');
  await expect(page.getByText('Google sign in did not work')).toBeVisible();
});

test('sign in shows an error and no horizontal scroll at 400px when the API is down', async ({
  page,
}) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto('/');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Something went wrong. Try again.')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the password can be shown and hidden', async ({ page }) => {
  await page.goto('/');
  const field = page.getByLabel('Password', { exact: true });
  await field.fill('password123');
  await expect(field).toHaveAttribute('type', 'password');

  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(field).toHaveAttribute('type', 'text');
  await expect(field).toHaveValue('password123');

  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(field).toHaveAttribute('type', 'password');
});

test('create account has a password toggle too', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('button', { name: 'Show password' })).toBeVisible();
});
