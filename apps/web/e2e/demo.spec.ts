import { expect, test } from '@playwright/test';

// The demo screens behind sign in are walked by hand for now (see the PR). These cover what a
// signed out visitor can reach.

// No API runs under test, so a shared link shows its error state. A link that matches no output
// answers 404 and shows "This link does not work." (apps/api/test/film.e2e-spec.ts).
test('a share link says so plainly when the shared brief cannot load', async ({ page }) => {
  await page.goto('/s/not-a-real-token');
  await expect(
    page.getByRole('heading', { name: 'We could not load this shared brief.' }),
  ).toBeVisible();
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('undefined');
  expect(text).not.toContain('NaN');
});

test('the shared view has no horizontal scroll at 400px', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto('/s/not-a-real-token');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const path of ['/categories/opera/projects', '/categories/opera/projects/some-id']) {
  test(`an unknown category is not found at ${path}`, async ({ page }) => {
    // loading.tsx streams first, so the status is already 200; the page shows the not found UI.
    await page.goto(path);
    await expect(page.getByText('This page could not be found.')).toBeVisible();
  });
}
