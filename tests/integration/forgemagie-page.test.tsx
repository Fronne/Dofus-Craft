import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { FmMe, FmSession } from '../../src/domain/forgemagie';

// specs/025-rune-purchase-import: the Forgemagie page with the Worker's /fm/* routes and the capture
// reading simulated.
const fm = vi.hoisted(() => ({
  getFmMe: vi.fn(),
  updateFmMe: vi.fn(),
  deleteFmMe: vi.fn(),
  logoutFm: vi.fn(),
  getFmSessions: vi.fn(),
  getFmSession: vi.fn(),
  getFmPlayers: vi.fn(),
  getFmPlayer: vi.fn(),
  importFmCapture: vi.fn(),
  createFmItem: vi.fn(),
  renameFmItem: vi.fn(),
  deleteFmItem: vi.fn(),
  getFmItem: vi.fn(),
  attachFmSession: vi.fn(),
  detachFmSession: vi.fn(),
  getFmChannels: vi.fn(),
  startFmSession: vi.fn(),
  stopFmSession: vi.fn(),
  resendFmSession: vi.fn(),
}));
vi.mock('../../src/services/fm-api', () => ({ ...fm, fmLoginUrl: () => 'https://api.test/fm/auth/login' }));

const readCapture = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/capture-ocr', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/capture-ocr')>()),
  readCapture,
}));

const getCommunityPrices = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getCommunityPrices,
  getSharedItemPrices: vi.fn().mockResolvedValue({ status: 'found', items: [] }),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getPriceHistory: vi.fn().mockResolvedValue({ status: 'found', points: [] }),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getItemDetail: vi.fn(),
  getResourceRecipe: vi.fn().mockResolvedValue(null),
  getResourceDetails: vi.fn().mockResolvedValue([]),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';
import { searchItems } from '../../src/data/catalogue-repository';
import { readFmSessionToken, writeFmSessionToken } from '../../src/persistence/fm-session-token';

const TOKEN = 'a'.repeat(64);
const me: FmMe = { discordUserId: '42', displayName: 'Cyril', avatarUrl: null, serverId: 'mikhal', isPrivate: false, firstLoginAt: '2026-09-30T10:00:00.000Z' };
const alice = { discordUserId: '42', displayName: 'Cyril', avatarUrl: null, private: false };
const hidden = { discordUserId: null, displayName: null, avatarUrl: null, private: true };

const openSession: FmSession = {
  id: 's2', channelName: 'fm-cape', status: 'open', openedAt: '2026-09-30T18:00:00.000Z', closedAt: null, totalKamas: 68472,
  players: [{ player: alice, spentKamas: 63472 }, { player: hidden, spentKamas: 5000 }], fmItem: null, owner: null, origin: 'discord', sync: null, canStop: false,
};
const closedSession: FmSession = {
  id: 's1', channelName: 'fm-coiffe', status: 'closed', openedAt: '2026-09-29T18:00:00.000Z', closedAt: '2026-09-29T19:00:00.000Z', totalKamas: 1000,
  players: [{ player: alice, spentKamas: 1000 }], fmItem: null, owner: null, origin: 'discord', sync: null, canStop: false,
};
const ok = <T,>(data: T) => ({ status: 'ok', data });

async function openForgemagie(path = '/forgemagie') {
  window.history.replaceState(null, '', path);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  if (!window.location.pathname.startsWith('/forgemagie')) fireEvent.click(screen.getByRole('link', { name: 'Forgemagie' }));
  await screen.findByRole('heading', { name: 'Forgemagie' });
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.localStorage.setItem('craftcheck-price-mode-choice', 'community');
  globalThis.indexedDB = new IDBFactory();
  Object.values(fm).forEach((mock) => mock.mockReset());
  fm.getFmMe.mockResolvedValue(ok(me));
  fm.updateFmMe.mockImplementation(async (changes: Partial<FmMe>) => ok({ ...me, ...changes }));
  fm.logoutFm.mockResolvedValue(ok(undefined));
  // specs/028: « mine=open » (the capture import) lists no session by default.
  fm.getFmSessions.mockImplementation(async (_before?: string | null, filter?: { mine?: string }) =>
    ok(filter?.mine ? { sessions: [], nextBefore: null } : { sessions: [openSession, closedSession], nextBefore: null }));
  fm.getFmPlayers.mockResolvedValue(ok({ players: [] }));
  fm.getFmPlayer.mockResolvedValue(ok({ player: alice, totalKamas: 150000, importedKamas: 0, items: [], fmItems: [], sessions: [
    { sessionId: 's2', channelName: 'fm-cape', openedAt: '2026-09-30T18:00:00.000Z', spentKamas: 100000 },
    { sessionId: 's1', channelName: 'fm-coiffe', openedAt: '2026-09-29T18:00:00.000Z', spentKamas: 50000 },
  ] }));
  getCommunityPrices.mockReset();
  getCommunityPrices.mockResolvedValue({ status: 'found', prices: [] });
  readCapture.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const normalize = (value: string | null | undefined) => (value ?? '').replace(/[\u202f\u00a0]/g, ' ');

describe('Forgemagie page — login (US1)', () => {
  it('asks a logged-out player to log in with Discord', async () => {
    await openForgemagie();
    expect(screen.getByRole('link', { name: 'Se connecter avec Discord' })).toHaveAttribute('href', 'https://api.test/fm/auth/login');
    expect(fm.getFmMe).not.toHaveBeenCalled();
  });

  it('explains a refused login and removes it from the address', async () => {
    await openForgemagie('/forgemagie#error=not-member');
    expect(screen.getByRole('alert')).toHaveTextContent('réservée aux membres du serveur Discord du groupe');
    expect(window.location.hash).toBe('');
  });

  it('keeps the session given back by Discord, removes it from the address and shows the player', async () => {
    await openForgemagie(`/forgemagie#session=${TOKEN}`);
    await screen.findByRole('button', { name: 'Se déconnecter' });
    expect(readFmSessionToken()).toBe(TOKEN);
    expect(window.location.hash).toBe('');
    expect(screen.getAllByText('Cyril').length).toBeGreaterThan(0);
  });

  it('gives a first login the site\'s active server', async () => {
    fm.getFmMe.mockResolvedValue(ok({ ...me, serverId: null }));
    await openForgemagie(`/forgemagie#session=${TOKEN}`);
    await screen.findByRole('button', { name: 'Se déconnecter' });
    expect(fm.updateFmMe).toHaveBeenCalledWith({ serverId: 'mikhal' });
  });

  it('goes back to the login screen after logging out', async () => {
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));
    await screen.findByRole('link', { name: 'Se connecter avec Discord' });
    expect(fm.logoutFm).toHaveBeenCalled();
    expect(readFmSessionToken()).toBeUndefined();
  });

  it('never calls the Forgemagie routes from another page', async () => {
    writeFmSessionToken(TOKEN);
    window.history.replaceState(null, '', '/');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await screen.findByRole('link', { name: 'Forgemagie' });
    Object.values(fm).forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });
});

describe('Forgemagie page — sessions (US2, US3)', () => {
  it('lists the sessions with their state, total and players, a private one masked', async () => {
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    const cards = await screen.findAllByRole('button', { name: /#fm-/ });
    expect(normalize(cards[0].textContent)).toContain('En cours');
    expect(normalize(cards[0].textContent)).toContain('68 472 kamas');
    expect(within(cards[0]).getByText('Joueur privé')).toBeInTheDocument();
    expect(normalize(cards[1].textContent)).toContain('Terminée');
  });

  it('details a session with each item', async () => {
    writeFmSessionToken(TOKEN);
    fm.getFmSession.mockResolvedValue(ok({ ...openSession, items: [{ itemName: 'Rune Do Air', itemId: '11663', quantity: 40, totalKamas: 63472, averageUnitKamas: 1587 }] }));
    await openForgemagie();
    fireEvent.click((await screen.findAllByRole('button', { name: /#fm-cape/ }))[0]);
    const row = (await screen.findByRole('rowheader', { name: 'Rune Do Air' })).closest('tr')!;
    expect(normalize(row.textContent)).toContain('40');
    expect(normalize(row.textContent)).toContain('63 472 kamas');
    expect(normalize(row.textContent)).toContain('1 587 kamas/u');
  });

  it('loads the next page of sessions', async () => {
    writeFmSessionToken(TOKEN);
    fm.getFmSessions.mockResolvedValueOnce(ok({ sessions: [openSession], nextBefore: openSession.openedAt }))
      .mockResolvedValueOnce(ok({ sessions: [closedSession], nextBefore: null }));
    await openForgemagie();
    fireEvent.click(await screen.findByRole('button', { name: 'Charger plus' }));
    await screen.findByRole('button', { name: /#fm-coiffe/ });
    expect(fm.getFmSessions).toHaveBeenLastCalledWith(openSession.openedAt);
    expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument();
  });

  it('shows the player\'s spending on their profile', async () => {
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click(await screen.findByRole('tab', { name: 'Profil' }));
    await waitFor(() => expect(normalize(screen.getByText(/Total dépensé/).textContent)).toContain('150 000 kamas'));
    expect(screen.getByRole('button', { name: /#fm-cape/ })).toBeInTheDocument();
  });

  it('deletes the profile only after an explicit confirmation', async () => {
    writeFmSessionToken(TOKEN);
    fm.deleteFmMe.mockResolvedValue(ok(undefined));
    await openForgemagie();
    fireEvent.click(await screen.findByRole('tab', { name: 'Profil' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer mon profil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(fm.deleteFmMe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon profil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }));
    await screen.findByRole('link', { name: 'Se connecter avec Discord' });
    expect(fm.deleteFmMe).toHaveBeenCalledTimes(1);
  });
});

// specs/026-hdv-rune-prices: the rune prices moved to the HDV page; the capture import is in Profil.
describe('Forgemagie page — tabs and capture import (specs/026)', () => {
  it('has only the Sessions and Profil tabs', async () => {
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    await screen.findByRole('tab', { name: 'Sessions' });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Sessions', 'Profil']);
  });

  it('imports a capture from the Profil tab, recording nothing before « Valider », then rereads the spending', async () => {
    readCapture.mockResolvedValue({ status: 'ok', lines: [
      { itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868, resource: { id: '11663', name: 'Rune Do Air' } },
      { itemName: 'Rune Do Alr', quantity: 10, totalKamas: 15868, resource: null },
    ] });
    fm.importFmCapture.mockResolvedValue(ok({ captureId: 'c1', lines: [] }));
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click(await screen.findByRole('tab', { name: 'Profil' }));
    await waitFor(() => expect(document.querySelector('.fm-import')).not.toBeNull());
    const readsBefore = fm.getFmPlayer.mock.calls.length;

    const section = document.querySelector<HTMLElement>('.fm-import')!;
    const file = new File(['x'], 'capture.png', { type: 'image/png' });
    fireEvent.drop(section.querySelector('.fm-dropzone')!, { dataTransfer: { files: [file] } });
    await waitFor(() => expect(section.querySelector('.fm-import-lines')).not.toBeNull());
    const rowOfLine = (name: string) => [...section.querySelectorAll('.fm-import-lines tbody tr')].find((row) => row.querySelector('th')?.textContent?.includes(name))!;
    expect(fm.importFmCapture).not.toHaveBeenCalled();

    // The misread line blocks the validation until it is unchecked (or its item chosen).
    const validate = within(section).getByText('Valider').closest('button')!;
    expect(validate).toBeDisabled();
    fireEvent.click(within(section).getByLabelText('Garder Rune Do Alr'));
    fireEvent.change(within(section).getByLabelText('Total de Rune Do Air'), { target: { value: '16000' } });
    expect(normalize(rowOfLine('Rune Do Air').textContent)).toContain('1 600 kamas/u');

    fireEvent.click(validate);
    await waitFor(() => expect(fm.importFmCapture).toHaveBeenCalledWith(
      [{ itemName: 'Rune Do Air', itemId: '11663', quantity: 10, totalKamas: 16000 }],
      true,
      undefined,
    ));
    await waitFor(() => expect(section.textContent).toContain('1 achat enregistré.'));
    await waitFor(() => expect(fm.getFmPlayer.mock.calls.length).toBeGreaterThan(readsBefore));
  });

  it('offers no import on another member\'s profile', async () => {
    fm.getFmPlayers.mockResolvedValue(ok({ players: [{ discordUserId: '7', displayName: 'Bob', avatarUrl: null, private: false, totalKamas: 10 }] }));
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click(await screen.findByRole('tab', { name: 'Profil' }));
    await waitFor(() => expect(document.querySelector('.fm-import')).not.toBeNull());
    fireEvent.change(await screen.findByRole('combobox', { name: 'Voir le profil de' }), { target: { value: '7' } });
    await waitFor(() => expect(document.querySelector('.fm-import')).toBeNull());
    expect(fm.getFmPlayer).toHaveBeenLastCalledWith('7');
  });
});

// specs/027-fm-item-recap: items in FM, attaching a session, the recap.
describe('Forgemagie page — items in FM (specs/027)', () => {
  const rtograf = {
    id: 'i1', itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null, label: 'Rtograf PA',
    owner: alice, totalKamas: 150000, sessionCount: 2,
  };
  const withItems = (fmItems: unknown[]) => ok({ player: alice, totalKamas: 150000, importedKamas: 0, items: [], sessions: [], fmItems });

  async function openProfile() {
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click(await screen.findByRole('tab', { name: 'Profil' }));
  }

  it('adds an item chosen in the equipment catalogue, with an optional name', async () => {
    vi.mocked(searchItems).mockResolvedValue({ total: 2, limit: 40, skip: 0, data: [
      { id: '8237', name: 'Anneau Rtograf', kind: 'Equipment', categoryId: 'ring', level: 200 },
      { id: '1', name: 'Rtograf ressource', kind: 'Resource', categoryId: 'res' },
    ] });
    fm.createFmItem.mockResolvedValue(ok(rtograf));
    await openProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter un objet' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un équipement' }), { target: { value: 'rtograf' } });
    fireEvent.click(await screen.findByRole('button', { name: /Anneau Rtograf/ }, { timeout: 2000 }));
    expect(screen.queryByRole('button', { name: /Rtograf ressource/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: "Nom de l'objet" }), { target: { value: '  Rtograf PA ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(fm.createFmItem).toHaveBeenCalledWith({ itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null, label: 'Rtograf PA' }));
  });

  it('opens an item\'s recap with its total, sessions and runes', async () => {
    fm.getFmPlayer.mockResolvedValue(withItems([rtograf]));
    fm.getFmItem.mockResolvedValue(ok({
      ...rtograf,
      sessions: [{ id: 's2', channelName: 'fm-anneau', status: 'closed', openedAt: '2026-09-30T18:00:00.000Z', totalKamas: 150000 }],
      items: [{ itemName: 'Rune Pa Ga', itemId: '1', quantity: 12, totalKamas: 96000, averageUnitKamas: 8000 }],
    }));
    await openProfile();
    fireEvent.click(await screen.findByRole('button', { name: /Rtograf PA/ }));
    await waitFor(() => expect(normalize(screen.getByText(/Total dépensé/).textContent)).toContain('150 000 kamas'));
    expect(screen.getByRole('button', { name: /#fm-anneau/ })).toBeInTheDocument();
    expect(normalize(screen.getByRole('rowheader', { name: 'Rune Pa Ga' }).closest('tr')!.textContent)).toContain('8 000 kamas/u');
    expect(fm.getFmItem).toHaveBeenCalledWith('i1');
  });

  it('deletes an item only after an explicit confirmation', async () => {
    fm.getFmPlayer.mockResolvedValue(withItems([rtograf]));
    fm.deleteFmItem.mockResolvedValue(ok(undefined));
    await openProfile();
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Annuler' }).at(-1)!);
    expect(fm.deleteFmItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(screen.getByRole('button', { name: "Supprimer l'objet" }));
    await waitFor(() => expect(fm.deleteFmItem).toHaveBeenCalledWith('i1'));
  });

  it('shows another member\'s items read only', async () => {
    fm.getFmPlayers.mockResolvedValue(ok({ players: [{ discordUserId: '7', displayName: 'Bob', avatarUrl: null, private: false, totalKamas: 10 }] }));
    fm.getFmPlayer.mockImplementation(async (id: string) => withItems(id === '7' ? [{ ...rtograf, owner: { ...alice, discordUserId: '7', displayName: 'Bob' } }] : []));
    await openProfile();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Voir le profil de' }), { target: { value: '7' } });
    await screen.findByRole('button', { name: /Rtograf PA/ });
    expect(screen.queryByRole('button', { name: 'Ajouter un objet' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renommer' })).not.toBeInTheDocument();
  });

  it('attaches a session to one of the player\'s items from its detail, then offers to detach it', async () => {
    const detail = { ...closedSession, items: [], canAttach: true, canDetach: false };
    fm.getFmSession.mockResolvedValue(ok(detail));
    fm.getFmPlayer.mockResolvedValue(withItems([rtograf]));
    fm.attachFmSession.mockResolvedValue(ok({ ...detail, fmItem: { id: 'i1', name: 'Rtograf PA', owner: alice }, canAttach: false, canDetach: true }));
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click((await screen.findAllByRole('button', { name: /#fm-coiffe/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Rattacher' }));
    await waitFor(() => expect(fm.attachFmSession).toHaveBeenCalledWith('s1', 'i1'));
    expect(await screen.findByText('Rtograf PA (Cyril)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Détacher' })).toBeInTheDocument();
  });

  it('explains a session attached meanwhile by someone else', async () => {
    fm.getFmSession.mockResolvedValue(ok({ ...closedSession, items: [], canAttach: true, canDetach: false }));
    fm.getFmPlayer.mockResolvedValue(withItems([rtograf]));
    fm.attachFmSession.mockResolvedValue({ status: 'error', code: 'already-attached' });
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click((await screen.findAllByRole('button', { name: /#fm-coiffe/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Rattacher' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('vient d’être rattachée à un autre objet');
  });

  it('offers to create an item when the player has none yet', async () => {
    fm.getFmSession.mockResolvedValue(ok({ ...closedSession, items: [], canAttach: true, canDetach: false }));
    fm.getFmPlayer.mockResolvedValue(withItems([]));
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click((await screen.findAllByRole('button', { name: /#fm-coiffe/ }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un objet en FM' }));
    expect(await screen.findByRole('tab', { name: 'Profil' })).toHaveAttribute('aria-selected', 'true');
  });
});

// specs/028-site-started-sessions: starting, following and stopping a session from the site.
describe('Forgemagie page — sessions started from the site (specs/028)', () => {
  const siteSession = {
    ...openSession, id: 's9', channelName: 'fm-anneau', origin: 'site' as const, owner: alice,
    sync: { status: 'pending' as const, error: null }, canStop: true, items: [], canAttach: false, canDetach: false,
  };

  it('starts a session in a free channel with an item, then opens its detail', async () => {
    fm.getFmChannels.mockResolvedValue(ok({ channels: [
      { channelId: 'c1', channelName: 'fm-anneau', busy: false },
      { channelId: 'c2', channelName: 'fm-cape', busy: true },
    ] }));
    fm.getFmPlayer.mockResolvedValue(ok({ player: alice, totalKamas: 0, importedKamas: 0, items: [], sessions: [], fmItems: [
      { id: 'i1', itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null, label: 'Rtograf PA', owner: alice, totalKamas: 0, sessionCount: 0 },
    ] }));
    fm.startFmSession.mockResolvedValue(ok(siteSession));
    fm.getFmSession.mockResolvedValue(ok(siteSession));
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click(await screen.findByRole('button', { name: 'Démarrer une session' }));
    const channel = await screen.findByRole('combobox', { name: 'Salon Discord' });
    expect(within(channel).getByRole('option', { name: /fm-cape/ })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Objet en FM' }), { target: { value: 'i1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer' }));
    await waitFor(() => expect(fm.startFmSession).toHaveBeenCalledWith('c1', 'i1'));
    expect(await screen.findByText('En attente de Discord…')).toBeInTheDocument();
  });

  it('offers to resend a request not transmitted, and to stop only after a confirmation', async () => {
    const stale = { ...siteSession, sync: { status: 'stale' as const, error: null } };
    fm.getFmSessions.mockImplementation(async (_before?: string | null, filter?: { mine?: string }) =>
      ok(filter?.mine ? { sessions: [], nextBefore: null } : { sessions: [stale], nextBefore: null }));
    fm.getFmSession.mockResolvedValue(ok(stale));
    fm.resendFmSession.mockResolvedValue(ok(siteSession));
    fm.stopFmSession.mockResolvedValue(ok({ ...siteSession, status: 'closed', canStop: false, sync: { status: 'cancelled', error: null } }));
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click(await screen.findByRole('button', { name: /#fm-anneau/ }));
    expect(await screen.findByText('Non transmise à Discord')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Relancer' }));
    await waitFor(() => expect(fm.resendFmSession).toHaveBeenCalledWith('s9'));

    fireEvent.click(await screen.findByRole('button', { name: 'Arrêter la session' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Annuler' }).at(-1)!);
    expect(fm.stopFmSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter' }));
    await waitFor(() => expect(fm.stopFmSession).toHaveBeenCalledWith('s9'));
    expect(await screen.findByText('Terminée')).toBeInTheDocument();
  });

  it('sends a capture imported on the site into the open session', async () => {
    fm.getFmSessions.mockImplementation(async (_before?: string | null, filter?: { mine?: string }) =>
      ok(filter?.mine ? { sessions: [siteSession], nextBefore: null } : { sessions: [], nextBefore: null }));
    readCapture.mockResolvedValue({ status: 'ok', lines: [{ itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868, resource: { id: '11663', name: 'Rune Do Air' } }] });
    fm.importFmCapture.mockResolvedValue(ok({ captureId: 'c1', lines: [] }));
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click(await screen.findByRole('tab', { name: 'Profil' }));
    await waitFor(() => expect(document.querySelector('.fm-import')).not.toBeNull());
    const section = document.querySelector<HTMLElement>('.fm-import')!;
    fireEvent.drop(section.querySelector('.fm-dropzone')!, { dataTransfer: { files: [new File(['x'], 'c.png', { type: 'image/png' })] } });
    await waitFor(() => expect(within(section).getByLabelText("Session de l'import")).toHaveValue('s9'));
    fireEvent.click(within(section).getByText('Valider').closest('button')!);
    await waitFor(() => expect(fm.importFmCapture).toHaveBeenCalledWith(expect.any(Array), true, 's9'));
  });
});
