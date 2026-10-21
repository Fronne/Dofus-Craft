import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// specs/061-simplification-page-brisage. Real rune data: Rune Vi 1523, Rune Cha 1525, Rune Do 7435.
const getItemEffectRanges = vi.fn();
const getItemNegativeRanges = vi.fn();
const getItemDetail = vi.fn();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getCommunityPrices: vi.fn().mockResolvedValue({ status: 'found', prices: [] }),
  getSharedItemPrices: vi.fn().mockResolvedValue({ status: 'found', items: [] }),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
}));

const getSharedCoefficients = vi.fn();
const submitCoefficients = vi.fn();
vi.mock('../../src/services/brisage-coefficient-api', () => ({
  MAX_ITEMS_PER_READ: 96,
  MAX_ENTRIES_PER_SEND: 100,
  getSharedCoefficients: (...args: unknown[]) => getSharedCoefficients(...args),
  submitCoefficients: (...args: unknown[]) => submitCoefficients(...args),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [{ id: '777', name: 'Cape du Chef Bwork', level: 100, kind: 'Equipment', categoryId: 'c' }], total: 1 }),
  getItemDetail: (id: string) => getItemDetail(id),
  getItemEffectRanges: (id: string) => getItemEffectRanges(id),
  getItemNegativeRanges: (id: string) => getItemNegativeRanges(id),
  getResourceRecipe: vi.fn().mockResolvedValue(null),
  getResourceDetails: vi.fn().mockResolvedValue([]),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/brisage-items-repository', () => ({
  loadBrisageItemsIndex: vi.fn().mockResolvedValue({
    source: 'test', sourceUrl: 'https://example.test', retrievedAt: '2026-10-20',
    items: [
      { id: '777', name: 'Cape du Chef Bwork', level: 100, categoryId: 'equipment-type-17', effects: [{ effectId: 125, from: 40, to: 44 }] },
      { id: '888', name: 'Anneau du Sage', level: 60, categoryId: 'equipment-type-9', effects: [{ effectId: 124, from: 10, to: 20 }] },
    ],
  }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import runeItems from '../../src/data/rune-items.json';
import App from '../../src/app/App';
import { getCommunityPrice, submitCommunityPrice } from '../../src/services/community-price-api';
import { pinnedItemPrices } from '../../src/persistence/indexeddb-pinned-item-price-repository';
import { forgetSharedCoefficients } from '../../src/features/brisage/use-shared-coefficients';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const cost = () => document.querySelector('.brisage-cost')?.textContent ?? undefined;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

async function openBrisage(mode = 'personal') {
  window.localStorage.setItem('craftcheck-price-mode-choice', mode);
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.history.pushState({}, '', '/brisage');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  await screen.findByRole('heading', { name: 'Brisage' });
}

/** Opens the page again as a returning visitor: the server is already chosen. */
async function reopenBrisage() {
  render(<App />);
  await screen.findByRole('heading', { name: 'Brisage' });
}

async function pickCape() {
  type('Chercher un objet', 'Cape');
  fireEvent.click(await screen.findByRole('button', { name: /Cape du Chef Bwork/ }));
  await screen.findByLabelText(/^Coefficient/);
  await waitFor(() => expect(screen.queryByText('Lecture des stats…')).not.toBeInTheDocument());
}

async function pricesKnown() {
  const carnet = resourcePricesFor('personal');
  await carnet.save('mikhal', '1523', 5);
  await carnet.save('mikhal', '1525', 5);
  await carnet.save('mikhal', '7435', 3000);
}

describe('Brisage page (specs/061)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    forgetSharedCoefficients();
    getSharedCoefficients.mockReset();
    getSharedCoefficients.mockResolvedValue(new Map());
    submitCoefficients.mockReset();
    submitCoefficients.mockResolvedValue(true);
    getItemEffectRanges.mockReset();
    getItemNegativeRanges.mockReset();
    getItemNegativeRanges.mockResolvedValue([]);
    getItemDetail.mockReset();
    // The cape is crafted from 3 Laine (100 each) and 2 Cuir (250 each): 800 kamas when both are priced.
    getItemDetail.mockResolvedValue({
      recipe: { id: 'r-777', itemId: '777', ingredients: [{ resourceId: 'laine', quantity: 3 }, { resourceId: 'cuir', quantity: 2 }] },
      resources: [{ id: 'laine', name: 'Laine', craftable: false }, { id: 'cuir', name: 'Cuir', craftable: false }],
    });
    // Vi 40–44, Cha fixed 38, Do 1–9 and a line the table does not know.
    getItemEffectRanges.mockResolvedValue([
      { effectId: 125, from: 40, to: 44 }, { effectId: 123, from: 38, to: 38 }, { effectId: 112, from: 1, to: 9 }, { effectId: 999999, from: 2, to: 2 },
    ]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the cost from the price noted on Recherche and offers no level field', async () => {
    await pinnedItemPrices.save('mikhal', '777', 12345);
    await openBrisage();
    await pickCape();
    await waitFor(() => expect(cost()).toMatch(/12\D345/));
    expect(screen.queryByLabelText(/niveau de l'objet/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Prix de l'objet \(kamas\)/)).not.toBeInTheDocument();
    // No Auto button: the cheaper source is lit first, and only the HDV price is known here.
    expect(screen.queryByLabelText('Auto')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Achat')).toBeChecked();
    expect(screen.getByText('Prix noté sur la page Recherche')).toBeInTheDocument();
  });

  it('asks for the price when the item has no recorded price', async () => {
    await openBrisage();
    await pickCape();
    expect(await screen.findByLabelText(/Prix de l'objet \(kamas\)/)).toBeInTheDocument();
  });

  it('treats a recorded price of 0 as no price', async () => {
    await pinnedItemPrices.save('mikhal', '777', 0);
    await openBrisage();
    await pickCape();
    expect(await screen.findByLabelText(/Prix de l'objet \(kamas\)/)).toBeInTheDocument();
  });

  describe('price of the item: HDV or craft (specs/062)', () => {
    const craftPrices = async (only?: string) => {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', 'laine', 100);
      if (only !== 'laine') await carnet.save('mikhal', 'cuir', 250);
    };

    it('switches to the cost of the craft chain and the page follows that price', async () => {
      await pinnedItemPrices.save('mikhal', '777', 12345);
      await craftPrices();
      await openBrisage();
      await pickCape();
      // The cheaper of the two is lit first: the craft (800) beats the HDV (12 345).
      await waitFor(() => expect(cost()).toMatch(/800/));
      expect(screen.getByLabelText('Craft')).toBeChecked();
      fireEvent.click(screen.getByLabelText('Achat'));
      await waitFor(() => expect(cost()).toMatch(/12\D345/));
      fireEvent.click(screen.getByLabelText('Craft'));
      expect(await screen.findByText(/Coût de la chaîne de craft \(mode personnel\)/)).toBeInTheDocument();
      expect(cost()).toMatch(/800/);
      expect(cost()).not.toMatch(/12\D345/);
      fireEvent.click(screen.getByLabelText('Achat'));
      await waitFor(() => expect(cost()).toMatch(/12\D345/));
    });

    it('says the craft price is incomplete, shows no partial total, and uses the typed price', async () => {
      await pinnedItemPrices.save('mikhal', '777', 12345);
      await craftPrices('laine');
      await openBrisage();
      await pickCape();
      fireEvent.click(screen.getByLabelText('Craft'));
      expect(await screen.findByText(/Prix de craft incomplet/)).toBeInTheDocument();
      expect(cost() ?? "").not.toMatch(/300/);
      fireEvent.change(await screen.findByLabelText(/Prix de l'objet \(kamas\)/), { target: { value: '900' } });
      expect(await screen.findByText('Saisi à la main')).toBeInTheDocument();
      // The typed price is kept when switching back and forth.
      fireEvent.click(screen.getByLabelText('Achat'));
      fireEvent.click(screen.getByLabelText('Craft'));
      expect(await screen.findByLabelText(/Prix de l'objet \(kamas\)/)).toHaveValue(900);
    });

    it('says there is no craft for an item without recipe', async () => {
      getItemDetail.mockResolvedValue({ recipe: undefined, resources: [] });
      await openBrisage();
      await pickCape();
      fireEvent.click(screen.getByLabelText('Craft'));
      expect(await screen.findByText(/Aucun craft n'existe pour cet objet/)).toBeInTheDocument();
    });

    it('falls back on the typed price when the craft chain cannot be read', async () => {
      getItemDetail.mockRejectedValue(new Error('offline'));
      await openBrisage();
      await pickCape();
      fireEvent.click(screen.getByLabelText('Craft'));
      expect(await screen.findByText(/Prix de craft incomplet/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Prix de l'objet \(kamas\)/)).toBeInTheDocument();
    });

    it('does not take a zero or negative typed price', async () => {
      await openBrisage();
      await pickCape();
      fireEvent.change(await screen.findByLabelText(/Prix de l'objet \(kamas\)/), { target: { value: '0' } });
      expect(screen.queryByText('Saisi à la main')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Prix de l'objet \(kamas\)/), { target: { value: '-5' } });
      expect(screen.queryByText('Saisi à la main')).not.toBeInTheDocument();
    });

    it('brings back the chosen source after a reload, and an old session on HDV', async () => {
      await craftPrices();
      await openBrisage();
      await pickCape();
      fireEvent.click(screen.getByLabelText('Craft'));
      await screen.findByText(/Coût de la chaîne de craft/);
      cleanup();
      // The server is remembered: the page opens straight on Brisage.
      render(<App />);
      await screen.findByRole('heading', { name: 'Brisage' });
      expect(await screen.findByLabelText('Craft')).toBeChecked();
    });

    it('brings back a session saved before the price source existed on HDV', async () => {
      await pinnedItemPrices.save('mikhal', '777', 12345);
      window.localStorage.setItem('craftcheck-brisage-session', JSON.stringify({
        serverId: 'mikhal', item: { id: '777', name: 'Cape du Chef Bwork', level: 100 }, rolls: {}, coefficientText: '', manualCost: '',
      }));
      await openBrisage();
      expect(await screen.findByLabelText('Achat')).toBeChecked();
    });
  });

  describe('without a known coefficient (specs/063)', () => {
    it('shows the table, the best focus line and the break-even coefficient, but no verdict', async () => {
      await pinnedItemPrices.save('mikhal', '777', 1000);
      await pricesKnown();
      await openBrisage();
      await pickCape();
      expect(await screen.findByLabelText(/Coefficient de brisage/)).toBeInTheDocument();
      expect(await screen.findByText('Conseil')).toBeInTheDocument();
      expect(await screen.findByText('Focus Do')).toBeInTheDocument();
      expect(screen.getByText(/Le focus rapporte plus que le brisage normal\./)).toBeInTheDocument();
      // DoFocus focus model: with the price of the item known, the coefficient under which breaking stops paying.
      expect(screen.getByText(/Rentable tant que le coefficient reste au-dessus de/).nextElementSibling).toHaveTextContent('%');
      expect(screen.getByText('Meilleur focus').closest('tr')).toHaveTextContent('Dommages');
      expect(screen.getByText('Sans focus')).toBeInTheDocument();
      expect(screen.queryByText('Verdict')).not.toBeInTheDocument();
      expect(screen.queryByText('Gain selon le coefficient')).not.toBeInTheDocument();
    });

    it('keeps the advice when the price of the item is unknown and shows the value of the runes', async () => {
      await pricesKnown();
      await openBrisage();
      await pickCape();
      expect(await screen.findByText('Focus Do')).toBeInTheDocument();
      expect(screen.queryByText(/Rentable tant que le coefficient/)).not.toBeInTheDocument();
      expect(screen.getAllByText('Valeur des runes')).toHaveLength(2);
    });

    it('gives no advice while a rune has no price', async () => {
      await pinnedItemPrices.save('mikhal', '777', 1000);
      await openBrisage();
      await pickCape();
      expect(await screen.findByText('Prix manquants')).toBeInTheDocument();
      expect(screen.queryByText('Meilleur focus')).not.toBeInTheDocument();
    });

    it('goes back to the full result once the coefficient is given, and back again when it is cleared', async () => {
      await pinnedItemPrices.save('mikhal', '777', 1000);
      await pricesKnown();
      await openBrisage();
      await pickCape();
      const input = await screen.findByLabelText(/Coefficient de brisage/);
      fireEvent.change(input, { target: { value: '50' } });
      expect(await screen.findByText('Verdict')).toBeInTheDocument();
      expect(screen.queryByText('Conseil')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Coefficient/), { target: { value: '' } });
      expect(await screen.findByText('Conseil')).toBeInTheDocument();
    });
  });

  it('shows the verdict, the item count, the minimal coefficient and the focus rune', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    expect(await screen.findByText('Rentable avec un focus Do')).toBeInTheDocument();
    expect(screen.getByText("Sans focus, rentable jusqu'à").nextElementSibling).toHaveTextContent('%');
    expect(screen.getByText('Brisages possibles avant ce seuil').nextElementSibling).toHaveTextContent(/^\d+$/);
    // The best focus is highlighted on its line, with the rune icon and the kamas icon of the site.
    const best = screen.getByText('Meilleur focus').closest('tr')!;
    expect(best).toHaveTextContent('Dommages');
    expect(best.querySelector('img[src*="78015"]')).not.toBeNull();
    expect(document.querySelector('img.kamas-amount-icon')).not.toBeNull();
  });

  it('shows the value of the runes apart from the total with the item price deducted', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    const runes = (await screen.findByText('Total des runes')).closest('tr')!;
    const deducted = screen.getByText("Total de l'objet, prix déduit").closest('tr')!;
    // the prices load after the table appears
    await waitFor(() => expect(runes.querySelector('td[data-label="Meilleur focus : total des runes"]')).not.toHaveTextContent('—'));
    const amount = (row: HTMLElement, label: string) => Number((row.querySelector(`td[data-label="${label}"]`)!.textContent ?? '').replace(/[^\d-]/g, ''));
    // the gain is the value of the runes minus the 1 000 k of the item, for both columns
    expect(amount(runes, 'Sans focus : total des runes') - 1000).toBe(amount(deducted, 'Sans focus : total'));
    expect(amount(runes, 'Meilleur focus : total des runes') - 1000).toBe(amount(deducted, 'Meilleur focus : total'));
  });

  it('shows a dash instead of a total of the runes while a rune has no price', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    const runes = (await screen.findByText('Total des runes')).closest('tr')!;
    expect(runes.querySelector('td[data-label="Sans focus : total des runes"]')).toHaveTextContent('—');
  });

  it('keeps a single "Total des runes" line when neither the coefficient nor the item price is known', async () => {
    await pricesKnown();
    await openBrisage();
    await pickCape();
    await screen.findByText('Conseil');
    expect(screen.getAllByText('Total des runes')).toHaveLength(1);
  });

  it('no longer shows a separate estimated value of the runes (the totals row has it)', async () => {
    await pricesKnown();
    await openBrisage();
    await pickCape();
    await screen.findByText('Conseil');
    expect(screen.queryByText('Valeur estimée des runes')).not.toBeInTheDocument();
  });

  it('shows whole numbers of runes only, and the next breaks at whole coefficients that can repeat', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '66' } });
    await screen.findByText('Verdict');
    const rows = document.querySelectorAll('.brisage-table tbody tr');
    for (const row of rows) {
      for (const label of ['Sans focus : runes', 'Focus : runes']) {
        const cell = row.querySelector(`td[data-label="${label}"]`)!;
        expect(cell.textContent).toMatch(/^(—|\d+)$/);
      }
    }
    // The loss at 66 % is about 0.11 point per break: the three next breaks all still show 66 % (rounded).
    const labels = (await screen.findAllByText(/^à \d+ %$/)).map((el) => el.textContent);
    expect(labels).toEqual(['à 66 %', 'à 66 %', 'à 66 %']);
  });

  it('says to break normally, with no highlighted line, when no focus pays more', async () => {
    await pinnedItemPrices.save('mikhal', '777', 10);
    await pricesKnown();
    // Runes priced the same per point of weight (Do weighs 20): a focus only loses the other lines' half.
    await resourcePricesFor('personal').save('mikhal', '7435', 100);
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '100' } });
    expect(await screen.findByText('Rentable sans focus')).toBeInTheDocument();
    expect(screen.getByText(/Le focus ne rapporte pas plus/)).toBeInTheDocument();
    expect(screen.queryByText('Meilleur focus')).not.toBeInTheDocument();
    // The gain block only shows the next three breaks.
    expect(screen.queryByText('Coefficient actuel')).not.toBeInTheDocument();
    expect(screen.getAllByText(/^à [\d,]+ %$/)).toHaveLength(3);
  });

  it('accepts a coefficient above 100 %', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    const input = await screen.findByLabelText(/Coefficient de brisage/);
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);
    expect(await screen.findByText(/Dernier coefficient/)).toHaveTextContent('150 %');
    expect(await screen.findByText(/Rentable/)).toBeInTheDocument();
    expect(screen.queryByText('Coefficient actuel')).not.toBeInTheDocument();
  });

  it.each([
    ['green when the item pays', 1000, 'brisage-total-gain'],
    ['red when the item loses', 1000000000, 'brisage-total-loss'],
  ])('colours the totals %s', async (_label, price, tone) => {
    await pinnedItemPrices.save('mikhal', '777', price);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '150' } });
    const cell = (await screen.findByText("Total de l'objet, prix déduit")).closest('tr')!.querySelector('[data-label="Sans focus : total"]')!;
    await waitFor(() => expect(cell).toHaveClass(tone));
  });

  it('brings back the item, the typed coefficient and the typed rolls after a reload', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '60' } });
    await screen.findByLabelText('Jet de Vitalité');
    type('Jet de Vitalité', '44');
    cleanup();
    // The server is remembered: the page opens straight on Brisage.
    render(<App />);
    await screen.findByRole('heading', { name: 'Brisage' });
    expect(await screen.findByRole('heading', { name: 'Cape du Chef Bwork' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Jet de Vitalité')).toHaveValue(44);
    expect((screen.getByLabelText(/Coefficient/) as HTMLInputElement).value).toBe('60');
    expect(screen.getByText('modifié')).toBeInTheDocument();
  });

  it('shows a stat that appears twice on the item as one line', async () => {
    getItemEffectRanges.mockResolvedValue([
      { effectId: 125, from: 20, to: 22 }, { effectId: 125, from: 20, to: 22 }, { effectId: 123, from: 38, to: 38 },
    ]);
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    expect(await screen.findAllByLabelText('Jet de Vitalité')).toHaveLength(1);
    expect(field('Jet de Vitalité').placeholder).toBe('42');
  });

  it('flags a negative roll and keeps the average', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    await screen.findByLabelText('Jet de Vitalité');
    type('Jet de Vitalité', '-3');
    expect(field('Jet de Vitalité')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/jet invalide/)).toBeInTheDocument();
  });

  it('remembers the coefficient with its date for the next time', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    const input = await screen.findByLabelText(/Coefficient de brisage/);
    fireEvent.change(input, { target: { value: '38' } });
    fireEvent.blur(input);
    expect(await screen.findByText(/Dernier coefficient/)).toHaveTextContent('38 %');
    expect(JSON.parse(window.localStorage.getItem('craftcheck-brisage-coefficients')!)['mikhal:777'].coefficient).toBe(38);
    expect(await screen.findByText(/Rentable/)).toBeInTheDocument();
  });

  it('starts from a stored coefficient', async () => {
    window.localStorage.setItem('craftcheck-brisage-coefficients', JSON.stringify({ 'mikhal:777': { coefficient: 44, savedAt: '2026-10-12T10:00:00.000Z' } }));
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    expect(await screen.findByText(/Dernier coefficient/)).toHaveTextContent('44 %');
    expect(screen.getByText(/Dernier coefficient/)).toHaveTextContent('12/10/2026');
    expect(await screen.findByText(/Rentable/)).toBeInTheDocument();
  });

  // specs/069-coefficients-brisage-partages
  describe('shared coefficients (specs/069)', () => {
    const LOCAL = 'craftcheck-brisage-coefficients';
    // Notes are refused by the server (and not imported) when dated in the future: stay behind the real clock.
    const RECENT = new Date(Date.now() - 60_000).toISOString();

    it('shows the coefficient noted by another player, with its date', async () => {
      getSharedCoefficients.mockResolvedValue(new Map([['777', { coefficient: 52, savedAt: '2026-10-22T09:00:00.000Z' }]]));
      await pinnedItemPrices.save('mikhal', '777', 1000);
      await pricesKnown();
      await openBrisage();
      await pickCape();
      expect(await screen.findByText(/Dernier coefficient/)).toHaveTextContent('52 %');
      expect(screen.getByText(/Dernier coefficient/)).toHaveTextContent('22/10/2026');
      expect(getSharedCoefficients).toHaveBeenCalledWith('mikhal', expect.arrayContaining(['777']));
    });

    it('shows the more recent of the shared and the local coefficient', async () => {
      window.localStorage.setItem(LOCAL, JSON.stringify({ 'mikhal:777': { coefficient: 44, savedAt: '2026-10-23T10:00:00.000Z' } }));
      getSharedCoefficients.mockResolvedValue(new Map([['777', { coefficient: 52, savedAt: '2026-10-22T09:00:00.000Z' }]]));
      await openBrisage();
      await pickCape();
      expect(await screen.findByText(/Dernier coefficient/)).toHaveTextContent('44 %');
    });

    it('sends the coefficient it remembers, and keeps it on the device', async () => {
      await openBrisage();
      await pickCape();
      const input = await screen.findByLabelText(/Coefficient de brisage/);
      fireEvent.change(input, { target: { value: '38' } });
      fireEvent.blur(input);
      await screen.findByText(/Dernier coefficient/);
      expect(submitCoefficients).toHaveBeenCalledWith([{ serverId: 'mikhal', itemId: '777', coefficient: 38, savedAt: expect.any(String) }]);
      expect(JSON.parse(window.localStorage.getItem(LOCAL)!)['mikhal:777'].coefficient).toBe(38);
    });

    it('falls back on the local coefficient when the server does not answer', async () => {
      window.localStorage.setItem(LOCAL, JSON.stringify({ 'mikhal:777': { coefficient: 44, savedAt: RECENT } }));
      getSharedCoefficients.mockResolvedValue(undefined);
      submitCoefficients.mockResolvedValue(false);
      await openBrisage();
      await pickCape();
      expect(await screen.findByText(/Dernier coefficient/)).toHaveTextContent('44 %');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('imports the coefficients of the device once, with their date, and not those before the limit', async () => {
      window.localStorage.setItem(LOCAL, JSON.stringify({
        'mikhal:777': { coefficient: 44, savedAt: RECENT },
        'mikhal:888': { coefficient: 20, savedAt: '2026-10-12T10:00:00.000Z' },
      }));
      await openBrisage();
      await waitFor(() => expect(submitCoefficients).toHaveBeenCalledTimes(1));
      expect(submitCoefficients).toHaveBeenCalledWith([{ serverId: 'mikhal', itemId: '777', coefficient: 44, savedAt: RECENT }]);
      await waitFor(() => expect(window.localStorage.getItem('craftcheck-brisage-coefficients-imported')).toBe('1'));
      cleanup();
      await reopenBrisage();
      expect(submitCoefficients).toHaveBeenCalledTimes(1);
    });

    it('tries the import again at the next visit when the server did not answer', async () => {
      window.localStorage.setItem(LOCAL, JSON.stringify({ 'mikhal:777': { coefficient: 44, savedAt: RECENT } }));
      submitCoefficients.mockResolvedValue(false);
      await openBrisage();
      await waitFor(() => expect(submitCoefficients).toHaveBeenCalledTimes(1));
      expect(window.localStorage.getItem('craftcheck-brisage-coefficients-imported')).toBeNull();
      cleanup();
      submitCoefficients.mockResolvedValue(true);
      await reopenBrisage();
      await waitFor(() => expect(submitCoefficients).toHaveBeenCalledTimes(2));
    });
  });

  it('starts each line at its average roll and lets a roll be typed', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    await screen.findByLabelText('Jet de Vitalité');
    expect(field('Jet de Vitalité').placeholder).toBe('42');
    expect(field('Jet de Dommages').placeholder).toBe('5');
    expect(screen.getAllByText('moyen')).toHaveLength(2);
    type('Jet de Vitalité', '44');
    expect(screen.getByText('modifié')).toBeInTheDocument();
    type('Jet de Vitalité', '');
    expect(screen.queryByText('modifié')).not.toBeInTheDocument();
  });

  it('sets every free line to its minimum or maximum with the Jet column switch, and shows both bounds', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    await screen.findByLabelText('Jet de Vitalité');
    // Vitalité 40–44 and Dommages 1–9 are free; Chance (38) is fixed: a field, but the switch skips it.
    expect(field('Jet de Chance').placeholder).toBe('38');
    type('Jet de Chance', '45');
    expect(screen.getByText('over')).toBeInTheDocument();
    type('Jet de Chance', '');
    type('Jet de Vitalité', '60');
    expect(screen.getByText('over')).toBeInTheDocument();
    type('Jet de Vitalité', '');
    expect(screen.getByRole('button', { name: 'Moyen' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Min' }));
    expect(field('Jet de Vitalité').value).toBe('40');
    expect(field('Jet de Dommages').value).toBe('1');
    expect(screen.getByRole('button', { name: 'Min' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    expect(field('Jet de Vitalité').value).toBe('44');
    expect(field('Jet de Dommages').value).toBe('9');
    fireEvent.click(screen.getByRole('button', { name: 'Moyen' }));
    expect(field('Jet de Vitalité').value).toBe('');
    type('Jet de Vitalité', '41');
    expect(screen.getByRole('button', { name: 'Moyen' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the runes without a price instead of inventing one', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    expect(await screen.findByText('Verdict')).toBeInTheDocument();
    expect(screen.queryByText(/Prix manquant pour/)).not.toBeInTheDocument();
    expect(screen.getByText('Verdict').parentElement).toHaveTextContent('Prix manquants');
  });

  it('says it is not profitable when the cost is far above the runes', async () => {
    await pinnedItemPrices.save('mikhal', '777', 99999999);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    expect(await screen.findByText('Pas rentable')).toBeInTheDocument();
  });

  describe('simplified layout (specs/065)', () => {
    it('opens on the search and invites to choose an item, with no sliders in the table', async () => {
      await openBrisage();
      expect(screen.getByLabelText('Chercher un objet')).toBeInTheDocument();
      expect(screen.getByText(/Choisissez un objet ci-dessus/)).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      await pickCape();
      expect(screen.queryByText(/Choisissez un objet ci-dessus/)).not.toBeInTheDocument();
      expect(document.querySelectorAll('.brisage-table input[type="range"]')).toHaveLength(0);
      expect(screen.getByRole('heading', { name: 'Cape du Chef Bwork' })).toBeInTheDocument();
    });

    it('shows the cards of the index and filters them by name', async () => {
      await openBrisage();
      expect(await screen.findByRole('button', { name: /Anneau du Sage/ })).toBeInTheDocument();
      type('Chercher un objet', 'anneau');
      await waitFor(() => expect(screen.queryByRole('button', { name: /Cape du Chef Bwork/ })).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: /Anneau du Sage/ })).toHaveTextContent('Coef. à saisir');
    });

    it('offers a custom price that starts from the kept price, is used by the page and survives a reload', async () => {
      await pinnedItemPrices.save('mikhal', '777', 12345);
      await openBrisage();
      await pickCape();
      fireEvent.click(await screen.findByLabelText('Perso'));
      const input = await screen.findByLabelText(/Prix de l'objet \(kamas\)/);
      expect(input).toHaveValue(12345);
      fireEvent.change(input, { target: { value: '5000' } });
      expect(await screen.findByText('Prix personnalisé')).toBeInTheDocument();
      expect(screen.queryByText('Saisis le prix à utiliser.')).not.toBeInTheDocument();
      await waitFor(() => expect(JSON.parse(window.localStorage.getItem('craftcheck-brisage-session')!).priceSource).toBe('custom'));
      cleanup();
      render(<App />);
      await screen.findByRole('heading', { name: 'Brisage' });
      expect(await screen.findByLabelText('Perso')).toBeChecked();
      expect(await screen.findByLabelText(/Prix de l'objet \(kamas\)/)).toHaveValue(5000);
    });
  });

  describe('exos and overs (specs/066)', () => {
    const total = () => document.querySelector('tfoot td[data-label="Sans focus : total"]')?.textContent ?? '';
    const exoRows = () => [...document.querySelectorAll('tr.brisage-line--exo')];
    const openPicker = (row?: Element) => fireEvent.click(
      row ? row.querySelector('.brisage-exo-pick') as HTMLElement : screen.getByRole('button', { name: "Choisir la rune de l'exo" }),
    );
    /** "+ Exo", then the rune in the list, then the value. */
    const addExo = (runeOption: string, label: string, value: string) => {
      fireEvent.click(screen.getByRole('button', { name: '+ Exo' }));
      openPicker();
      fireEvent.click(screen.getByRole('button', { name: runeOption }));
      fireEvent.change(screen.getByLabelText(`Valeur de l'exo ${label}`), { target: { value } });
    };
    const ready = async () => {
      await pinnedItemPrices.save('mikhal', '777', 1000);
      await pricesKnown();
      await resourcePricesFor('personal').save('mikhal', '1519', 10);
      await resourcePricesFor('personal').save('mikhal', '1557', 9000);
      await openBrisage();
      await pickCape();
      fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
      await screen.findByText('Verdict');
      await waitFor(() => expect(total()).not.toBe('—'));
    };

    it('adds a line with the "+ Exo" button, then the rune is picked in a list with the icons', async () => {
      await ready();
      const before = total();
      fireEvent.click(screen.getByRole('button', { name: '+ Exo' }));
      expect(exoRows()).toHaveLength(1);
      expect(exoRows()[0].closest('tbody')!.firstElementChild).toBe(exoRows()[0]);
      expect(exoRows()[0]).toHaveTextContent('Choisir une rune');
      expect(screen.getByRole('button', { name: '+ Exo' })).toBeDisabled();
      expect(total()).toBe(before);
      openPicker();
      const options = within(screen.getByRole('list', { name: "Runes disponibles pour l'exo" })).getAllByRole('button');
      expect(options.length).toBeGreaterThan(10);
      expect(options.every((option) => option.querySelector('img, .result-image-fallback'))).toBe(true);
      // Vitalité is a line of the item, not an exo: its rune is not offered.
      expect(screen.queryByRole('button', { name: /^Rune Vi / })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Rune Fo Force' }));
      expect(screen.queryByRole('list', { name: "Runes disponibles pour l'exo" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Valeur de l'exo Force")).toHaveValue(1);
      expect(screen.getByRole('button', { name: '+ Exo' })).toBeEnabled();
    });

    it('counts the exo in the total, in blue, without a focus, and removes it', async () => {
      await ready();
      const before = total();
      addExo('Rune Fo Force', 'Force', '5');
      const row = exoRows()[0];
      expect(row).toHaveTextContent('Exo');
      expect(row.querySelector('[data-label="Focus : runes"]')).toHaveTextContent('—');
      expect(row).not.toHaveTextContent('Meilleur focus');
      await waitFor(() => expect(total()).not.toBe('—'));
      expect(total()).not.toBe(before);
      fireEvent.click(screen.getByRole('button', { name: "Retirer l'exo Force" }));
      await waitFor(() => expect(exoRows()).toHaveLength(0));
      await waitFor(() => expect(total()).toBe(before));
    });

    it('searches the runes of the list by name or stat, ignoring case and accents, and picks the first with Enter', async () => {
      await ready();
      fireEvent.click(screen.getByRole('button', { name: '+ Exo' }));
      openPicker();
      const search = screen.getByLabelText('Rechercher une rune');
      expect(search).toHaveFocus();
      const list = () => within(screen.getByRole('list', { name: "Runes disponibles pour l'exo" }));
      const all = list().getAllByRole('button').length;
      fireEvent.change(search, { target: { value: 'FORCE' } });
      expect(list().getAllByRole('button')).toHaveLength(1);
      expect(list().getByRole('button', { name: 'Rune Fo Force' })).toBeInTheDocument();
      fireEvent.change(search, { target: { value: 'crit' } });
      expect(list().getAllByRole('button').length).toBeGreaterThan(0);
      expect(list().getAllByRole('button').length).toBeLessThan(all);
      fireEvent.change(search, { target: { value: 'zzz' } });
      expect(screen.getByText('Aucune rune ne correspond.')).toBeInTheDocument();
      fireEvent.change(search, { target: { value: 'force' } });
      fireEvent.keyDown(search, { key: 'Enter' });
      expect(screen.getByLabelText("Valeur de l'exo Force")).toHaveValue(1);
    });

    it('puts the last exo first and offers a rune only once', async () => {
      await ready();
      addExo('Rune Fo Force', 'Force', '5');
      addExo('Rune Ga Pa PA', 'PA', '1');
      expect(exoRows()).toHaveLength(2);
      expect(exoRows()[0]).toHaveTextContent('Rune Ga Pa');
      expect(exoRows()[1]).toHaveTextContent('Rune Fo');
      openPicker(exoRows()[0]);
      expect(screen.queryByRole('button', { name: 'Rune Fo Force' })).not.toBeInTheDocument();
    });

    it('refuses a value above the weight limit, zero or a decimal, and shows the maximum', async () => {
      await ready();
      addExo('Rune Fo Force', 'Force', '5');
      const input = screen.getByLabelText("Valeur de l'exo Force");
      expect(screen.getByTitle('Poids maximal 101')).toHaveTextContent('101');
      for (const bad of ['150', '0', '2.5', '']) {
        fireEvent.change(input, { target: { value: bad } });
        expect(input).toHaveAttribute('aria-invalid', 'true');
      }
      fireEvent.change(input, { target: { value: '101' } });
      expect(input).not.toHaveAttribute('aria-invalid');
      addExo('Rune Ga Pa PA', 'PA', '2');
      expect(screen.getByLabelText("Valeur de l'exo PA")).toHaveAttribute('aria-invalid', 'true');
      fireEvent.change(screen.getByLabelText("Valeur de l'exo PA"), { target: { value: '1' } });
      expect(screen.getByLabelText("Valeur de l'exo PA")).not.toHaveAttribute('aria-invalid');
    });

    it('keeps the exos of each item after a reload', async () => {
      await ready();
      addExo('Rune Fo Force', 'Force', '5');
      await waitFor(() => expect(JSON.parse(window.localStorage.getItem('craftcheck-brisage-exos')!)['mikhal:777']).toEqual([{ effectId: 118, value: 5 }]));
      cleanup();
      render(<App />);
      await screen.findByRole('heading', { name: 'Brisage' });
      await waitFor(() => expect(exoRows()).toHaveLength(1));
      expect(exoRows()[0]).toHaveTextContent('Exo');
      expect(await screen.findByLabelText("Valeur de l'exo Force")).toHaveValue(5);
    });

    it('accepts a roll above the maximum of a line as an over, and refuses it above the weight limit', async () => {
      await ready();
      // Do (weight 20) goes from 1 to 9 on this item: 10 weighs 200, above 101, and is refused.
      type('Jet de Dommages', '10');
      expect(field('Jet de Dommages')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(/jet maximal 9 : moyen utilisé/)).toBeInTheDocument();
      // Vi (weight 0.2) goes up to 44: 60 weighs 12 and is an over.
      type('Jet de Vitalité', '60');
      expect(field('Jet de Vitalité')).not.toHaveAttribute('aria-invalid');
      expect(screen.getByText('over')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Max' }));
      expect(field('Jet de Vitalité')).toHaveValue(44);
      expect(screen.queryByText('over')).not.toBeInTheDocument();
    });

    it('does not refuse a natural roll above the weight limit', async () => {
      getItemEffectRanges.mockResolvedValue([{ effectId: 124, from: 40, to: 60 }, { effectId: 125, from: 40, to: 44 }]);
      await openBrisage();
      await pickCape();
      await screen.findByLabelText('Jet de Sagesse');
      type('Jet de Sagesse', '60');
      expect(field('Jet de Sagesse')).not.toHaveAttribute('aria-invalid');
    });
  });

  // specs/067-brisage-lignes-negatives: a malus is shown in red, gives no rune and has no focus; its roll stays negative.
  describe('negative lines (specs/067)', () => {
    const FORCE_MALUS = { effectId: 118, from: -15, to: -10 };
    const openWithMalus = async (negatives: unknown[] = [FORCE_MALUS], mode = 'personal') => {
      getItemNegativeRanges.mockResolvedValue(negatives);
      await pinnedItemPrices.save('mikhal', '777', 1000);
      await pricesKnown();
      await openBrisage(mode);
      await pickCape();
      fireEvent.change(await screen.findByLabelText(/Coefficient de brisage/), { target: { value: '50' } });
    };

    it('shows a malus in red with its signed roll, no rune and no focus', async () => {
      await openWithMalus();
      const roll = await screen.findByLabelText('Jet de Force (malus)');
      expect((roll as HTMLInputElement).placeholder).toBe('-13');
      const row = roll.closest('tr')!;
      expect(row).toHaveClass('brisage-negative');
      expect(within(row).getByText('Malus')).toBeInTheDocument();
      expect(within(row).queryByText('aucune rune')).not.toBeInTheDocument();
      expect(within(row).queryByText('Meilleur focus')).not.toBeInTheDocument();
      expect(row.querySelectorAll('td[data-label^="Focus"]')).toHaveLength(2);
      row.querySelectorAll('td[data-label^="Focus"], td[data-label^="Sans focus"]').forEach((cell) => expect(cell).toHaveTextContent('—'));
    });

    // Histoire 4: forgemagie turned the malus positive; the line then counts like an exo.
    const SAGESSE_MALUS = { effectId: 124, from: -30, to: -30 };
    const saRuneId = (runeItems as { runes: { id: string; name: string; effectId: number }[] }).runes.find((rune) => rune.effectId === 124 && rune.name === 'Rune Sa')!.id;
    const priceCell = (label: string) => field(label).closest('tr')!.querySelector('[data-label="Prix de la rune"]')!;
    const total = () => document.querySelector('tfoot td[data-label="Sans focus : total"]')?.textContent ?? '';

    it('shows the price of the rune on every malus, and says when it is missing', async () => {
      await resourcePricesFor('personal').save('mikhal', saRuneId, 10);
      await openWithMalus([FORCE_MALUS, SAGESSE_MALUS]);
      await screen.findByLabelText('Jet de Sagesse (malus)');
      await waitFor(() => expect(priceCell('Jet de Sagesse (malus)')).not.toHaveTextContent('prix manquant'));
      expect(priceCell('Jet de Force (malus)')).toHaveTextContent('prix manquant');
    });

    it('counts a malus turned positive like an exo: runes, no focus, back to a malus when the roll is negative again', async () => {
      await pricesKnown();
      await resourcePricesFor('personal').save('mikhal', saRuneId, 10);
      await openWithMalus([SAGESSE_MALUS]);
      await screen.findByLabelText('Jet de Sagesse (malus)');
      await waitFor(() => expect(total()).toMatch(/[0-9]/));
      const before = total();
      type('Jet de Sagesse (malus)', '10');
      const row = field('Jet de Sagesse (malus)').closest('tr')!;
      await waitFor(() => expect(row).toHaveClass('brisage-line--exo'));
      expect(within(row).getByText('Malus corrigé')).toBeInTheDocument();
      expect(row.querySelector('[data-label="Sans focus : runes"]')).not.toHaveTextContent('—');
      expect(row.querySelector('[data-label="Focus : runes"]')).toHaveTextContent('—');
      await waitFor(() => expect(total()).not.toBe(before));
      type('Jet de Sagesse (malus)', '-30');
      await waitFor(() => expect(row).toHaveClass('brisage-negative'));
      await waitFor(() => expect(total()).toBe(before));
    });

    // Histoire 5: the unit price of a rune is typed in the table.
    it('saves a price typed in the table in the carnet and recomputes the total', async () => {
      await pricesKnown();
      await resourcePricesFor('personal').save('mikhal', saRuneId, 10);
      await openWithMalus([SAGESSE_MALUS]);
      await screen.findByLabelText('Jet de Sagesse (malus)');
      type('Jet de Sagesse (malus)', '10');
      await waitFor(() => expect(field('Jet de Sagesse (malus)').closest('tr')).toHaveClass('brisage-line--exo'));
      await waitFor(() => expect(total()).not.toBe(''));
      const before = total();
      const input = screen.getByLabelText('Prix de Rune Sa');
      fireEvent.change(input, { target: { value: '5000' } });
      fireEvent.blur(input);
      await waitFor(() => expect(total()).not.toBe(before));
      expect(screen.getByLabelText('Prix de Rune Sa')).toHaveValue('5 000');
      expect((await resourcePricesFor('personal').get('mikhal', saRuneId))?.unitPriceKamas).toBe(5000);
      expect(submitCommunityPrice).not.toHaveBeenCalled();
    });

    describe('in Mode communautaire', () => {
      const median = (amount: number) => vi.mocked(getCommunityPrice).mockResolvedValue({
        status: 'found',
        price: { resourceId: saRuneId, serverId: 'mikhal', medianAmountKamas: amount, sampleSize: 3, latestAmountKamas: amount, latestContributionAt: '2026-10-01T12:00:00.000Z' },
      });
      const typePrice = async (value: string) => {
        fireEvent.change(await screen.findByLabelText("Prix de l'objet (kamas)"), { target: { value: '1000' } });
        await screen.findByLabelText('Jet de Sagesse (malus)');
        const input = await screen.findByLabelText('Prix de Rune Sa');
        fireEvent.change(input, { target: { value } });
        fireEvent.blur(input);
      };
      beforeEach(async () => {
        vi.mocked(submitCommunityPrice).mockClear();
        // The community carnet starts empty: give the runes of the cape a price so the table shows.
        const carnet = resourcePricesFor('community');
        await carnet.save('mikhal', '1523', 5);
        await carnet.save('mikhal', '1525', 5);
        await carnet.save('mikhal', '7435', 3000);
        await carnet.save('mikhal', saRuneId, 10);
      });
      afterEach(() => { vi.mocked(getCommunityPrice).mockResolvedValue({ status: 'not-found' }); });

      it('shares a price close to the median without asking', async () => {
        median(5000);
        await openWithMalus([SAGESSE_MALUS], 'community');
        await typePrice('5100');
        await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalledWith(saRuneId, 'mikhal', 5100));
        expect(screen.queryByRole('button', { name: 'Enregistrer quand même' })).not.toBeInTheDocument();
      });

      it('asks before sharing a price far from the median, and shares nothing when refused', async () => {
        median(5000);
        await openWithMalus([SAGESSE_MALUS], 'community');
        await typePrice('9000');
        fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument());
        expect(submitCommunityPrice).not.toHaveBeenCalled();
        expect((await resourcePricesFor('community').get('mikhal', saRuneId))?.unitPriceKamas).toBe(10);
      });

      it('shares a far price once confirmed', async () => {
        median(5000);
        await openWithMalus([SAGESSE_MALUS], 'community');
        await typePrice('9000');
        fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer quand même' }));
        await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalledWith(saRuneId, 'mikhal', 9000));
        expect((await resourcePricesFor('community').get('mikhal', saRuneId))?.unitPriceKamas).toBe(9000);
      });
    });

    it('brings the price in use back when the field is emptied or set to 0', async () => {
      await resourcePricesFor('personal').save('mikhal', saRuneId, 10);
      await openWithMalus([SAGESSE_MALUS]);
      await screen.findByLabelText('Jet de Sagesse (malus)');
      const input = await screen.findByLabelText('Prix de Rune Sa');
      await waitFor(() => expect(input).toHaveValue('10'));
      for (const typed of ['', '0']) {
        fireEvent.change(input, { target: { value: typed } });
        fireEvent.blur(input);
        await waitFor(() => expect(input).toHaveValue('10'));
      }
      expect((await resourcePricesFor('personal').get('mikhal', saRuneId))?.unitPriceKamas).toBe(10);
    });

    it('refuses a positive roll above the weight limit of an exo, and a roll of 0', async () => {
      await openWithMalus([SAGESSE_MALUS]);
      await screen.findByLabelText('Jet de Sagesse (malus)');
      type('Jet de Sagesse (malus)', '34');
      expect(field('Jet de Sagesse (malus)')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(/jet maximal 33 : moyen utilisé/)).toBeInTheDocument();
      type('Jet de Sagesse (malus)', '0');
      expect(field('Jet de Sagesse (malus)')).toHaveAttribute('aria-invalid', 'true');
      type('Jet de Sagesse (malus)', '33');
      expect(field('Jet de Sagesse (malus)')).not.toHaveAttribute('aria-invalid');
    });

    it('keeps the page as it was for an item without malus', async () => {
      await openWithMalus([]);
      await screen.findByLabelText('Jet de Vitalité');
      expect(screen.queryByLabelText(/\(malus\)/)).not.toBeInTheDocument();
      expect(document.querySelector('.brisage-negative')).toBeNull();
    });

    it('keeps a positive and a negative line of the same stat apart', async () => {
      await openWithMalus([{ effectId: 125, from: -5, to: -5 }]);
      expect(await screen.findByLabelText('Jet de Vitalité')).toBeInTheDocument();
      expect(screen.getByLabelText('Jet de Vitalité (malus)')).toBeInTheDocument();
    });

    it('refuses a roll outside the range of the malus and uses the average', async () => {
      await openWithMalus();
      await screen.findByLabelText('Jet de Force (malus)');
      type('Jet de Force (malus)', '-1');
      expect(field('Jet de Force (malus)')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(/jet invalide/)).toBeInTheDocument();
      type('Jet de Force (malus)', '-12');
      expect(field('Jet de Force (malus)')).not.toHaveAttribute('aria-invalid');
    });

    it('says the item has no usable line when it only has maluses', async () => {
      getItemEffectRanges.mockResolvedValue([]);
      await openWithMalus();
      expect(await screen.findByText(/n'a aucune ligne exploitable/)).toHaveTextContent('Force -13');
    });

    it('brings back the rolls of a session saved before, with the malus listed after the positive lines', async () => {
      await openWithMalus();
      await screen.findByLabelText('Jet de Vitalité');
      type('Jet de Vitalité', '44');
      type('Jet de Force (malus)', '-11');
      cleanup();
      render(<App />);
      await screen.findByRole('heading', { name: 'Brisage' });
      expect(await screen.findByLabelText('Jet de Vitalité')).toHaveValue(44);
      expect(await screen.findByLabelText('Jet de Force (malus)')).toHaveValue(-11);
    });
  });

  it('says so when the item stats cannot be read', async () => {
    getItemEffectRanges.mockRejectedValue(new Error('down'));
    await openBrisage();
    type('Chercher un objet', 'Cape');
    fireEvent.click(await screen.findByRole('button', { name: /Cape du Chef Bwork/ }));
    expect(await screen.findByText(/n'ont pas pu être lues/)).toBeInTheDocument();
  });
});
