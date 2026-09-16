import { test, expect } from '@playwright/test';

test('keeps a pinned item shared across servers while its market price stays per-server', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();

  await page.getByRole('button', { name: 'Épingler' }).click();
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();

  const marketInput = page.getByLabel('Prix HDV');
  await marketInput.fill('500000');
  await expect(marketInput).toHaveValue('500 000');

  await page.getByLabel('Serveur actif').selectOption('dakal');
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  await expect(page.getByLabel('Prix HDV')).toHaveValue('');

  await page.getByLabel('Prix HDV').fill('750000');
  await expect(page.getByLabel('Prix HDV')).toHaveValue('750 000');

  await page.getByLabel('Serveur actif').selectOption('mikhal');
  await expect(page.getByLabel('Prix HDV')).toHaveValue('500 000');
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Serveur actif')).toHaveValue('mikhal');
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  await expect(page.getByLabel('Prix HDV')).toHaveValue('500 000');

  await page.getByLabel('Serveur actif').selectOption('dakal');
  await expect(page.getByRole('button', { name: 'Désépingler', exact: true })).toBeVisible();
  await expect(page.getByLabel('Prix HDV')).toHaveValue('750 000');
});
