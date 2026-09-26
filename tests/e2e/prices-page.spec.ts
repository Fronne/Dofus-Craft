import { expect, test, type Page } from '@playwright/test';

// specs/019-craft-profit-list: the community Worker is mocked at the network level (every resource
// at a 1 000-kamas median); DofusDB is used for real. The item's id is taken from the /latest-price
// request its Recherche page makes, then served back by /item-prices with a high HDV price.
async function mockCommunityBackend(page: Page) {
  let itemId: string | undefined;
  await page.route('**/community-price?*', (route) => {
    const url = new URL(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ resourceId: url.searchParams.get('resourceId'), serverId: 'mikhal', medianAmountKamas: 1000, sampleSize: 3 }),
    });
  });
  await page.route('**/latest-price?*', (route) => {
    itemId = new URL(route.request().url()).searchParams.get('itemId') ?? undefined;
    return route.fulfill({ status: 404, contentType: 'application/json', body: 'null' });
  });
  await page.route('**/item-prices?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: itemId ? [{ itemId, amountKamas: 10_000_000, contributedAt: new Date().toISOString() }] : [] }),
  }));
}

async function openPricesPage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('craftcheck-price-mode-choice', 'community');
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();
  await page.getByPlaceholder('Rechercher un objet ou une panoplie...').fill('Amulette du Strigide');
  await page.getByRole('button', { name: /Amulette du Strigide/ }).click();
  await expect(page.getByRole('heading', { name: 'Amulette du Strigide' })).toBeVisible({ timeout: 30_000 });
  const started = Date.now();
  await page.getByRole('link', { name: 'Prix' }).click();
  const row = page.locator('.profit-row').filter({ hasText: 'Amulette du Strigide' });
  await expect(row).toBeVisible({ timeout: 10_000 });
  return { row, elapsed: Date.now() - started };
}

test.describe('Prix page (specs/019)', () => {
  test('lists the item with its profit, and sorts by margin', async ({ page }) => {
    await mockCommunityBackend(page);
    const { row, elapsed } = await openPricesPage(page);
    // SC-004: the list shows within 3 seconds (recipes already cached by the Recherche page).
    expect(elapsed).toBeLessThan(3000);
    await expect(row.locator('.profit-value').first()).toHaveClass(/profit-value--positive/);
    await page.getByRole('button', { name: 'Trier par Marge' }).click();
    await expect(row).toBeVisible();
  });

  test('fits a phone screen without horizontal scrolling (FR-011)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await mockCommunityBackend(page);
    await openPricesPage(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
