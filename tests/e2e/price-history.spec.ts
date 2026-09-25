import { expect, test, type Page } from '@playwright/test';

// specs/017-price-history-chart: the community Worker is mocked at the network level, like in
// community-price-sharing.spec.ts; DofusDB is used for real.
const HISTORY = {
  day: [
    { periodStart: '2026-09-01', medianAmountKamas: 4000, sampleSize: 2 },
    { periodStart: '2026-09-08', medianAmountKamas: 4300, sampleSize: 1 },
    { periodStart: '2026-09-15', medianAmountKamas: 4100, sampleSize: 3 },
    { periodStart: '2026-09-22', medianAmountKamas: 4500, sampleSize: 2 },
  ],
  week: [
    { periodStart: '2026-08-31', medianAmountKamas: 4000, sampleSize: 2 },
    { periodStart: '2026-09-07', medianAmountKamas: 4300, sampleSize: 1 },
    { periodStart: '2026-09-21', medianAmountKamas: 4400, sampleSize: 4 },
  ],
  month: [
    { periodStart: '2026-08-01', medianAmountKamas: 4000, sampleSize: 2 },
    { periodStart: '2026-09-01', medianAmountKamas: 4300, sampleSize: 6 },
  ],
};

async function mockCommunityBackend(page: Page) {
  await page.route('**/community-price?*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: 'null' }));
  await page.route('**/latest-price?*', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: 'null' }));
  await page.route('**/price-history?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HISTORY) }));
}

async function openStrigideInCommunityMode(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('craftcheck-price-mode-choice', 'community');
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();
  await page.getByPlaceholder('Rechercher un objet ou une panoplie...').fill('Amulette du Strigide');
  await page.getByRole('button', { name: /Amulette du Strigide/ }).click();
  await expect(page.getByRole('heading', { name: 'Amulette du Strigide' })).toBeVisible({ timeout: 30_000 });
}

test.describe('price history (specs/017)', () => {
  test('opens a resource history, switches to days, closes with Escape', async ({ page }) => {
    await mockCommunityBackend(page);
    await openStrigideInCommunityMode(page);

    const started = Date.now();
    await page.locator('.price-line').getByRole('button', { name: 'Historique du prix' }).first().click();
    const dialog = page.getByRole('dialog', { name: /Historique du prix de/ });
    await expect(dialog.locator('.price-history-point')).toHaveCount(3);
    // SC-005: the popover shows its data within 2 seconds (the network is mocked here).
    expect(Date.now() - started).toBeLessThan(2000);

    await dialog.getByRole('button', { name: 'Jour' }).click();
    await expect(dialog.locator('.price-history-point')).toHaveCount(4);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('fits a phone screen without horizontal scrolling (FR-015)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await mockCommunityBackend(page);
    await openStrigideInCommunityMode(page);

    await page.locator('.price-line').getByRole('button', { name: 'Historique du prix' }).first().click();
    const dialog = page.getByRole('dialog', { name: /Historique du prix de/ });
    await expect(dialog.locator('.price-history-point')).toHaveCount(3);
    const box = await dialog.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(15);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(360);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
