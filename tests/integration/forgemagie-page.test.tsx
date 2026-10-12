import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { FmCaptureLine, FmGroupPlayer, FmMe, FmSeance, FmSeanceCapture, FmSeanceDetail, FmSeanceSession } from '../../src/domain/forgemagie';

// specs/025-rune-purchase-import then specs/049-fm-seances: the Forgemagie page with the Worker's /fm/*
// routes and the capture reading simulated.
const fm = vi.hoisted(() => ({
  getFmMe: vi.fn(),
  updateFmMe: vi.fn(),
  deleteFmMe: vi.fn(),
  logoutFm: vi.fn(),
  getFmSeances: vi.fn(),
  getFmSeance: vi.fn(),
  archiveFmSeance: vi.fn(),
  reopenFmSeance: vi.fn(),
  setFmSeanceItem: vi.fn(),
  removeFmSeanceItem: vi.fn(),
  correctFmCapture: vi.fn(),
  renameFmItem: vi.fn(),
  importFmCapture: vi.fn(),
  createFmSeance: vi.fn(),
  getFmChannelRequest: vi.fn(),
  startFmSession: vi.fn(),
  stopFmSession: vi.fn(),
  resendFmSession: vi.fn(),
  getFmPlayers: vi.fn(),
  getFmPlayer: vi.fn(),
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
const me: FmMe = {
  discordUserId: '42', displayName: 'Cyril', avatarUrl: null, serverId: 'mikhal', isPrivate: false, firstLoginAt: '2026-09-30T10:00:00.000Z',
  guildName: 'Les Forgemages',
};
const cyril = { discordUserId: '42', displayName: 'Cyril', avatarUrl: null, private: false };
const rtograf = { id: 'i1', name: 'Rtograf PA', itemName: 'Anneau Rtograf', label: 'Rtograf PA', imageUrl: null };
const ownedRtograf = { id: 'i1', itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null, label: 'Rtograf PA', owner: cyril, totalKamas: 0, sessionCount: 0 };

const running: FmSeance = {
  id: 'c2', name: 'fm-cyril-rtograf', state: 'running', discord: 'active', fmItem: rtograf, totalKamas: 68472, sessionCount: 2, captureCount: 2,
  createdAt: '2026-09-29T18:00:00.000Z', lastActivityAt: '2026-09-30T18:30:00.000Z',
};
const paused: FmSeance = {
  id: 'c1', name: 'fm-cyril-coiffe', state: 'paused', discord: 'active', fmItem: null, totalKamas: 1000, sessionCount: 1, captureCount: 0,
  createdAt: '2026-09-28T18:00:00.000Z', lastActivityAt: '2026-09-28T19:00:00.000Z',
};
const archived: FmSeance = { ...paused, id: 'c0', name: 'fm-cyril-cape', state: 'archived', discord: 'archived' };

const doAir = { itemName: 'Rune Do Air', itemId: '11663', quantity: 10, totalKamas: 15868, averageUnitKamas: 1587 };
const gaPa = { itemName: 'Rune Ga Pa', itemId: null, quantity: 1, totalKamas: 52604, averageUnitKamas: 52604 };
const doAirLine: FmCaptureLine = {
  id: 'l1', itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868, unitPriceKamas: 1587, originalQuantity: 10, originalTotalKamas: 15868,
  corrected: false, priceStatus: 'recorded',
};
const gaPaLine: FmCaptureLine = {
  id: 'l2', itemName: 'Rune Ga Pa', quantity: 1, totalKamas: 52604, unitPriceKamas: 52604, originalQuantity: 1, originalTotalKamas: 52604,
  corrected: false, priceStatus: 'recorded',
};
const botCapture: FmSeanceCapture = {
  id: 'cap1', createdAt: '2026-09-30T18:10:00.000Z', origin: 'bot', spentKamas: 68472, items: [doAir, gaPa], corrected: false,
  lines: [doAirLine, gaPaLine],
  ignored: [{ itemName: 'Potion de rappel', quantity: 1, totalKamas: 300 }, { itemName: 'Potion de rappel', quantity: 2, totalKamas: 700 }],
};
const openSession: FmSeanceSession = {
  id: 's2', status: 'open', openedAt: '2026-09-30T18:00:00.000Z', closedAt: null, totalKamas: 68472, sync: { status: 'opened', error: null },
  canStop: true, captures: [botCapture],
};
const closedSession: FmSeanceSession = {
  id: 's1', status: 'closed', openedAt: '2026-09-29T18:00:00.000Z', closedAt: '2026-09-29T19:00:00.000Z', totalKamas: 0, sync: null,
  canStop: false, captures: [],
};
const runningDetail: FmSeanceDetail = {
  ...running, quantity: 11, items: [doAir, gaPa], sessions: [openSession, closedSession], request: null,
  canResume: false, canArchive: true, canReopen: false,
};
const pausedDetail: FmSeanceDetail = {
  ...paused, quantity: 0, items: [], sessions: [closedSession], request: null, canResume: true, canArchive: true, canReopen: false,
};
const archivedDetail: FmSeanceDetail = { ...pausedDetail, ...archived, canResume: false, canArchive: false, canReopen: true };

const ok = <T,>(data: T) => ({ status: 'ok', data });
const normalize = (value: string | null | undefined) => (value ?? '').replace(/[\u202f\u00a0]/g, ' ');

async function openForgemagie(path = '/forgemagie') {
  window.history.replaceState(null, '', path);
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  if (!window.location.pathname.startsWith('/forgemagie')) fireEvent.click(screen.getByRole('link', { name: 'Forgemagie' }));
  await screen.findByRole('heading', { name: 'Forgemagie' });
}

/** Logged in, on the list of séances. */
async function openSeances() {
  writeFmSessionToken(TOKEN);
  await openForgemagie();
  await screen.findByRole('tab', { name: 'Séances de FM' });
}

/** Logged in, on the detail of a séance. */
async function openSeance(detail: FmSeanceDetail = runningDetail) {
  fm.getFmSeances.mockResolvedValue(ok([detail]));
  fm.getFmSeance.mockResolvedValue(ok(detail));
  await openSeances();
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(detail.fmItem ? detail.fmItem.name : `#${detail.name}`) }));
  await screen.findByRole('heading', { name: new RegExp(`#${detail.name}`) });
}

/** The folded block — a session or a capture — whose heading matches. */
const fold = (text: RegExp) => screen.getByText(text).closest('details')!;
const noItems = { data: [], total: 0, limit: 40, skip: 0 };

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.localStorage.setItem('craftcheck-price-mode-choice', 'community');
  globalThis.indexedDB = new IDBFactory();
  Object.values(fm).forEach((mock) => mock.mockReset());
  fm.getFmMe.mockResolvedValue(ok(me));
  fm.updateFmMe.mockImplementation(async (changes: Partial<FmMe>) => ok({ ...me, ...changes }));
  fm.logoutFm.mockResolvedValue(ok(undefined));
  fm.getFmSeances.mockResolvedValue(ok([running, paused, archived]));
  fm.getFmSeance.mockResolvedValue(ok(runningDetail));
  fm.getFmPlayers.mockResolvedValue(ok([]));
  fm.getFmPlayer.mockResolvedValue(ok({ player: cyril, totalKamas: 150500, importedKamas: 500, items: [doAir], fmItems: [ownedRtograf], sessions: [
    { sessionId: 's2', channelId: 'c2', channelName: 'fm-cyril-rtograf', openedAt: '2026-09-30T18:00:00.000Z', spentKamas: 100000, canOpen: true },
    { sessionId: 's1', channelId: 'c2', channelName: 'fm-cyril-rtograf', openedAt: '2026-09-29T18:00:00.000Z', spentKamas: 40000, canOpen: true },
    { sessionId: 's0', channelId: 'c9', channelName: 'fm-ancien', openedAt: '2026-09-20T18:00:00.000Z', spentKamas: 10000, canOpen: false },
  ] }));
  getCommunityPrices.mockReset();
  getCommunityPrices.mockResolvedValue({ status: 'found', prices: [] });
  readCapture.mockReset();
  vi.mocked(searchItems).mockResolvedValue(noItems);
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('Forgemagie page — login (US1)', () => {
  it('asks a logged-out player to log in with Discord, saying what Discord will ask', async () => {
    await openForgemagie();
    expect(screen.getByText('Tes séances de FM, leurs sessions et ce qu\'elles ont coûté.')).toBeInTheDocument();
    expect(screen.getByText(/Connecte-toi avec ton compte Discord pour retrouver tes séances de FM et ce qu'elles ont coûté\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter avec Discord' })).toHaveAttribute('href', 'https://api.test/fm/auth/login');
    expect(screen.getByText(/Discord te demandera aussi l'accès à la liste de tes serveurs : seul le nom de celui du groupe y est lu\./)).toBeInTheDocument();
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

  it('files the profile on the site\'s server when it is on another, or on none', async () => {
    fm.getFmMe.mockResolvedValue(ok({ ...me, serverId: null }));
    await openSeances();
    await waitFor(() => expect(fm.updateFmMe).toHaveBeenCalledWith({ serverId: 'mikhal' }));
    cleanup();

    fm.updateFmMe.mockClear();
    fm.getFmMe.mockResolvedValue(ok({ ...me, serverId: 'draconiros' }));
    window.history.replaceState(null, '', '/forgemagie');
    render(<App />);
    await screen.findByRole('tab', { name: 'Séances de FM' });
    await waitFor(() => expect(fm.updateFmMe).toHaveBeenCalledWith({ serverId: 'mikhal' }));
    expect(fm.updateFmMe).toHaveBeenCalledTimes(1);
  });

  it('leaves a profile already on the site\'s server alone', async () => {
    await openSeances();
    await screen.findAllByRole('button', { name: /fm-cyril/ });
    expect(fm.updateFmMe).not.toHaveBeenCalled();
  });

  it('goes back to the login screen after logging out', async () => {
    await openSeances();
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

  it('offers to retry when the service does not answer', async () => {
    fm.getFmMe.mockResolvedValueOnce({ status: 'unavailable' });
    writeFmSessionToken(TOKEN);
    await openForgemagie();
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));
    await screen.findByRole('tab', { name: 'Séances de FM' });
  });
});

describe('Forgemagie page — séances de FM (US1)', () => {
  it('has three tabs, the players\' one named after the group', async () => {
    await openSeances();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Séances de FM', 'Les Forgemages', 'Profil']);
    expect(screen.getByRole('tab', { name: 'Séances de FM' })).toHaveAttribute('aria-selected', 'true');
  });

  it('names the players\' tab « Joueurs » when the group\'s name is unknown', async () => {
    fm.getFmMe.mockResolvedValue(ok({ ...me, guildName: null }));
    await openSeances();
    expect(screen.getByRole('tab', { name: 'Joueurs' })).toBeInTheDocument();
  });

  it('lists the séances with their item, state, sessions and total', async () => {
    await openSeances();
    const cards = await screen.findAllByRole('button', { name: /fm-cyril/ });
    expect(cards).toHaveLength(3);
    const [first, second, third] = cards.map((card) => normalize(card.textContent));
    expect(first).toContain('Rtograf PA');
    expect(first).toContain('En cours');
    expect(first).toContain('#fm-cyril-rtograf · 2 sessions · dernière activité le');
    expect(first).toContain('68 472');
    expect(second).toContain('#fm-cyril-coiffe');
    expect(second).toContain('En pause');
    expect(second).toContain('1 session · dernière activité le');
    expect(third).toContain('Archivée');
    expect(fm.getFmSeances).toHaveBeenCalled();
  });

  it('invites to create a first séance when there is none', async () => {
    fm.getFmSeances.mockResolvedValue(ok([]));
    await openSeances();
    expect(await screen.findByText('Aucune séance de FM pour l\'instant')).toBeInTheDocument();
    expect(screen.getByText(/Crée ta première séance de FM ici, ou avec le bouton « Nouvelle séance de FM » dans Discord/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouvelle séance de FM' })).toBeInTheDocument();
  });

  it('says so when the séances cannot be read', async () => {
    fm.getFmSeances.mockResolvedValue({ status: 'unavailable' });
    await openSeances();
    expect(await screen.findByText('Séances de FM indisponibles')).toBeInTheDocument();
  });

  it('goes back to the login screen when the session expired', async () => {
    fm.getFmSeances.mockResolvedValue({ status: 'unauthorized' });
    await openSeances();
    await screen.findByRole('link', { name: 'Se connecter avec Discord' });
  });

  it('opens a séance: its figures, what was bought and its sessions', async () => {
    await openSeance();
    expect(fm.getFmSeance).toHaveBeenCalledWith('c2');
    expect(screen.getByText(/Créée le .* · dernière activité le /)).toBeInTheDocument();

    const tiles = [...document.querySelectorAll('.fm-detail-stats .stat-tile')].map((tile) => normalize(tile.textContent));
    expect(tiles).toEqual(['Total dépensé68 472 kamas', 'Runes achetées11', 'Sessions2', 'Captures2']);

    const purchases = screen.getByRole('heading', { name: 'Achats' }).nextElementSibling as HTMLElement;
    const rows = within(purchases).getAllByRole('row').map((row) => normalize(row.textContent));
    expect(rows[0]).toBe('ObjetQuantitéTotalPrix moyen');
    expect(rows[1]).toContain('Rune Do Air');
    expect(rows[1]).toContain('1 587');
    expect(rows[1]).toContain('/u');
    expect(rows[3]).toMatch(/^Total11/);
    expect(rows[3]).toContain('68 472');
    // A rune of the catalogue has its picture.
    expect(within(purchases).getAllByRole('row')[1].querySelector('img.fm-bought-icon')).not.toBeNull();

    const sessions = screen.getByRole('region', { name: 'Sessions' });
    expect(within(sessions).getByRole('heading', { name: 'Sessions (2)' })).toBeInTheDocument();
    const open = normalize(fold(/Session du 30/).textContent);
    expect(open).toContain('en cours · 1 capture');
    expect(open).toContain('Ouverte dans Discord');
    const closed = normalize(fold(/Session du 29/).textContent);
    expect(closed).toContain('arrêtée le');
    expect(closed).toContain('0 capture');
    expect(closed).toContain('Aucune capture n\'a été lue pendant cette session.');
  });

  it('shows a capture: where it comes from, what it bought and what does not count', async () => {
    await openSeance();
    const capture = normalize(fold(/^Capture 1$/).textContent);
    expect(capture).toContain('· Discord');
    expect(capture).toContain('Rune Ga Pa');
    expect(capture).toContain('Non compté (pas une rune) : 3 × Potion de rappel (1 000 kamas).');
    expect(capture).toContain('Le bot, dans Discord, les compte dans son total.');
    expect(within(fold(/^Capture 1$/)).getByRole('button', { name: 'Corriger' })).toBeInTheDocument();
  });

  it('tells a capture imported on the site from one read in Discord', async () => {
    const siteCapture: FmSeanceCapture = { ...botCapture, origin: 'capture', corrected: true, lines: [] };
    await openSeance({ ...runningDetail, sessions: [{ ...openSession, captures: [siteCapture] }] });
    const capture = normalize(fold(/^Capture 1$/).textContent);
    expect(capture).toContain('· Site');
    expect(capture).toContain('corrigée');
    expect(capture).not.toContain('Le bot, dans Discord');
    expect(capture).not.toContain('Le récap du bot');
    // Without its lines, a capture cannot be corrected.
    expect(within(fold(/^Capture 1$/)).queryByRole('button', { name: 'Corriger' })).not.toBeInTheDocument();
  });

  it('counts « objets » when something else than runes was bought, and names what was misread', async () => {
    const orbe = { itemName: 'Orbe régénérant', itemId: null, quantity: 1, totalKamas: 90000, averageUnitKamas: 90000, corrected: true, readNames: ['Orbe régénérnt'] };
    await openSeance({ ...runningDetail, items: [doAir, orbe] });
    expect(normalize(document.querySelector('.fm-detail-stats')!.textContent)).toContain('Objets achetés11');
    const purchases = screen.getByRole('heading', { name: 'Achats' }).nextElementSibling as HTMLElement;
    expect(normalize(purchases.textContent)).toContain('lu : Orbe régénérnt');
    expect(normalize(purchases.textContent)).toContain('corrigé');
  });

  it('goes back to the list, from the button and from the tab', async () => {
    await openSeance();
    fm.getFmSeances.mockResolvedValue(ok([running, paused]));
    fireEvent.click(screen.getByRole('button', { name: /Toutes les séances de FM/ }));
    expect(await screen.findAllByRole('button', { name: /fm-cyril/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Rtograf PA/ }));
    await screen.findByRole('heading', { name: /#fm-cyril-rtograf/ });
    fireEvent.click(screen.getByRole('tab', { name: 'Séances de FM' }));
    expect(await screen.findAllByRole('button', { name: /fm-cyril/ })).toHaveLength(2);
  });

  it('says so when the séance is missing or cannot be read', async () => {
    fm.getFmSeance.mockResolvedValue({ status: 'not-found' });
    await openSeances();
    fireEvent.click(await screen.findByRole('button', { name: /Rtograf PA/ }));
    expect(await screen.findByText('Séance de FM introuvable')).toBeInTheDocument();

    fm.getFmSeance.mockResolvedValue({ status: 'unavailable' });
    fireEvent.click(screen.getByRole('button', { name: /Toutes les séances de FM/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Rtograf PA/ }));
    expect(await screen.findByText('Séance de FM indisponible')).toBeInTheDocument();
  });
});

describe('Forgemagie page — creating and running a séance (US2)', () => {
  const createSeance = async (name = 'mon rtograf') => {
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle séance de FM' }));
    const input = await screen.findByRole('textbox', { name: 'Nom de la séance' });
    expect(input).toHaveAttribute('maxLength', '30');
    expect(screen.getByRole('button', { name: 'Créer la séance' })).toBeDisabled();
    fireEvent.change(input, { target: { value: name } });
    return screen.getByRole('button', { name: 'Créer la séance' });
  };

  it('asks the bot for a new séance, waits for its channel, then opens it', async () => {
    fm.createFmSeance.mockResolvedValue(ok({ requestId: 'r1' }));
    fm.getFmChannelRequest.mockResolvedValue(ok({ id: 'r1', status: 'done', error: null, channelId: 'c9', sessionId: 's1' }));
    await openSeances();
    fireEvent.click(await createSeance());
    await waitFor(() => expect(fm.createFmSeance).toHaveBeenCalledWith('mon rtograf', undefined));
    expect(await screen.findByText('Création du salon dans Discord… (quelques secondes)')).toBeInTheDocument();
    await waitFor(() => expect(fm.getFmSeance).toHaveBeenCalledWith('c9'), { timeout: 5000 });
    expect(fm.getFmChannelRequest).toHaveBeenCalledWith('r1');
  });

  it('creates the séance with one of the player\'s items, or with none after removing it', async () => {
    fm.createFmSeance.mockResolvedValue({ status: 'error' });
    await openSeances();
    const create = await createSeance();
    await waitFor(() => expect(fm.getFmPlayer).toHaveBeenCalledWith('42'));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Chercher un objet' }), { target: { value: 'rtog' } });
    expect(await screen.findByText('Mes objets en FM')).toBeInTheDocument();
    fireEvent.click(within(document.querySelector<HTMLElement>('.fm-item-search')!).getByRole('button', { name: /Rtograf PA/ }));
    expect(screen.queryByRole('searchbox', { name: 'Chercher un objet' })).not.toBeInTheDocument();
    fireEvent.click(create);
    await waitFor(() => expect(fm.createFmSeance).toHaveBeenCalledWith('mon rtograf', { fmItemId: 'i1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La séance de FM n’a pas pu être créée. Réessaie.');

    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer la séance' }));
    await waitFor(() => expect(fm.createFmSeance).toHaveBeenLastCalledWith('mon rtograf', undefined));
  });

  it('creates the séance with an equipment of the catalogue', async () => {
    vi.mocked(searchItems).mockResolvedValue({
      ...noItems,
      data: [{ id: '8237', name: 'Anneau Rtograf', kind: 'Equipment', level: 200, imageUrl: 'https://api.dofusdb.fr/img/items/9237.png' }],
      total: 1,
    } as unknown as Awaited<ReturnType<typeof searchItems>>);
    fm.createFmSeance.mockResolvedValue({ status: 'error' });
    await openSeances();
    const create = await createSeance();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Chercher un objet' }), { target: { value: 'anneau' } });
    fireEvent.click(await screen.findByRole('button', { name: /Anneau Rtograf.*Niv\. 200/ }, { timeout: 2000 }));
    fireEvent.click(create);
    await waitFor(() => expect(fm.createFmSeance).toHaveBeenCalledWith('mon rtograf', {
      item: { itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: 'https://api.dofusdb.fr/img/items/9237.png' },
    }));
  });

  it('explains the limit of 5 séances that are not archived', async () => {
    fm.createFmSeance.mockResolvedValue({ status: 'error', code: 'channel-limit' });
    await openSeances();
    fireEvent.click(await createSeance('x'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu as déjà 5 séances de FM non archivées : archives-en une avant d’en créer une autre.');
  });

  it('says why the bot could not create the channel', async () => {
    fm.createFmSeance.mockResolvedValue(ok({ requestId: 'r1' }));
    fm.getFmChannelRequest.mockResolvedValue(ok({ id: 'r1', status: 'failed', error: 'permissions manquantes' }));
    await openSeances();
    fireEvent.click(await createSeance());
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Le bot n’a pas pu créer le salon : permissions manquantes');
  });

  it('stops waiting for the bot after two minutes, the séance coming later', async () => {
    fm.createFmSeance.mockResolvedValue(ok({ requestId: 'r1' }));
    fm.getFmChannelRequest.mockResolvedValue(ok({ id: 'r1', status: 'pending' }));
    await openSeances();
    fireEvent.click(await createSeance());
    await screen.findByText(/Création du salon dans Discord/);
    const later = Date.now() + 3 * 60 * 1000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(later);
    try {
      expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Le bot n’a pas encore créé le salon.');
    } finally {
      now.mockRestore();
    }
    expect(fm.getFmSeance).not.toHaveBeenCalled();
  });

  it('stops the open session, then rereads the séance', async () => {
    fm.stopFmSession.mockResolvedValue(ok({ id: 's2' }));
    await openSeance();
    expect(screen.queryByRole('button', { name: 'Reprendre' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Relancer' })).not.toBeInTheDocument();
    fm.getFmSeance.mockResolvedValue(ok({ ...pausedDetail, id: 'c2', name: 'fm-cyril-rtograf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter la session' }));
    await waitFor(() => expect(fm.stopFmSession).toHaveBeenCalledWith('s2'));
    expect(await screen.findByRole('button', { name: 'Reprendre' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /#fm-cyril-rtograf/ })).toHaveTextContent('En pause');
  });

  it('resumes a paused séance with a new session', async () => {
    fm.startFmSession.mockResolvedValue(ok({ id: 's3' }));
    await openSeance(pausedDetail);
    expect(screen.queryByRole('button', { name: 'Arrêter la session' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    await waitFor(() => expect(fm.startFmSession).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(fm.getFmSeance).toHaveBeenCalledTimes(2));
  });

  it('says why an action was refused', async () => {
    fm.startFmSession.mockResolvedValue({ status: 'error', code: 'channel-busy' });
    await openSeance(pausedDetail);
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Une session est déjà ouverte dans cette séance.');

    fm.startFmSession.mockResolvedValue({ status: 'unavailable' });
    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('L’opération a échoué. Réessaie.'));
  });

  it('resends a session Discord did not open', async () => {
    fm.resendFmSession.mockResolvedValue(ok({ id: 's2' }));
    await openSeance({ ...runningDetail, sessions: [{ ...openSession, sync: { status: 'failed', error: 'salon introuvable' } }] });
    expect(normalize(fold(/Session du 30/).textContent)).toContain('Échec dans Discord : salon introuvable');
    fireEvent.click(screen.getByRole('button', { name: 'Relancer' }));
    await waitFor(() => expect(fm.resendFmSession).toHaveBeenCalledWith('s2'));
  });

  it('archives the séance only after a confirmation', async () => {
    fm.archiveFmSeance.mockResolvedValue(ok({ ...archivedDetail, id: 'c2', name: 'fm-cyril-rtograf', request: { type: 'archive', status: 'pending', error: null } }));
    await openSeance();
    fireEvent.click(screen.getByRole('button', { name: 'Archiver la séance' }));
    const dialog = screen.getByRole('dialog', { name: 'Archiver la séance de FM' });
    expect(dialog).toHaveTextContent('Archiver la séance de FM #fm-cyril-rtograf ?');
    expect(dialog).toHaveTextContent('La session en cours sera arrêtée. Le salon sera archivé dans Discord, en lecture seule.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(fm.archiveFmSeance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Archiver la séance' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archiver' }));
    await waitFor(() => expect(fm.archiveFmSeance).toHaveBeenCalledWith('c2'));
    expect(await screen.findByText('L’archivage du salon est demandé à Discord…')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /#fm-cyril-rtograf/ })).toHaveTextContent('Archivée');
    expect(screen.getByRole('button', { name: 'Rouvrir' })).toBeInTheDocument();
  });

  it('reopens an archived séance, or says the limit is reached', async () => {
    fm.reopenFmSeance.mockResolvedValueOnce({ status: 'error', code: 'channel-limit' });
    await openSeance(archivedDetail);
    expect(screen.queryByRole('button', { name: 'Archiver la séance' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rouvrir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu as déjà 5 séances de FM non archivées : archives-en une avant de rouvrir celle-ci.');

    fm.reopenFmSeance.mockResolvedValue(ok({ ...pausedDetail, id: 'c0', name: 'fm-cyril-cape', request: { type: 'reopen', status: 'stale', error: null } }));
    fireEvent.click(screen.getByRole('button', { name: 'Rouvrir' }));
    expect(await screen.findByText('La réouverture du salon n’est pas encore fait dans Discord : le bot ne répond pas.')).toBeInTheDocument();
    expect(fm.reopenFmSeance).toHaveBeenCalledWith('c0');
  });

  it('says when Discord failed to archive the channel', async () => {
    await openSeance({ ...pausedDetail, request: { type: 'archive', status: 'failed', error: 'accès refusé' } });
    expect(screen.getByText('L’archivage du salon a échoué dans Discord : accès refusé')).toBeInTheDocument();
  });

  it('chooses the item of a séance that has none', async () => {
    fm.setFmSeanceItem.mockResolvedValue(ok({ ...pausedDetail, fmItem: rtograf }));
    await openSeance(pausedDetail);
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Choisir l’objet de la séance' }), { target: { value: 'rtog' } });
    fireEvent.click(await screen.findByRole('button', { name: /Rtograf PA/ }));
    await waitFor(() => expect(fm.setFmSeanceItem).toHaveBeenCalledWith('c1', { fmItemId: 'i1' }));
    expect(await screen.findByText('Objet en FM')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('changes, renames and removes the item of a séance', async () => {
    await openSeance();
    const item = document.querySelector<HTMLElement>('.fm-session-item')!;
    expect(normalize(item.textContent)).toContain('Objet en FMRtograf PAAnneau Rtograf');

    // Changer opens the search; Annuler closes it.
    const change = within(item).getByRole('button', { name: 'Changer' });
    expect(change).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(change);
    expect(await within(item).findByRole('searchbox', { name: 'Choisir un autre objet' })).toBeInTheDocument();
    fireEvent.click(within(item).getByRole('button', { name: 'Annuler' }));
    expect(within(item).queryByRole('searchbox')).not.toBeInTheDocument();

    // Renommer.
    fm.renameFmItem.mockResolvedValueOnce({ status: 'unavailable' });
    fireEvent.click(within(item).getByRole('button', { name: 'Renommer' }));
    const input = within(item).getByRole('textbox', { name: 'Nouveau nom de Rtograf PA' });
    expect(input).toHaveValue('Rtograf PA');
    expect(input).toHaveAttribute('maxLength', '40');
    fireEvent.change(input, { target: { value: '  Rtograf PM ' } });
    fireEvent.click(within(item).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(item).findByRole('alert')).toHaveTextContent('L’objet n’a pas pu être renommé. Réessaie.');
    fm.renameFmItem.mockResolvedValue(ok({ ...ownedRtograf, label: 'Rtograf PM' }));
    fm.getFmSeance.mockResolvedValue(ok({ ...runningDetail, fmItem: { ...rtograf, name: 'Rtograf PM', label: 'Rtograf PM' } }));
    fireEvent.click(within(item).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(fm.renameFmItem).toHaveBeenLastCalledWith('i1', 'Rtograf PM'));
    expect(await within(item).findByText('Rtograf PM')).toBeInTheDocument();

    // An empty name gives the item back its equipment's name.
    fireEvent.click(within(item).getByRole('button', { name: 'Renommer' }));
    fireEvent.change(within(item).getByRole('textbox', { name: 'Nouveau nom de Rtograf PM' }), { target: { value: ' ' } });
    fireEvent.click(within(item).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(fm.renameFmItem).toHaveBeenLastCalledWith('i1', null));

    // Retirer.
    fm.removeFmSeanceItem.mockResolvedValue(ok({ ...runningDetail, fmItem: null }));
    fireEvent.click(await within(item).findByRole('button', { name: 'Retirer' }));
    await waitFor(() => expect(fm.removeFmSeanceItem).toHaveBeenCalledWith('c2'));
    expect(await screen.findByRole('searchbox', { name: 'Choisir l’objet de la séance' })).toBeInTheDocument();
  });

  it('imports a capture into the open session, a line that is not a rune not counting', async () => {
    readCapture.mockResolvedValue({ status: 'ok', lines: [
      { itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868, resource: { id: '11663', name: 'Rune Do Air' } },
      { itemName: 'Potion de rappel', quantity: 1, totalKamas: 300, resource: { id: '548', name: 'Potion de rappel' } },
    ] });
    fm.importFmCapture.mockResolvedValue(ok({ captureId: 'cap9', lines: [] }));
    await openSeance();
    const section = document.querySelector<HTMLElement>('.fm-import')!;
    expect(within(section).queryByLabelText('Session de l\'import')).not.toBeInTheDocument();
    fireEvent.drop(section.querySelector('.fm-dropzone')!, { dataTransfer: { files: [new File(['x'], 'c.png', { type: 'image/png' })] } });
    await waitFor(() => expect(section.querySelector('.fm-import-lines')).not.toBeNull());
    const rows = [...section.querySelectorAll('.fm-import-lines tbody tr')].map((row) => normalize(row.textContent));
    expect(rows[0]).not.toContain('pas une rune');
    expect(rows[1]).toContain('pas une rune : non comptée dans la séance');
    expect(fm.importFmCapture).not.toHaveBeenCalled();

    const reads = fm.getFmSeance.mock.calls.length;
    fireEvent.click(within(section).getByText('Valider').closest('button')!);
    await waitFor(() => expect(fm.importFmCapture).toHaveBeenCalledWith([
      { itemName: 'Rune Do Air', itemId: '11663', quantity: 10, totalKamas: 15868 },
      { itemName: 'Potion de rappel', itemId: '548', quantity: 1, totalKamas: 300 },
    ], true, 's2'));
    expect(await within(section).findByText('2 achats enregistrés, dont 1 non compté (pas une rune).')).toBeInTheDocument();
    await waitFor(() => expect(fm.getFmSeance.mock.calls.length).toBeGreaterThan(reads));
  });

  it('records nothing when the session was stopped meanwhile, and rereads the séance', async () => {
    readCapture.mockResolvedValue({ status: 'ok', lines: [{ itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868, resource: { id: '11663', name: 'Rune Do Air' } }] });
    fm.importFmCapture.mockResolvedValue({ status: 'error', code: 'session-not-open' });
    await openSeance();
    const section = document.querySelector<HTMLElement>('.fm-import')!;
    fireEvent.drop(section.querySelector('.fm-dropzone')!, { dataTransfer: { files: [new File(['x'], 'c.png', { type: 'image/png' })] } });
    await waitFor(() => expect(section.querySelector('.fm-import-lines')).not.toBeNull());
    const reads = fm.getFmSeance.mock.calls.length;
    fireEvent.click(within(section).getByText('Valider').closest('button')!);
    expect(await within(section).findByRole('alert')).toHaveTextContent('Cette session vient d’être arrêtée : rien n’a été enregistré.');
    await waitFor(() => expect(fm.getFmSeance.mock.calls.length).toBeGreaterThan(reads));
  });

  it('asks to choose the server again when the profile has none', async () => {
    fm.getFmMe.mockResolvedValue(ok({ ...me, serverId: null }));
    fm.updateFmMe.mockResolvedValue({ status: 'unavailable' });
    readCapture.mockResolvedValue({ status: 'ok', lines: [{ itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868, resource: { id: '11663', name: 'Rune Do Air' } }] });
    await openSeance();
    const section = document.querySelector<HTMLElement>('.fm-import')!;
    fireEvent.drop(section.querySelector('.fm-dropzone')!, { dataTransfer: { files: [new File(['x'], 'c.png', { type: 'image/png' })] } });
    await waitFor(() => expect(section.querySelector('.fm-import-lines')).not.toBeNull());
    fireEvent.click(within(section).getByText('Valider').closest('button')!);
    expect(await within(section).findByRole('alert')).toHaveTextContent('Ton serveur Dofus n’a pas pu être enregistré.');
    expect(fm.importFmCapture).not.toHaveBeenCalled();
  });

  it('offers no import in a séance without an open session', async () => {
    await openSeance(pausedDetail);
    expect(document.querySelector('.fm-import')).toBeNull();
  });
});

describe('Forgemagie page — correcting a capture (US3)', () => {
  const startCorrection = async () => {
    await openSeance();
    const capture = fold(/^Capture 1$/);
    fireEvent.click(within(capture).getByRole('button', { name: 'Corriger' }));
    return capture;
  };
  const corrected = (priceStatus: string): FmSeanceDetail => ({
    ...runningDetail,
    totalKamas: 54191,
    sessions: [{
      ...openSession,
      captures: [{
        ...botCapture,
        corrected: true,
        spentKamas: 54191,
        items: [{ ...doAir, quantity: 1, totalKamas: 1587, corrected: true }, gaPa],
        lines: [{ ...doAirLine, quantity: 1, totalKamas: 1587, corrected: true, priceStatus }, gaPaLine],
      }],
    }, closedSession],
  });

  it('sends only the lines that changed, then shows the corrected capture', async () => {
    fm.correctFmCapture.mockResolvedValue(ok(corrected('recorded')));
    const capture = await startCorrection();
    expect(within(capture).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Objet', 'Quantité', 'Total', 'Prix unitaire']);
    expect(within(capture).queryByText(/lu :/)).not.toBeInTheDocument();

    fireEvent.change(within(capture).getByLabelText('Quantité de Rune Do Air'), { target: { value: '1' } });
    fireEvent.change(within(capture).getByLabelText('Total de Rune Do Air'), { target: { value: '1 587' } });
    expect(normalize(capture.textContent)).toContain('lu : 10 pour 15 868 kamas');
    fireEvent.click(within(capture).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(fm.correctFmCapture).toHaveBeenCalledWith('cap1', [{ id: 'l1', quantity: 1, totalKamas: 1587 }]));

    await waitFor(() => expect(within(fold(/^Capture 1$/)).queryByLabelText('Quantité de Rune Do Air')).not.toBeInTheDocument());
    const after = normalize(fold(/^Capture 1$/).textContent);
    expect(after).toContain('corrigée');
    expect(after).toContain('Le récap du bot dans Discord garde le montant lu.');
    expect(after).not.toContain('trop éloigné des relevés');
    expect(normalize(document.querySelector('.fm-detail-stats')!.textContent)).toContain('54 191 kamas');
  });

  it('says when the corrected price is too far from the group\'s to be shared', async () => {
    fm.correctFmCapture.mockResolvedValue(ok(corrected('outlier')));
    const capture = await startCorrection();
    fireEvent.change(within(capture).getByLabelText('Quantité de Rune Do Air'), { target: { value: '1' } });
    fireEvent.click(within(capture).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Dépense corrigée. Le prix n’est pas partagé avec le groupe : il est trop éloigné des relevés.')).toBeInTheDocument();
  });

  it('sends nothing when nothing changed, or when the correction is cancelled', async () => {
    const capture = await startCorrection();
    fireEvent.click(within(capture).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(within(capture).queryByLabelText('Quantité de Rune Do Air')).not.toBeInTheDocument());

    fireEvent.click(within(capture).getByRole('button', { name: 'Corriger' }));
    fireEvent.change(within(capture).getByLabelText('Quantité de Rune Do Air'), { target: { value: '3' } });
    fireEvent.click(within(capture).getByRole('button', { name: 'Annuler' }));
    expect(within(capture).queryByLabelText('Quantité de Rune Do Air')).not.toBeInTheDocument();
    expect(fm.correctFmCapture).not.toHaveBeenCalled();
  });

  it('refuses a quantity or a total below 1, and puts back the value that was read', async () => {
    const capture = await startCorrection();
    const quantity = within(capture).getByLabelText('Quantité de Rune Do Air');
    fireEvent.change(quantity, { target: { value: '0' } });
    expect(within(capture).getByRole('alert')).toHaveTextContent('Une quantité et un total d\'au moins 1 sont attendus sur chaque ligne.');
    expect(within(capture).getByRole('button', { name: 'Enregistrer' })).toBeDisabled();

    fireEvent.click(within(capture).getByRole('button', { name: 'Rétablir la valeur lue de Rune Do Air' }));
    expect(quantity).toHaveValue('10');
    expect(within(capture).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(capture).getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
    expect(within(capture).queryByRole('button', { name: /Rétablir la valeur lue/ })).not.toBeInTheDocument();
  });

  it('keeps the correction open when it could not be saved', async () => {
    fm.correctFmCapture.mockResolvedValue({ status: 'unavailable' });
    const capture = await startCorrection();
    fireEvent.change(within(capture).getByLabelText('Total de Rune Ga Pa'), { target: { value: '50000' } });
    fireEvent.click(within(capture).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(capture).findByRole('alert')).toHaveTextContent('La correction n’a pas pu être enregistrée. Réessaie.');
    expect(within(capture).getByLabelText('Total de Rune Ga Pa')).toHaveValue('50000');
    expect(fm.correctFmCapture).toHaveBeenCalledWith('cap1', [{ id: 'l2', quantity: 1, totalKamas: 50000 }]);
  });
});

describe('Forgemagie page — the players of the group (US4)', () => {
  const players: FmGroupPlayer[] = [
    {
      displayName: 'Cyril', avatarUrl: null, isMe: true, private: true, totalKamas: 69472, seanceCount: 2, lastActivityAt: '2026-09-30T18:30:00.000Z',
      seances: [
        { name: 'fm-cyril-rtograf', state: 'running', fmItem: { name: 'Rtograf PA', imageUrl: null }, totalKamas: 68472, sessionCount: 2, lastActivityAt: '2026-09-30T18:30:00.000Z' },
        { name: 'fm-cyril-coiffe', state: 'archived', fmItem: null, totalKamas: 1000, sessionCount: 1, lastActivityAt: '2026-09-28T19:00:00.000Z' },
      ],
    },
    { displayName: 'Alice', avatarUrl: null, isMe: false, private: false, totalKamas: 0, seanceCount: 0, lastActivityAt: null, seances: [] },
  ];
  const openPlayers = async () => {
    await openSeances();
    fireEvent.click(screen.getByRole('tab', { name: 'Les Forgemages' }));
  };

  it('lists what forgemagie cost each player, the viewer marked and told when private', async () => {
    fm.getFmPlayers.mockResolvedValue(ok(players));
    await openPlayers();
    expect(await screen.findByText(/Ce que la forgemagie a coûté à chaque joueur du groupe\./)).toBeInTheDocument();
    const cards = [...document.querySelectorAll('.fm-player-card')].map((card) => normalize(card.textContent));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain('Cyriltoi');
    expect(cards[0]).toContain('2 séances · dernière activité le');
    expect(cards[0]).toContain('profil privé : visible de toi seul');
    expect(cards[0]).toContain('69 472');
    expect(cards[1]).toContain('Alice');
    expect(cards[1]).toContain('0 séance');
    expect(cards[1]).not.toContain('toi');
    expect(cards[1]).not.toContain('dernière activité');
  });

  it('unfolds the séances of a player who has some — never a player without', async () => {
    fm.getFmPlayers.mockResolvedValue(ok(players));
    await openPlayers();
    const list = await screen.findByRole('list', { name: 'Séances de FM de Cyril', hidden: true });
    const seances = within(list).getAllByRole('listitem', { hidden: true }).map((item) => normalize(item.textContent));
    expect(seances[0]).toContain('Rtograf PA');
    expect(seances[0]).toContain('En cours');
    expect(seances[0]).toContain('#fm-cyril-rtograf · 2 sessions');
    expect(seances[1]).toContain('#fm-cyril-coiffe');
    expect(seances[1]).toContain('Archivée');
    // A séance of the group is not a link to its detail.
    expect(within(list).queryByRole('button', { hidden: true })).not.toBeInTheDocument();
    expect(document.querySelectorAll('details.fm-player-fold')).toHaveLength(1);
    expect(screen.queryByRole('list', { name: 'Séances de FM de Alice', hidden: true })).not.toBeInTheDocument();
  });

  it('says so when nobody did any forgemagie yet, or when the players cannot be read', async () => {
    await openPlayers();
    expect(await screen.findByText('Personne n\'a encore fait de FM')).toBeInTheDocument();

    fm.getFmPlayers.mockResolvedValue({ status: 'unavailable' });
    fireEvent.click(screen.getByRole('tab', { name: 'Profil' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Les Forgemages' }));
    expect(await screen.findByText('Joueurs indisponibles')).toBeInTheDocument();
  });
});

describe('Forgemagie page — profile (US5)', () => {
  const openProfile = async () => {
    await openSeances();
    fireEvent.click(screen.getByRole('tab', { name: 'Profil' }));
    await screen.findByText(/Total dépensé/);
  };

  it('shows the site\'s server, read only, and what the visibility changes', async () => {
    await openProfile();
    const settings = screen.getByRole('region', { name: 'Réglages du profil' });
    expect(within(settings).queryByRole('combobox')).not.toBeInTheDocument();
    expect(settings).toHaveTextContent('Serveur DofusMikhal');
    expect(settings).toHaveTextContent('celui que tu as choisi pour tout le site, en haut de la page.');
    expect(settings).toHaveTextContent('Public : les autres membres voient, dans l’onglet Les Forgemages, ton pseudo, ton total dépensé');
    expect(settings).toHaveTextContent('personne d’autre ne voit tes sessions, tes captures ni tes runes achetées.');
    expect(within(settings).getByRole('button', { name: 'Public' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(settings).getByRole('button', { name: 'Privé' }));
    await waitFor(() => expect(fm.updateFmMe).toHaveBeenCalledWith({ isPrivate: true }));
    await waitFor(() => expect(within(settings).getByRole('button', { name: 'Privé' })).toHaveAttribute('aria-pressed', 'true'));
  });

  it('says when the visibility could not be saved', async () => {
    fm.updateFmMe.mockResolvedValue({ status: 'unavailable' });
    await openProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Privé' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Le réglage n\'a pas pu être enregistré. Réessaie.');
  });

  it('tells the spending by séance, a séance that can be opened being a link to it', async () => {
    await openProfile();
    expect(fm.getFmPlayer).toHaveBeenCalledWith('42');
    const spending = screen.getByRole('region', { name: 'Dépenses de forgemagie' });
    expect(normalize(spending.textContent)).toContain('Total dépensé : 150 500');
    const list = within(spending).getByRole('heading', { name: 'Par séance de FM' }).nextElementSibling as HTMLElement;
    const lines = within(list).getAllByRole('listitem').map((item) => normalize(item.textContent));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^#fm-cyril-rtograf · .*140 000/);
    expect(lines[1]).toMatch(/^#fm-ancien · .*10 000/);
    expect(lines[2]).toMatch(/^Captures importées hors séance500/);
    expect(within(list).queryByRole('button', { name: /#fm-ancien/ })).not.toBeInTheDocument();
    expect(within(spending).getByRole('heading', { name: 'Par objet acheté' })).toBeInTheDocument();
    // The capture import and the lists of items and channels left the profile.
    expect(document.querySelector('.fm-import')).toBeNull();

    fireEvent.click(within(list).getByRole('button', { name: /#fm-cyril-rtograf/ }));
    await screen.findByRole('heading', { name: /#fm-cyril-rtograf/ });
    expect(fm.getFmSeance).toHaveBeenCalledWith('c2');
    expect(screen.getByRole('tab', { name: 'Séances de FM' })).toHaveAttribute('aria-selected', 'true');
  });

  it('says so when nothing was spent yet', async () => {
    fm.getFmPlayer.mockResolvedValue(ok({ player: cyril, totalKamas: 0, importedKamas: 0, items: [], fmItems: [], sessions: [] }));
    await openProfile();
    expect(screen.getByText('Aucune dépense pour l\'instant')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Par séance de FM' })).not.toBeInTheDocument();
  });

  it('deletes the profile only after an explicit confirmation', async () => {
    fm.deleteFmMe.mockResolvedValue(ok(undefined));
    await openProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon profil' }));
    const dialog = screen.getByRole('dialog', { name: 'Supprimer mon profil' });
    expect(dialog).toHaveTextContent('tes séances de FM ne seront plus visibles');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(fm.deleteFmMe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer mon profil' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement' }));
    await screen.findByRole('link', { name: 'Se connecter avec Discord' });
    expect(fm.deleteFmMe).toHaveBeenCalledTimes(1);
    expect(readFmSessionToken()).toBeUndefined();
  });
});
