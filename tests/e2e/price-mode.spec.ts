import { test, expect } from '@playwright/test';

test('switches to community mode and back without ever losing the personal price', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();

  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await expect(priceInput).toBeVisible();
  await priceInput.fill('1000');
  await expect(priceInput).toHaveValue('1 000');

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: /^Mode communautaire/ }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();
  await expect(page.getByPlaceholder('Prix unitaire').first()).toHaveValue('1 000');

  await page.reload();
  await expect(page.getByPlaceholder('Prix unitaire').first()).toHaveValue('1 000');

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: /^Mode personnel/ }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();
  await expect(page.getByPlaceholder('Prix unitaire').first()).toHaveValue('1 000');
});

test('never sends any price-related network request while community mode is active', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: /^Mode communautaire/ }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();
  await expect(page.getByText('ne sont pas encore disponibles')).toBeVisible();

  const priceRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/price|prix|kamas/i.test(url)) priceRequests.push(url);
  });

  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await priceInput.fill('1234');
  await expect(priceInput).toHaveValue('1 234');

  expect(priceRequests).toHaveLength(0);
});
