import { expect, test } from '@playwright/test';

test('projects shows a plain error with a retry when the API is down', async ({ page }) => {
  await page.goto('/projects');
  await expect(
    page.getByRole('heading', { name: 'We could not load your projects.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('undefined');
  expect(text).not.toContain('fetch failed');
});
