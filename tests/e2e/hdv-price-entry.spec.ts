import { expect, test, type Page } from '@playwright/test';

// specs/023-hdv-price-entry: the HDV items come from the app's own src/data/hdv-items.json; prices
// are saved in Mode personnel (playwright.config.ts), so no community call is needed.
async function openHdv(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();
  await page.getByRole('link', { name: 'HDV' }).click();
  await expect(page.getByRole('heading', { name: 'HDV' })).toBeVisible();
}

const croquette = (page: Page) => page.locator('li.hdv-row').filter({ hasText: 'Croquette enrichie' });

test.describe('HDV page (specs/023)', () => {
  test('replaces Accueil in the navigation, and its old address opens the Recherche page', async ({ page }) => {
    await openHdv(page);
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link', { name: 'Accueil' })).toHaveCount(0);
    await expect(nav.getByRole('link')).toContainText(['Recherche', 'Suivis', 'Prix', 'HDV', 'Familier', 'Paramètres']);
    await page.goto('/accueil');
    await expect(page).toHaveURL(/\/$/);
  });

  test('keeps a price typed in the Animaux tab after a reload', async ({ page }) => {
    await openHdv(page);
    await page.getByRole('tab', { name: 'Animaux' }).click();
    const field = croquette(page).getByPlaceholder('Prix unitaire');
    await field.fill('1500');
    await field.blur();
    await expect(croquette(page)).toContainText('Dernière mise à jour');
    await expect(page.getByText('1 objet sur 35 a un prix')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Animaux' })).toHaveAttribute('aria-selected', 'true');
    await expect(croquette(page).getByPlaceholder('Prix unitaire')).toHaveValue(/1\s500/);
  });

  test('fits a phone screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await openHdv(page);
    await page.getByRole('tab', { name: 'Animaux' }).click();
    await expect(croquette(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
