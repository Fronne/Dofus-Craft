import { act, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { RefreshOutcome } from '../../src/domain/huzounet-load';
import type { CommunityPrice } from '../../src/domain/types';
import type { CommunityPriceLookup, CommunityPricesLookup } from '../../src/services/community-price-api';

// specs/046-hdv-huzounet-load. Real data: Créatures lists 35 pet foods, Consommables 128 items, Runes
// the 105 runes of the Forgemagie data. The real size of a request (90) and the real pause (5.5 s) are
// checked in tests/unit/huzounet-load.test.ts and tests/integration/huzounet-load-hook.test.tsx; here a
// request takes 20 items and the pause 30 ms, so the small Créatures tab loads in two requests (20 + 15).
const getCommunityPrices = vi.fn<(ids: string[], serverId: string) => Promise<CommunityPricesLookup>>();
const refreshExternalPrices = vi.fn<(serverId: string, ids: string[], hdv: { tab: string; last: boolean }) => Promise<RefreshOutcome>>();
const submitCommunityPrice = vi.fn<(id: string, serverId: string, amount: number) => Promise<{ id: string } | undefined>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: async (id: string, serverId: string): Promise<CommunityPriceLookup> => {
    const lookup = await getCommunityPrices([id], serverId);
    if (lookup.status === 'unavailable') return lookup;
    return lookup.prices[0] ? { status: 'found', price: lookup.prices[0] } : { status: 'not-found' };
  },
  getCommunityPrices: (ids: string[], serverId: string) => getCommunityPrices(ids, serverId),
  refreshExternalPrices: (serverId: string, ids: string[], hdv: { tab: string; last: boolean }) => refreshExternalPrices(serverId, ids, hdv),
  getSharedItemPrices: vi.fn().mockResolvedValue({ status: 'found', items: [] }),
  submitCommunityPrice: (id: string, serverId: string, amount: number) => submitCommunityPrice(id, serverId, amount),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getPriceHistory: vi.fn().mockResolvedValue({ status: 'found', points: [] }),
}));

vi.mock('../../src/domain/huzounet-load', async (original) => {
  const real = await original<typeof import('../../src/domain/huzounet-load')>();
  return {
    ...real,
    SLICE_SPACING_MS: 30,
    sliceIds: (ids: string[]) => {
      const accepted = real.loadableIds(ids);
      return Array.from({ length: Math.ceil(accepted.length / 20) }, (_, index) => accepted.slice(index * 20, index * 20 + 20));
    },
  };
});

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
  getServers: vi.fn().mockResolvedValue([
    { id: 'mikhal', name: 'Mikhal', type: 'mono' },
    { id: 'draconiros', name: 'Draconiros', type: 'mono' },
  ]),
}));

import App from '../../src/app/App';
import hdvItems from '../../src/data/hdv-items.json';
import runeItems from '../../src/data/rune-items.json';
import { itemsForHdv, type HdvItemsData } from '../../src/domain/hdv';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';

const CROQUETTE = { id: '20125', name: 'Croquette enrichie' };
const ANIMALS = itemsForHdv(hdvItems as HdvItemsData, 'animals');
const RUNE_IDS = (runeItems as { runes: { id: string }[] }).runes.map((rune) => rune.id);
const OBSERVED_AT = '2026-10-12T02:10:00.000Z';

/** What the API knows: the latest price of each item, as GET /community-prices answers it. */
const known = new Map<string, CommunityPrice>();
const huzounetPrice = (id: string, amount: number, extra: Partial<CommunityPrice> = {}): CommunityPrice => ({
  resourceId: id, serverId: 'mikhal', medianAmountKamas: 0, sampleSize: 0, latestAmountKamas: amount, latestContributionAt: OBSERVED_AT, latestOrigin: 'external', ...extra,
});

async function openHdv(mode: 'community' | 'personal', tab: 'resources' | 'consumables' | 'animals' | 'runes' = 'animals', server = 'Mikhal') {
  window.localStorage.setItem('craftcheck-price-mode-choice', mode);
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.localStorage.setItem('craftcheck-hdv-tab', tab);
  const view = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: server }));
  fireEvent.click(screen.getByRole('link', { name: 'HDV' }));
  await screen.findByRole('heading', { name: 'HDV' });
  await waitFor(() => expect(document.querySelectorAll('li.hdv-row').length).toBeGreaterThan(0));
  return view;
}

const rows = () => [...document.querySelectorAll<HTMLElement>('li.hdv-row')];
const rowOf = (name: string) => rows().find((row) => row.querySelector('.resource-display')?.textContent?.includes(name));
const priceInput = (name: string) => within(rowOf(name)!).getByPlaceholderText('Prix unitaire') as HTMLInputElement;
const count = () => screen.queryByText(/ont un prix|a un prix/)?.textContent;
const loadButton = () => screen.getByRole('button', { name: /^Charger depuis Huzounet/ }) as HTMLButtonElement;
const refreshedIds = () => refreshExternalPrices.mock.calls.map(([, ids]) => ids);
// The Consommables tab renders its 128 lines at once in jsdom: slow when the whole suite runs in parallel.
const SLOW = { timeout: 15_000 };

/** An answer of the API the test gives when it chooses to. */
function pendingRefresh() {
  let answer: (outcome: RefreshOutcome) => void = () => undefined;
  refreshExternalPrices.mockImplementationOnce(() => new Promise((resolve) => {
    answer = resolve;
  }));
  return (outcome: RefreshOutcome) => act(async () => answer(outcome));
}

describe('HDV page — loading a tab from Huzounet (specs/046)', { timeout: 30_000 }, () => {
  // Every wait of this file follows a load of several steps: the default second is too short when the
  // whole suite runs in parallel.
  beforeAll(() => {
    configure({ asyncUtilTimeout: SLOW.timeout });
  });
  afterAll(() => {
    configure({ asyncUtilTimeout: 1000 });
  });

  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    known.clear();
    getCommunityPrices.mockReset();
    getCommunityPrices.mockImplementation(async (ids) => ({ status: 'found', prices: ids.flatMap((id) => known.get(id) ?? []) }));
    refreshExternalPrices.mockReset();
    refreshExternalPrices.mockResolvedValue({ status: 'ok', refreshed: 0 });
    submitCommunityPrice.mockReset();
    submitCommunityPrice.mockResolvedValue({ id: 'c1' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('US1 — load the prices of the tab', () => {
    it('asks for the whole tab request after request, never two at once, showing each as it lands', async () => {
      await openHdv('community');
      expect(loadButton()).toHaveTextContent('Charger depuis Huzounet (35 objets)');
      const first = pendingRefresh();
      const second = pendingRefresh();

      fireEvent.click(loadButton());
      await waitFor(() => expect(refreshExternalPrices).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: 'Arrêter' })).toBeInTheDocument();
      expect(screen.getByText('Chargement : 0 sur 35 objets')).toBeInTheDocument();
      // Never two at once: the second request waits for the answer of the first.
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(refreshExternalPrices).toHaveBeenCalledTimes(1);

      known.set(ANIMALS[0].id, huzounetPrice(ANIMALS[0].id, 4321));
      await first({ status: 'ok', refreshed: 1 });
      await waitFor(() => expect(screen.getByText('Chargement : 20 sur 35 objets')).toBeInTheDocument(), SLOW);
      await waitFor(() => expect(count()).toBe('1 objet sur 35 a un prix'), SLOW);
      await waitFor(() => expect(priceInput(ANIMALS[0].name).value.replace(/\s/g, '')).toBe('4321'), SLOW);

      await waitFor(() => expect(refreshExternalPrices).toHaveBeenCalledTimes(2), SLOW);
      await second({ status: 'ok', refreshed: 0 });
      expect(await screen.findByText('1 prix chargé depuis Huzounet.', undefined, SLOW)).toBeInTheDocument();
      expect(refreshedIds().map((ids) => ids.length)).toEqual([20, 15]);
      expect(refreshedIds().flat()).toEqual(ANIMALS.map((item) => item.id));
      expect(refreshExternalPrices.mock.calls.every(([serverId]) => serverId === 'mikhal')).toBe(true);
      expect(loadButton()).toBeEnabled();
    });

    it('says the prices are up to date when nothing was read, and ignores the filters', async () => {
      await openHdv('community');
      fireEvent.change(screen.getByLabelText('Rechercher un objet'), { target: { value: 'zzzz' } });
      await screen.findByText('Aucun objet ne correspond à votre recherche');
      expect(loadButton()).toBeEnabled();
      expect(loadButton()).toHaveTextContent('(35 objets)');
      fireEvent.click(loadButton());
      expect(await screen.findByText('Les prix sont déjà à jour.', undefined, SLOW)).toBeInTheDocument();
      expect(refreshedIds().flat()).toEqual(ANIMALS.map((item) => item.id));
    });

    it('announces how long a tab takes when one request is not enough', async () => {
      await openHdv('community', 'animals');
      expect(screen.queryByText(/^environ/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'Consommables' }));
      await waitFor(() => expect(loadButton()).toHaveTextContent('Charger depuis Huzounet (128 objets)'), SLOW);
      expect(screen.getByText('environ 10 s')).toBeInTheDocument();
    });

    it('loads the Runes tab with the ids of the runes', async () => {
      await openHdv('community', 'runes');
      expect(loadButton()).toHaveTextContent('(105 objets)');
      // The first request is enough to tell: it is left unanswered, so the 105 lines are not redrawn.
      pendingRefresh();
      fireEvent.click(loadButton());
      await waitFor(() => expect(refreshExternalPrices).toHaveBeenCalledTimes(1), SLOW);
      expect(refreshedIds()[0]).toEqual(RUNE_IDS.slice(0, 20));
      expect(screen.getByText('Chargement : 0 sur 105 objets')).toBeInTheDocument();
    });
  });

  describe('US2 — where a price comes from', () => {
    it('shows a price only Huzounet knows, says so, and counts the item', async () => {
      known.set(CROQUETTE.id, huzounetPrice(CROQUETTE.id, 1500));
      await openHdv('community');
      await waitFor(() => expect(priceInput(CROQUETTE.name).value.replace(/\s/g, '')).toBe('1500'));
      await waitFor(() => expect(within(rowOf(CROQUETTE.name)!).getByText('Huzounet')).toBeInTheDocument());
      await waitFor(() => expect(count()).toBe('1 objet sur 35 a un prix'));
      expect(rows().filter((row) => row.textContent?.includes('Huzounet'))).toHaveLength(1);
    });

    it.each([['provisional', 'Huzounet · peu de relevés'], ['stale', 'Huzounet · relevé ancien']] as const)('adds what Huzounet says of a %s price', async (latestFragile, mention) => {
      known.set(CROQUETTE.id, huzounetPrice(CROQUETTE.id, 1500, { latestFragile }));
      await openHdv('community');
      await waitFor(() => expect(within(rowOf(CROQUETTE.name)!).getByText(mention)).toBeInTheDocument());
    });

    it('says nothing of Huzounet when the group shared a more recent price', async () => {
      known.set(CROQUETTE.id, { resourceId: CROQUETTE.id, serverId: 'mikhal', medianAmountKamas: 1700, sampleSize: 2, latestAmountKamas: 1700, latestContributionAt: '2026-10-12T09:00:00.000Z', latestOrigin: 'manual' });
      await openHdv('community');
      await waitFor(() => expect(priceInput(CROQUETTE.name).value.replace(/\s/g, '')).toBe('1700'));
      expect(rowOf(CROQUETTE.name)?.textContent).not.toContain('Huzounet');
    });

    it('says nothing of Huzounet when the price shown is a more recent one kept on the device', async () => {
      await resourcePricesFor('community').save('mikhal', CROQUETTE.id, 1800, '2026-10-12T10:00:00.000Z');
      known.set(CROQUETTE.id, huzounetPrice(CROQUETTE.id, 1500));
      await openHdv('community');
      await waitFor(() => expect(priceInput(CROQUETTE.name).value.replace(/\s/g, '')).toBe('1800'));
      await waitFor(() => expect(getCommunityPrices).toHaveBeenCalled());
      expect(rowOf(CROQUETTE.name)?.textContent).not.toContain('Huzounet');
    });

    it('lets the player share their own price over a Huzounet one, without an unusual-price confirmation', async () => {
      known.set(CROQUETTE.id, huzounetPrice(CROQUETTE.id, 1500));
      await openHdv('community');
      await waitFor(() => expect(priceInput(CROQUETTE.name).value.replace(/\s/g, '')).toBe('1500'));
      fireEvent.click(within(rowOf(CROQUETTE.name)!).getByRole('button', { name: 'Modifier ce prix' }));
      const input = priceInput(CROQUETTE.name);
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '9000' } });
      fireEvent.blur(input);
      await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalledWith(CROQUETTE.id, 'mikhal', 9000));
      expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
      await waitFor(async () => expect((await resourcePricesFor('community').getMany('mikhal', [CROQUETTE.id]))[CROQUETTE.id]?.unitPriceKamas).toBe(9000));
      await waitFor(() => expect(rowOf(CROQUETTE.name)?.textContent).not.toContain('Huzounet'));
    });
  });

  describe('US3 — stopping, and a load that does not go through', () => {
    it('stops on « Arrêter »: what was loaded stays, and a late answer changes nothing', async () => {
      await openHdv('community');
      const first = pendingRefresh();
      const second = pendingRefresh();
      fireEvent.click(loadButton());
      await waitFor(() => expect(refreshExternalPrices).toHaveBeenCalledTimes(1));
      known.set(ANIMALS[0].id, huzounetPrice(ANIMALS[0].id, 4321));
      await first({ status: 'ok', refreshed: 1 });
      await waitFor(() => expect(screen.getByText('Chargement : 20 sur 35 objets')).toBeInTheDocument(), SLOW);
      fireEvent.click(screen.getByRole('button', { name: 'Arrêter' }));
      expect(await screen.findByText('Chargement arrêté : 1 prix chargé.')).toBeInTheDocument();
      // The request already sent when the player stopped: its answer is not counted.
      await second({ status: 'ok', refreshed: 5 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(screen.getByText('Chargement arrêté : 1 prix chargé.')).toBeInTheDocument();
      expect(refreshExternalPrices.mock.calls.length).toBeLessThanOrEqual(2);
      expect(loadButton()).toBeEnabled();
      await waitFor(() => expect(priceInput(ANIMALS[0].name).value.replace(/\s/g, '')).toBe('4321'), SLOW);
      expect(count()).toBe('1 objet sur 35 a un prix');
    });

    it('stops when the player opens another tab, and says nothing there', async () => {
      await openHdv('community');
      const first = pendingRefresh();
      fireEvent.click(loadButton());
      await waitFor(() => expect(refreshExternalPrices).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole('tab', { name: 'Runes' }));
      await waitFor(() => expect(rows()).toHaveLength(105), SLOW);
      await first({ status: 'ok', refreshed: 5 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(refreshExternalPrices).toHaveBeenCalledTimes(1);
      expect(loadButton()).toHaveTextContent('(105 objets)');
      expect(screen.queryByText(/prix chargé|Chargement/)).not.toBeInTheDocument();
    });

    it.each([
      [{ status: 'unavailable' }, 'Huzounet ne répond pas pour le moment.'],
      [{ status: 'disabled' }, 'Le chargement depuis Huzounet est indisponible.'],
      [{ status: 'unknown-server' }, 'Les prix de ce serveur ne sont pas relus.'],
      [{ status: 'unreachable' }, 'Chargement impossible : l\'API ne répond pas.'],
    ] as const)('stops on %j with its own message, and can be started again', async (outcome, message) => {
      await openHdv('community');
      refreshExternalPrices.mockResolvedValueOnce(outcome);
      fireEvent.click(loadButton());
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(refreshExternalPrices).toHaveBeenCalledTimes(1);
      fireEvent.click(loadButton());
      expect(await screen.findByText('Les prix sont déjà à jour.')).toBeInTheDocument();
      // The new load starts over from the first request: the one that failed, then the second.
      expect(refreshedIds().map((ids) => ids.length)).toEqual([20, 20, 15]);
    });

    it('says so when the tab was loaded less than an hour ago, and when it can be again', async () => {
      await openHdv('community');
      refreshExternalPrices.mockResolvedValueOnce({ status: 'hourly-limit', retryAt: new Date(2026, 9, 12, 15, 5).toISOString() });
      fireEvent.click(loadButton());
      expect(await screen.findByText('Cet onglet a déjà été chargé il y a moins d\'une heure. Prochain chargement possible à 15 h 05.')).toBeInTheDocument();
      expect(refreshExternalPrices).toHaveBeenCalledTimes(1);
      expect(refreshExternalPrices.mock.calls[0][2]).toEqual({ tab: 'animals', last: false });
    });

    it('keeps a value being typed when a request lands', async () => {
      known.set(CROQUETTE.id, huzounetPrice(CROQUETTE.id, 1500));
      await openHdv('community');
      await waitFor(() => expect(priceInput(CROQUETTE.name).value.replace(/\s/g, '')).toBe('1500'));
      fireEvent.click(within(rowOf(CROQUETTE.name)!).getByRole('button', { name: 'Modifier ce prix' }));
      fireEvent.focus(priceInput(CROQUETTE.name));
      fireEvent.change(priceInput(CROQUETTE.name), { target: { value: '77' } });
      known.set(CROQUETTE.id, huzounetPrice(CROQUETTE.id, 1600, { latestContributionAt: '2026-10-12T12:00:00.000Z' }));
      refreshExternalPrices.mockResolvedValueOnce({ status: 'ok', refreshed: 1 });
      fireEvent.click(loadButton());
      expect(await screen.findByText('1 prix chargé depuis Huzounet.')).toBeInTheDocument();
      expect(priceInput(CROQUETTE.name)).toHaveValue('77');
      expect(rowOf(CROQUETTE.name)?.textContent).not.toContain('Huzounet');
    });
  });

  describe('US4 — only where it is of use', () => {
    it('is inactive in Mode personnel, says why, and touches nothing', async () => {
      await resourcePricesFor('personal').save('mikhal', CROQUETTE.id, 900, '2026-09-01T12:00:00.000Z');
      known.set(CROQUETTE.id, huzounetPrice(CROQUETTE.id, 1500));
      await openHdv('personal');
      expect(loadButton()).toBeDisabled();
      expect(screen.getByText('Les prix Huzounet se chargent en Mode communautaire.')).toBeInTheDocument();
      fireEvent.click(loadButton());
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(refreshExternalPrices).not.toHaveBeenCalled();
      expect(getCommunityPrices).not.toHaveBeenCalled();
      expect((await resourcePricesFor('personal').getMany('mikhal', [CROQUETTE.id]))[CROQUETTE.id]).toMatchObject({ unitPriceKamas: 900, updatedAt: '2026-09-01T12:00:00.000Z' });
      expect(rowOf(CROQUETTE.name)?.textContent).not.toContain('Huzounet');
    });

    it('is inactive on a server the API does not read, and says why', async () => {
      await openHdv('community', 'animals', 'Draconiros');
      expect(loadButton()).toBeDisabled();
      expect(screen.getByText('Les prix de ce serveur ne sont pas relus.')).toBeInTheDocument();
      fireEvent.click(loadButton());
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(refreshExternalPrices).not.toHaveBeenCalled();
    });
  });
});
