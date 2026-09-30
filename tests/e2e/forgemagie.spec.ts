import { expect, test, type Page } from '@playwright/test';

// specs/025-rune-purchase-import: the Forgemagie page with the Worker's /fm/* routes mocked. The Discord
// login itself happens on discord.com: the test starts from the address the Worker sends the player
// back to (`#session=…`). The capture reading (Tesseract, loaded from a CDN) is covered by the unit and
// integration tests, not here.
const TOKEN = 'b'.repeat(64);
const me = { discordUserId: '42', displayName: 'Cyril', avatarUrl: null, serverId: 'mikhal', isPrivate: false, firstLoginAt: '2026-09-30T10:00:00.000Z' };
const cyril = { discordUserId: '42', displayName: 'Cyril', avatarUrl: null, private: false };
const hidden = { discordUserId: null, displayName: null, avatarUrl: null, private: true };
// specs/027-fm-item-recap: an item in FM, with the session above attached.
const rtograf = { id: 'i1', itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null, label: 'Rtograf PA', owner: cyril, totalKamas: 68472, sessionCount: 1 };
const session = {
  id: 's1', channelName: 'fm-coiffe', status: 'closed', openedAt: '2026-09-30T18:00:00.000Z', closedAt: '2026-09-30T19:00:00.000Z',
  totalKamas: 68472, players: [{ player: cyril, spentKamas: 63472 }, { player: hidden, spentKamas: 5000 }],
  fmItem: { id: 'i1', name: 'Rtograf PA', owner: cyril },
};

async function mockWorker(page: Page) {
  const authorized: string[] = [];
  await page.route('**/fm/**', async (route) => {
    const request = route.request();
    authorized.push(request.headers().authorization ?? '');
    const path = new URL(request.url()).pathname;
    const reply = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/fm/me') return reply(me);
    if (path === '/fm/sessions') return reply({ sessions: [session], nextBefore: null });
    if (path === '/fm/sessions/s1') {
      return reply({ ...session, items: [{ itemName: 'Rune Do Air', itemId: '11663', quantity: 40, totalKamas: 63472, averageUnitKamas: 1587 }] });
    }
    if (path === '/fm/players') return reply({ players: [{ ...cyril, totalKamas: 63472 }] });
    if (path === '/fm/players/42') return reply({ player: cyril, totalKamas: 63472, importedKamas: 0, items: [], sessions: [], fmItems: [rtograf] });
    if (path === '/fm/items/i1') {
      return reply({ ...rtograf, sessions: [{ id: 's1', channelName: 'fm-coiffe', status: 'closed', openedAt: session.openedAt, totalKamas: 68472 }],
        items: [{ itemName: 'Rune Do Air', itemId: '11663', quantity: 40, totalKamas: 63472, averageUnitKamas: 1587 }] });
    }
    return reply({ error: 'Not found' }, 404);
  });
  return authorized;
}

async function openAsLoggedIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mikhal' }).click();
  await page.goto(`/forgemagie#session=${TOKEN}`);
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
}

test.describe('Forgemagie page (specs/025)', () => {
  test('asks a logged-out player to log in with Discord', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Mikhal' }).click();
    await page.getByRole('link', { name: 'Forgemagie' }).click();
    await expect(page.getByRole('link', { name: 'Se connecter avec Discord' })).toHaveAttribute('href', /\/fm\/auth\/login$/);
  });

  test('logs in from the address Discord sends back to, then lists and details a session', async ({ page }) => {
    const authorized = await mockWorker(page);
    await openAsLoggedIn(page);
    await expect(page).toHaveURL(/\/forgemagie$/);
    expect(authorized).toContain(`Bearer ${TOKEN}`);

    const card = page.getByRole('button', { name: /#fm-coiffe/ });
    await expect(card).toContainText('Terminée');
    await expect(card).toContainText('Joueur privé');
    await card.click();
    await expect(page.getByRole('row', { name: /Rune Do Air/ })).toContainText('1 587 kamas/u');
  });

  test('has only the Sessions and Profil tabs (specs/026)', async ({ page }) => {
    await mockWorker(page);
    await openAsLoggedIn(page);
    await expect(page.getByRole('tab')).toHaveText(['Sessions', 'Profil']);
  });

  test('opens the recap of an item in FM from the profile (specs/027)', async ({ page }) => {
    await mockWorker(page);
    await openAsLoggedIn(page);
    await page.getByRole('tab', { name: 'Profil' }).click();
    await page.getByRole('button', { name: /Rtograf PA/ }).click();
    await expect(page.getByText('Total dépensé')).toContainText('68 472 kamas');
    await expect(page.getByRole('row', { name: /Rune Do Air/ })).toContainText('1 587 kamas/u');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('fits a phone screen without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await mockWorker(page);
    await openAsLoggedIn(page);
    await page.getByRole('button', { name: /#fm-coiffe/ }).click();
    await expect(page.getByRole('row', { name: /Rune Do Air/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
