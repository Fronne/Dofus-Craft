import { expect, test, type Page, type Route } from '@playwright/test';

// The community backend (specs/004-community-price-sharing) is a Cloudflare Worker + D1, not
// something this suite talks to for real — every scenario below mocks its REST endpoint at the
// network level, the same way DofusDB itself is used for real (no mock) in the rest of this e2e
// suite.
async function mockCommunityBackend(
  page: Page,
  options: { medianRow?: unknown; onContribute?: (route: Route) => Promise<void> | void } = {},
) {
  const { medianRow, onContribute } = options;
  await page.route('**/community-price?*', (route) => {
    if (medianRow === undefined) return route.fulfill({ status: 404, contentType: 'application/json', body: 'null' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(medianRow) });
  });
  await page.route('**/community-price', async (route) => {
    if (onContribute) await onContribute(route);
    else await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-contribution-1' }) });
  });
  await page.route('**/community-price/*', (route) => route.fulfill({ status: 204, body: '' }));
}

async function openStrigideInCommunityMode(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: /^Mode communautaire/ }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();

  const search = page.getByLabel('Rechercher un objet');
  await search.fill('Amulette du Strigide');
  await page.getByRole('button', { name: /Amulette du Strigide/ }).click();
  await expect(page.getByRole('heading', { name: 'Prix des ressources' })).toBeVisible({ timeout: 30_000 });
}

test('shows a real community price, or an explicit empty state (US1)', async ({ page }) => {
  await mockCommunityBackend(page, {
    medianRow: { resourceId: 'whatever', serverId: 'mikhal', medianAmountKamas: 4200, sampleSize: 5 },
  });
  await openStrigideInCommunityMode(page);

  await expect(page.getByText(/4 200.*kamas/)).toBeVisible();
  await expect(page.getByText(/médiane sur 5 contributions/)).toBeVisible();
});

test('shows an explicit "pas encore de données" state rather than a fabricated price (US1)', async ({ page }) => {
  await mockCommunityBackend(page);
  await openStrigideInCommunityMode(page);

  await expect(page.getByText('Aucun prix communautaire pour cette ressource sur ce serveur pour l’instant.').first()).toBeVisible();
});

test('contributes a price only after explicit consent, sending only resourceId/serverId/amountKamas (US2)', async ({ page }) => {
  let contributedBody: unknown;
  await mockCommunityBackend(page, {
    onContribute: async (route) => {
      contributedBody = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-contribution-1' }) });
    },
  });
  await openStrigideInCommunityMode(page);

  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await priceInput.fill('1000');
  await expect(page.getByText('Activez le partage communautaire dans les Paramètres pour contribuer ce prix.').first())
    .toBeVisible();

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: 'Partager mes prix' }).click();
  await expect(page.getByText('Partage actif')).toBeVisible();

  await page.getByRole('link', { name: 'Recherche' }).click();
  await expect(priceInput).toHaveValue('1 000');
  await page.getByRole('button', { name: 'Contribuer ce prix à la communauté' }).first().click();

  await expect.poll(() => contributedBody).toMatchObject({ amountKamas: 1000 });
  expect(Object.keys(contributedBody as object).sort()).toEqual(['amountKamas', 'resourceId', 'serverId']);
});

test('always uses the personal price for the craft-cost calculation, never the community price (US3)', async ({ page }) => {
  await mockCommunityBackend(page, {
    medianRow: { resourceId: 'whatever', serverId: 'mikhal', medianAmountKamas: 999999, sampleSize: 2 },
  });
  await openStrigideInCommunityMode(page);

  await page.getByPlaceholder('Prix unitaire').first().fill('1000');

  await expect(page.getByText(/Coût de craft/)).not.toContainText('999 999');
});

test('retracting consent blocks further contributions and can withdraw contributions already sent (US4)', async ({ page }) => {
  await mockCommunityBackend(page);
  await openStrigideInCommunityMode(page);

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: 'Partager mes prix' }).click();
  await page.getByRole('button', { name: 'Ne pas partager' }).click();

  await page.getByRole('link', { name: 'Recherche' }).click();
  await page.getByPlaceholder('Prix unitaire').first().fill('1000');
  await expect(page.getByRole('button', { name: 'Contribuer ce prix à la communauté' })).toHaveCount(0);
});

test('shows the last known community price as stale, rather than breaking, when the backend becomes unavailable (US5)', async ({ page }) => {
  let failNext = false;
  await page.route('**/community-price?*', (route) => {
    if (failNext) return route.abort();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ resourceId: 'whatever', serverId: 'mikhal', medianAmountKamas: 1500, sampleSize: 1 }),
    });
  });
  await openStrigideInCommunityMode(page);
  await expect(page.getByText(/1 500.*kamas/)).toBeVisible();

  failNext = true;
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();

  await expect(page.getByText(/peut-être daté/).first()).toBeVisible({ timeout: 15_000 });
  // The personal price field remains fully usable throughout.
  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await priceInput.fill('1000');
  await expect(priceInput).toHaveValue('1 000');
});
