import { expect, test } from '@playwright/test';
import { chooseServer } from './helpers';

// specs/074-dofus-color-themes (US1, US3): the chosen Dofus colors the site, survives a reload and
// is on the page before the first paint.
test('picks a Dofus in Paramètres and keeps it after a reload', async ({ page }) => {
  await chooseServer(page);
  await page.goto('/parametres');
  await page.getByRole('button', { name: 'Dofus Turquoise' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-dofus', 'turquoise');
  await expect(page.locator('.app-nav-brand-mark')).toHaveAttribute('src', '/dofus-turquoise.png');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/dofus-turquoise.png');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-dofus', 'turquoise');
  await expect(page.getByRole('button', { name: 'Dofus Turquoise' })).toHaveAttribute('aria-pressed', 'true');
});

test('puts the remembered Dofus on the page before any script of the app runs', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('craftcheck-dofus', 'ebene'));
  await page.route('**/src/main.tsx*', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-dofus', 'ebene');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/dofus-ebene.png');
});

test('falls back to the emerald when the memory is nonsense', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('craftcheck-dofus', 'n-importe-quoi'));
  await chooseServer(page);
  await expect(page.locator('html')).not.toHaveAttribute('data-dofus', /.+/);
  await expect(page.locator('.app-nav-brand-mark')).toHaveAttribute('src', '/dofus-emeraude.png');
});
