import { expect, test } from '@playwright/test';

// Every public page: no broken values in the text, no horizontal scroll at 400px, and the same
// pages in the dark scheme. The marketing pages pin their own light and dark bands, so the scheme
// must not break them either.
const pages = [
  '/',
  '/how-it-works',
  '/examples',
  '/use-cases',
  '/categories',
  '/method',
  '/trust',
  '/about',
  '/guide',
  '/developers',
  '/privacy',
  '/terms',
];

for (const path of pages) {
  test(`${path} has no broken values and fits a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await page.goto(path);
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('NaN');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`${path} renders in the dark scheme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
  });
}

test('the guide builds a brief from the fields and hands it to the app', async ({ page }) => {
  await page.goto('/guide');
  await page.getByLabel('Title', { exact: true }).fill('Night Ferry');
  await page.getByLabel('Release date', { exact: true }).fill('2099-03-12');
  await page.getByLabel('Cities, home first').fill('Lagos, London');
  await page.getByRole('radio', { name: /Mid-size/ }).click();
  const brief = page.getByLabel('Your brief').locator('pre');
  await expect(brief).toContainText('Launch plan for the film "Night Ferry"');
  await expect(brief).toContainText('opening in Lagos and London on 2099-03-12');
  await expect(brief).toContainText('A mid-size budget.');
  await expect(page.getByText(/\d of 9 details given/)).toBeVisible();

  const open = page.getByRole('link', { name: 'Open in Oraqul' });
  const href = (await open.getAttribute('href')) ?? '';
  expect(href).toContain('/start?');
  const query = new URL(href, 'http://localhost').searchParams;
  expect(query.get('mode')).toBe('build');
  expect(query.get('category')).toBe('film');
  expect(query.get('text')).toContain('A mid-size budget.');
});

test('the guide switches category and keeps what is true of any launch', async ({ page }) => {
  await page.goto('/guide');
  await page.getByLabel('Title', { exact: true }).fill('Ember Keep');
  await page.getByRole('button', { name: 'Games' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Ember Keep');
  await expect(page.getByLabel(/Target/)).toBeVisible();
  await expect(page.getByLabel('Platforms', { exact: true })).toBeVisible();
});
