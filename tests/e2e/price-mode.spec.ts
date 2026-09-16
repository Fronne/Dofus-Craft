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

// Community price consultation/contribution is real (specs/004-community-price-sharing) — see
// tests/e2e/community-price-sharing.spec.ts for that behavior. This test only covers what
// still holds from 003: switching to community mode never sends a *personal*-price-related
// network request (personal prices stay in IndexedDB, never over the network) while entering one.
test('never sends a personal-price-related network request while community mode is active', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: /^Mode communautaire/ }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();

  const personalPriceRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (request.method() === 'POST' && /community-price/.test(url)) personalPriceRequests.push(url);
  });

  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await priceInput.fill('1234');
  await expect(priceInput).toHaveValue('1 234');

  // Filling a personal price alone never contributes it — that requires explicit consent and a
  // separate "Contribuer" action (FR-004, US2).
  expect(personalPriceRequests).toHaveLength(0);
});
