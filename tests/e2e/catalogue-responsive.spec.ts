import { expect, test } from '@playwright/test';
import { chooseServer } from './helpers';

test('switches and persists the selected theme from Paramètres', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('craftcheck-theme')) localStorage.setItem('craftcheck-theme', 'dark');
  });
  await chooseServer(page);
  // The bar no longer holds a theme toggle: the theme is chosen in Paramètres.
  await expect(page.getByRole('button', { name: /Activer le thème/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Paramètres' }).click();
  await page.getByRole('button', { name: 'Thème clair' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Thème clair' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
