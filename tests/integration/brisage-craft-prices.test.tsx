import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// specs/070-atelier-prix-craft-brisage: the window of the resource prices of an item's craft chain, opened from Brisage.
// The cape is crafted from 3 Laine and 2 Cuir; Cuir is itself crafted from 1 Peau when the test says so.
const getItemEffectRanges = vi.fn();
const getItemDetail = vi.fn();
const getResourceRecipe = vi.fn();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getCommunityPrices: vi.fn().mockResolvedValue({ status: 'found', prices: [] }),
  getSharedItemPrices: vi.fn().mockResolvedValue({ status: 'found', items: [] }),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
}));

vi.mock('../../src/services/brisage-coefficient-api', () => ({
  MAX_ITEMS_PER_READ: 96,
  MAX_ENTRIES_PER_SEND: 100,
  getSharedCoefficients: vi.fn().mockResolvedValue(new Map()),
  submitCoefficients: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [{ id: '777', name: 'Cape du Chef Bwork', level: 100, kind: 'Equipment', categoryId: 'c' }], total: 1 }),
  getItemDetail: (id: string) => getItemDetail(id),
  getItemEffectRanges: (id: string) => getItemEffectRanges(id),
  getItemNegativeRanges: vi.fn().mockResolvedValue([]),
  getResourceRecipe: (id: string) => getResourceRecipe(id),
  getResourceDetails: vi.fn().mockResolvedValue([]),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/brisage-items-repository', () => ({
  loadBrisageItemsIndex: vi.fn().mockResolvedValue({
    source: 'test', sourceUrl: 'https://example.test', retrievedAt: '2026-10-20',
    items: [{ id: '777', name: 'Cape du Chef Bwork', level: 100, categoryId: 'equipment-type-17', effects: [{ effectId: 125, from: 40, to: 44 }] }],
  }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';
import { forgetSharedCoefficients } from '../../src/features/brisage/use-shared-coefficients';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';

const cost = () => document.querySelector('.brisage-cost')?.textContent ?? undefined;
const total = () => document.querySelector('.craft-prices-total')?.textContent ?? '';
const priceField = (resource: string) => screen.getByLabelText(`Prix de ${resource}`) as HTMLInputElement;
const type = (resource: string, value: string) => fireEvent.change(priceField(resource), { target: { value } });

const RESOURCES = [{ id: 'laine', name: 'Laine', craftable: false }, { id: 'cuir', name: 'Cuir', craftable: false }];
const CAPE_RECIPE = { id: 'r-777', itemId: '777', ingredients: [{ resourceId: 'laine', quantity: 3 }, { resourceId: 'cuir', quantity: 2 }] };

async function openBrisage() {
  window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.history.pushState({}, '', '/brisage');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  await screen.findByRole('heading', { name: 'Brisage' });
  fireEvent.change(screen.getByLabelText('Chercher un objet'), { target: { value: 'Cape' } });
  fireEvent.click(await screen.findByRole('button', { name: /Cape du Chef Bwork/ }));
  await screen.findByLabelText(/^Coefficient/);
}

async function openWorkshop() {
  fireEvent.click(await screen.findByRole('button', { name: 'Modifier les prix' }));
  const dialog = await screen.findByRole('dialog', { name: /Prix du craft de Cape du Chef Bwork/ });
  await within(dialog).findByLabelText('Prix de Laine');
  return dialog;
}

const closeWorkshop = () => fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

describe('Brisage craft prices window (specs/070)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    forgetSharedCoefficients();
    getItemEffectRanges.mockReset();
    getItemEffectRanges.mockResolvedValue([{ effectId: 125, from: 40, to: 44 }]);
    getItemDetail.mockReset();
    getItemDetail.mockResolvedValue({ recipe: CAPE_RECIPE, resources: RESOURCES });
    getResourceRecipe.mockReset();
    getResourceRecipe.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('offers the button when the item has a recipe', async () => {
    await openBrisage();
    expect(await screen.findByRole('button', { name: 'Modifier les prix' })).toBeInTheDocument();
  });

  it('does not offer the button when the item has no recipe', async () => {
    getItemDetail.mockResolvedValue({ recipe: undefined, resources: [] });
    await openBrisage();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Modifier les prix' })).not.toBeInTheDocument());
  });

  it('lists the resources with their quantities and the price noted for each', async () => {
    await resourcePricesFor('personal').save('mikhal', 'laine', 100);
    await openBrisage();
    const dialog = await openWorkshop();
    expect(within(dialog).getByText('× 3')).toBeInTheDocument();
    expect(within(dialog).getByText('× 2')).toBeInTheDocument();
    await waitFor(() => expect(priceField('Laine').value).toMatch(/100/));
    expect(priceField('Cuir').value).toBe('');
    expect(within(dialog).getByText(/Dernière mise à jour/)).toBeInTheDocument();
  });

  it('follows the typing in the total, and says the total is incomplete while a price is missing', async () => {
    await openBrisage();
    await openWorkshop();
    expect(total()).toMatch(/Total du craft incomplet/);
    expect(total()).toMatch(/Prix manquant : Laine, Cuir/);
    type('Laine', '100');
    expect(total()).toMatch(/Prix manquant : Cuir/);
    expect(total()).toMatch(/Total du craft incomplet/);
    type('Cuir', '250');
    expect(total()).toMatch(/Total du craft\s*800/);
    type('Laine', '200');
    expect(total()).toMatch(/Total du craft\s*1\D?100/);
    expect(total()).not.toMatch(/incomplet/);
  });

  it('counts the prices typed once the window is closed, saves them where Recherche reads them, and gives the focus back', async () => {
    const carnet = resourcePricesFor('personal');
    await carnet.save('mikhal', 'laine', 100);
    await carnet.save('mikhal', 'cuir', 250);
    await openBrisage();
    fireEvent.click(await screen.findByLabelText('Craft'));
    await waitFor(() => expect(cost()).toMatch(/800/));
    await openWorkshop();
    type('Laine', '200');
    closeWorkshop();
    await waitFor(() => expect(cost()).toMatch(/1\D?100/));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect((await carnet.getMany('mikhal', ['laine'])).laine.unitPriceKamas).toBe(200);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Modifier les prix' }));
  });

  it('takes no price from letters and keeps the one noted', async () => {
    const carnet = resourcePricesFor('personal');
    await carnet.save('mikhal', 'laine', 100);
    await carnet.save('mikhal', 'cuir', 250);
    await openBrisage();
    await openWorkshop();
    type('Laine', 'abc');
    fireEvent.blur(priceField('Laine'));
    closeWorkshop();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await carnet.getMany('mikhal', ['laine'])).laine.unitPriceKamas).toBe(100);
  });

  it('shows the resources of a crafted ingredient and counts them as Recherche does', async () => {
    getItemDetail.mockResolvedValue({ recipe: CAPE_RECIPE, resources: [RESOURCES[0], { id: 'cuir', name: 'Cuir' }] });
    getResourceRecipe.mockImplementation(async (id: string) => (id === 'cuir'
      ? { recipe: { id: 'r-cuir', itemId: 'cuir', ingredients: [{ resourceId: 'peau', quantity: 1 }] }, resources: [{ id: 'peau', name: 'Peau', craftable: false }] }
      : null));
    await openBrisage();
    const dialog = await openWorkshop();
    // Unfolded from the start: the hide button is offered, and the hidden resource has its own price field.
    expect(await within(dialog).findByLabelText('Prix de Peau')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Masquer la recette de Cuir/ })).toBeInTheDocument();
    // 2 Cuir × 1 Peau: the quantity is the one for a whole craft of the cape.
    expect(within(dialog).getAllByText('× 2').length).toBeGreaterThan(0);
    type('Laine', '100');
    type('Peau', '10');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crafter' }));
    expect(total()).toMatch(/Total du craft\s*320/);
    type('Cuir', '250');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Acheter' }));
    expect(total()).toMatch(/Total du craft\s*800/);
  });

  it('tells the page when the browser closes the dialog by itself, and the button opens it again', async () => {
    await resourcePricesFor('personal').save('mikhal', 'laine', 100);
    await openBrisage();
    const dialog = await openWorkshop();
    fireEvent(dialog, new Event('close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await openWorkshop();
  });

  it('lists a price that was emptied among the missing ones', async () => {
    await resourcePricesFor('personal').save('mikhal', 'laine', 100);
    await resourcePricesFor('personal').save('mikhal', 'cuir', 250);
    await openBrisage();
    await openWorkshop();
    await waitFor(() => expect(total()).not.toMatch(/incomplet/));
    type('Laine', '');
    expect(total()).toMatch(/Prix manquant : Laine/);
  });

  it('opens on the first price, moves to the next one with Enter and closes with Escape', async () => {
    await openBrisage();
    const dialog = await openWorkshop();
    await waitFor(() => expect(document.activeElement).toBe(priceField('Laine')));
    type('Laine', '5');
    fireEvent.keyDown(priceField('Laine'), { key: 'Enter' });
    expect(document.activeElement).toBe(priceField('Cuir'));
    // Enter on the last price stays on it.
    fireEvent.keyDown(priceField('Cuir'), { key: 'Enter' });
    expect(document.activeElement).toBe(priceField('Cuir'));
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((await resourcePricesFor('personal').getMany('mikhal', ['laine'])).laine.unitPriceKamas).toBe(5);
  });
});
