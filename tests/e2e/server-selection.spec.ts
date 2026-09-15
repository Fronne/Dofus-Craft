import { test, expect } from '@playwright/test';

test('blocks the app then remembers and allows changing the active server', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Choisissez votre serveur' })).toBeVisible();
  await expect(page.getByPlaceholder('Rechercher un objet ou une panoplie...')).toHaveCount(0);

  await page.getByRole('button', { name: 'Mikhal' }).click();

  await expect(page.getByRole('heading', { name: 'Choisissez votre serveur' })).toHaveCount(0);
  await expect(page.getByLabel('Serveur actif')).toHaveValue('mikhal');

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Choisissez votre serveur' })).toHaveCount(0);
  await expect(page.getByLabel('Serveur actif')).toHaveValue('mikhal');

  await page.getByLabel('Serveur actif').selectOption('dakal');
  await expect(page.getByLabel('Serveur actif')).toHaveValue('dakal');
});
