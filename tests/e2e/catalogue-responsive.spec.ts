import { expect, test } from '@playwright/test';
import { chooseServer } from './helpers';

test('switches and persists the selected theme', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('craftcheck-theme')) localStorage.setItem('craftcheck-theme', 'dark');
  });
  await chooseServer(page);
  const toggle = page.getByRole('button', { name: 'Activer le thème clair' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Activer le thème sombre' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
