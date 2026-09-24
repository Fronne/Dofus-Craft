import { expect, test } from '@playwright/test';
import { chooseServer, searchInput } from './helpers';

test('finds Strigide and Volkorne items in the real catalogue flow', async ({ page }) => {
  await chooseServer(page);
  const search = searchInput(page);

  await search.fill('Amulette du Strigide');
  await expect(page.getByRole('button', { name: /Amulette du Strigide/ })).toBeVisible({ timeout: 30_000 });

  await search.fill('Strigide');
  await expect(page.getByRole('button', { name: /Strigide/ }).first()).toBeVisible({ timeout: 30_000 });

  await search.fill('Volkorne');
  await expect(page.getByRole('button', { name: /Volkorne/ }).first()).toBeVisible({ timeout: 30_000 });
});

test('shows aligned resource images and formats price input', async ({ page }) => {
  await chooseServer(page);
  const search = searchInput(page);
  await search.fill('Amulette du Strigide');

  const item = page.getByRole('button', { name: /Amulette du Strigide/ });
  await expect(item).toBeVisible({ timeout: 30_000 });
  await item.click();

  await expect(page.getByRole('heading', { name: 'Prix des ressources' })).toBeVisible({ timeout: 30_000 });
  const rows = page.locator('.price-line');
  await expect(rows).toHaveCount(8);
  const images = rows.locator('.resource-display img');
  await expect(images).toHaveCount(8);

  const firstImage = await images.first().boundingBox();
  expect(firstImage).not.toBeNull();
  for (let index = 1; index < await images.count(); index += 1) {
    const image = await images.nth(index).boundingBox();
    expect(image).not.toBeNull();
    // Within a hundredth of a pixel: cards may still be finishing their entrance animation
    // (specs/012 "Nouveau" design), which makes measured sizes differ by sub-pixel amounts.
    expect(image?.width).toBeCloseTo(firstImage?.width ?? 0, 2);
    expect(image?.height).toBeCloseTo(firstImage?.height ?? 0, 2);
  }

  const price = rows.first().locator('input');
  await price.fill('1000');
  await expect(price).toHaveValue('1 000');
});
