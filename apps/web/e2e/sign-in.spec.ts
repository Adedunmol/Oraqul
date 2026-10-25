import { expect, test } from '@playwright/test';

test('every sign in way is reachable from the sign in page', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Email me a code' }).click();
  await expect(page).toHaveURL('/email-code');
  await expect(page.getByRole('heading', { name: 'Sign in with an email code' })).toBeVisible();
  // Next keeps the page you left, hidden, so count only what is on screen.
  await expect(page.getByLabel('Password', { exact: true }).filter({ visible: true })).toHaveCount(
    0,
  );

  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page).toHaveURL('/sign-up');
  await expect(page.getByLabel('Your name')).toBeVisible();

  await page.getByRole('link', { name: 'Already have an account? Sign in' }).click();
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();

  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/undefined|NaN/);
});

test('the Google link carries a safe next path', async ({ page }) => {
  await page.goto('/sign-in?next=//evil.com');
  const href = await page.getByRole('link', { name: 'Continue with Google' }).getAttribute('href');
  expect(new URL(href ?? '').searchParams.get('next')).toBe('/overview');
});

test('a failed Google sign in shows a message', async ({ page }) => {
  await page.goto('/sign-in?error=google');
  await expect(page.getByText('Google sign in did not work')).toBeVisible();
});

test('a return path survives the move between auth pages', async ({ page }) => {
  await page.goto('/sign-in?next=/team');
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page).toHaveURL('/sign-up?next=%2Fteam');
});

test('sign in shows an error and no horizontal scroll at 375px when the API is down', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/sign-in');
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
  await page.goto('/sign-in');
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
  await page.goto('/sign-up');
  await expect(page.getByRole('button', { name: 'Show password' })).toBeVisible();
});

test('the code and reset pages ask for the code', async ({ page }) => {
  await page.goto('/verify?email=ada%40example.com');
  await expect(page.getByText('We sent a 6 digit code to ada@example.com.')).toBeVisible();
  await expect(page.getByLabel('6 digit code')).toBeVisible();

  await page.goto('/reset-password');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
});
