import { expect, test } from '@playwright/test';

for (const route of [
  { path: '/overview', heading: 'We could not load your overview.' },
  { path: '/categories/all/projects', heading: 'We could not load your projects.' },
  { path: '/categories/music/projects', heading: 'We could not load your projects.' },
  { path: '/start?mode=audit', heading: 'We could not load this page.' },
  {
    path: '/categories/all/projects/6f1d0c4e-1b9e-4c1e-9a3f-0a0b0c0d0e0f',
    heading: 'We could not load this project.',
  },
  {
    path: '/threads/6f1d0c4e-1b9e-4c1e-9a3f-0a0b0c0d0e0f',
    heading: 'We could not load this thread.',
  },
]) {
  test(`${route.path} shows a plain error with a retry when the API is down`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('fetch failed');
  });
}

test('old project addresses move to the category routes', async ({ request }) => {
  for (const [from, to] of [
    ['/projects', '/categories/all/projects'],
    ['/projects/abc', '/categories/all/projects/abc'],
    ['/categories/books', '/categories/books/projects'],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(to);
  }
});
