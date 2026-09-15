import { test, expect } from '@playwright/test';

test('isolates resource prices between servers and persists them after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();

  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await expect(priceInput).toBeVisible();

  await priceInput.fill('1000');
  await expect(priceInput).toHaveValue('1 000');

  await page.getByLabel('Serveur actif').selectOption('dakal');
  await expect(priceInput).toHaveValue('');

  await priceInput.fill('2000');
  await expect(priceInput).toHaveValue('2 000');

  await page.getByLabel('Serveur actif').selectOption('mikhal');
  await expect(priceInput).toHaveValue('1 000');

  await page.reload();
  await expect(page.getByLabel('Serveur actif')).toHaveValue('mikhal');
  await expect(page.getByPlaceholder('Prix unitaire').first()).toHaveValue('1 000');

  await page.getByLabel('Serveur actif').selectOption('dakal');
  await expect(page.getByPlaceholder('Prix unitaire').first()).toHaveValue('2 000');
});
