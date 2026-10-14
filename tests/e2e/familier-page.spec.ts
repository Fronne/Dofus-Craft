import { expect, test, type Page } from '@playwright/test';

// specs/022-pet-xp-calculator: the community Worker is mocked at the network level, with a single
// median (Peau de Rat, 2,646 XP per unit, at 10 kamas); the XP data is the app's own reference file.
async function openFamilier(page: Page) {
  await page.route('**/community-prices?*', (route) => {
    const ids = new URL(route.request().url()).searchParams.get('resourceIds')?.split(',') ?? [];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        prices: ids.includes('8482')
          ? [{ resourceId: '8482', serverId: 'mikhal', medianAmountKamas: 10, sampleSize: 3, lastContributionAt: new Date().toISOString(), latestAmountKamas: 10, latestContributionAt: new Date().toISOString() }]
          : [],
      }),
    });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('craftcheck-price-mode-choice', 'community');
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();
  await page.getByRole('link', { name: 'XP Familier' }).click();
  await page.getByLabel('XP totale du familier').fill('1703');
  await page.getByLabel('Niveau visé').fill('60');
}

test.describe('Familier page (specs/022)', () => {
  // specs/055-refonte-xp-familier: that single priced food is the 1st of the podium, seen without scrolling.
  test('shows the XP to give and the cheapest resource on the podium', async ({ page }) => {
    await openFamilier(page);
    await expect(page.locator('.pet-xp-needed b')).toHaveText(/2\s859/);
    const card = page.locator('.pet-podium-card').filter({ hasText: 'Peau de Rat' });
    await expect(card).toContainText(/10\s810/);
    await expect(card).toBeInViewport();
  });

  test('fits a phone screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await openFamilier(page);
    await expect(page.locator('.pet-podium-card').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
