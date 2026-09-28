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
}

async function openStrigideInCommunityMode(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: /^Mode communautaire/ }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();

  const search = page.getByPlaceholder('Rechercher un objet ou une panoplie...');
  await search.fill('Amulette du Strigide');
  await page.getByRole('button', { name: /Amulette du Strigide/ }).click();
  // The page starts on its first result, which already shows "Prix des ressources": wait for the
  // clicked item's own card instead, or the steps below would act on the previous item's recipe.
  await expect(page.getByRole('heading', { name: 'Amulette du Strigide' })).toBeVisible({ timeout: 30_000 });
}

test.describe('community price sharing', () => {

test('pre-fills the resource price field with the community median, directly editable (US1)', async ({ page }) => {
  await mockCommunityBackend(page, {
    medianRow: { resourceId: 'whatever', serverId: 'mikhal', medianAmountKamas: 4200, sampleSize: 5 },
  });
  await openStrigideInCommunityMode(page);

  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await expect(priceInput).toHaveValue('4 200');
  // specs/004 (révision du 2026-09-25): the contribution count is no longer shown.
  await expect(page.getByText(/contribution/)).toHaveCount(0);

  // Once pre-filled, the field locks (lockWhenFilled) to guard against an accidental keystroke —
  // "Modifier ce prix" unlocks it, same convention as the confirmed-edit test below.
  await page.getByRole('button', { name: 'Modifier ce prix' }).first().click();
  await priceInput.fill('4500');
  await expect(priceInput).toHaveValue('4 500');
});

test('leaves the field empty and directly fillable when no community price exists (US1)', async ({ page }) => {
  await mockCommunityBackend(page);
  await openStrigideInCommunityMode(page);

  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await expect(priceInput).toHaveValue('');
  await expect(priceInput).toBeEditable();
});

test('the Mode communautaire carnet never depends on the Mode personnel carnet (US2)', async ({ page }) => {
  await mockCommunityBackend(page, {
    medianRow: { resourceId: 'whatever', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 2 },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();

  const search = page.getByPlaceholder('Rechercher un objet ou une panoplie...');
  await search.fill('Amulette du Strigide');
  await page.getByRole('button', { name: /Amulette du Strigide/ }).click();
  // The page starts on its first result: wait for the clicked item's own card, or the price below
  // would be typed into the previous item's recipe.
  await expect(page.getByRole('heading', { name: 'Amulette du Strigide' })).toBeVisible({ timeout: 30_000 });

  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await priceInput.fill('1000');
  await expect(priceInput).toHaveValue('1 000');

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: /^Mode communautaire/ }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();

  await expect(priceInput).toHaveValue('5 000');

  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('button', { name: /^Mode personnel/ }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();

  await expect(priceInput).toHaveValue('1 000');
});

test('confirming an edit to a resource price field sends exactly one contribution, sending only resourceId/serverId/amountKamas, then refreshes the field (US1/US3)', async ({ page }) => {
  const contributedBodies: unknown[] = [];
  let medianRow = { resourceId: 'whatever', serverId: 'mikhal', medianAmountKamas: 4200, sampleSize: 5 };
  await page.route('**/community-price?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(medianRow) }),
  );
  await page.route('**/community-price', async (route) => {
    contributedBodies.push(route.request().postDataJSON());
    medianRow = { resourceId: 'whatever', serverId: 'mikhal', medianAmountKamas: 4200, sampleSize: 6 };
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-contribution-1' }) });
  });
  await openStrigideInCommunityMode(page);

  // No manual or bulk sharing action exists anywhere in the app (révision 4 removes it).
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await expect(page.getByRole('button', { name: /Partager tous mes prix/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Recherche' }).click();

  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await expect(priceInput).toHaveValue('4 200');
  // specs/004 (révision du 2026-09-25): the contribution count is no longer shown.
  await expect(page.getByText(/contribution/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Modifier ce prix' }).first().click();
  await priceInput.fill('4500');
  await priceInput.blur();

  await expect.poll(() => contributedBodies.length).toBe(1);
  // specs/004 révision 5, FR-010: an anonymous per-device identifier (never player-identifying) is
  // sent alongside the contribution.
  expect(Object.keys(contributedBodies[0] as object).sort()).toEqual(['amountKamas', 'deviceId', 'resourceId', 'serverId']);
  // specs/004 FR-018 (amendée) / specs/007 FR-012: a successful commit never overwrites the field
  // with the recalculated median — it keeps showing exactly what the player typed.
  await expect(priceInput).toHaveValue('4 500');
});

test('shows the last known community price as stale, rather than breaking, when the backend becomes unavailable (US4)', async ({ page }) => {
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
  const priceInput = page.getByPlaceholder('Prix unitaire').first();
  await expect(priceInput).toHaveValue('1 500');

  failNext = true;
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await page.getByRole('link', { name: 'Recherche' }).click();

  // The carnet already holds the value from the earlier successful fetch — the field, driven by
  // that carnet (not by the now-unavailable live fetch), remains fully usable throughout.
  await expect(priceInput).toHaveValue('1 500');
  await page.getByRole('button', { name: 'Modifier ce prix' }).first().click();
  await priceInput.fill('1000');
  await expect(priceInput).toHaveValue('1 000');
});

});
