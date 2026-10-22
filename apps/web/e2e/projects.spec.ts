import { expect, test } from '@playwright/test';

for (const route of [
  { path: '/overview', heading: 'We could not load your overview.' },
  { path: '/projects', heading: 'We could not load your projects.' },
  { path: '/projects?category=music', heading: 'We could not load your projects.' },
  { path: '/start?mode=audit', heading: 'We could not load this page.' },
  {
    path: '/projects/6f1d0c4e-1b9e-4c1e-9a3f-0a0b0c0d0e0f',
    heading: 'We could not load this project.',
  },
  {
    path: '/chats/6f1d0c4e-1b9e-4c1e-9a3f-0a0b0c0d0e0f',
    heading: 'We could not load this chat.',
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

test('old project and chat addresses move to the current routes', async ({ request }) => {
  for (const [from, to] of [
    ['/categories/all/projects', '/projects'],
    ['/categories/books/projects', '/projects?category=books'],
    ['/categories/all/projects/abc', '/projects/abc'],
    ['/categories/books', '/projects?category=books'],
    ['/threads/abc', '/chats/abc'],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(to);
  }
});
