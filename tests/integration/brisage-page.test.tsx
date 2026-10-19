import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// specs/061-simplification-page-brisage. Real rune data: Rune Vi 1523, Rune Cha 1525, Rune Do 7435.
const getItemEffectRanges = vi.fn();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getCommunityPrices: vi.fn().mockResolvedValue({ status: 'found', prices: [] }),
  getSharedItemPrices: vi.fn().mockResolvedValue({ status: 'found', items: [] }),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [{ id: '777', name: 'Cape du Chef Bwork', level: 100, kind: 'Equipment', categoryId: 'c' }], total: 1 }),
  getItemDetail: vi.fn(),
  getItemEffectRanges: (id: string) => getItemEffectRanges(id),
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
import { pinnedItemPrices } from '../../src/persistence/indexeddb-pinned-item-price-repository';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

async function openBrisage() {
  window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.history.pushState({}, '', '/brisage');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  await screen.findByRole('heading', { name: 'Brisage' });
}

async function pickCape() {
  type('Chercher un objet', 'Cape');
  fireEvent.click(await screen.findByRole('button', { name: /Cape du Chef Bwork/ }));
  await waitFor(() => expect(screen.getAllByLabelText(/^Jet de /)).toHaveLength(3));
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
    getItemEffectRanges.mockReset();
    // Vi 40–44, Cha fixed 38, Do 1–9 and a line the table does not know.
    getItemEffectRanges.mockResolvedValue([
      { effectId: 125, from: 40, to: 44 }, { effectId: 123, from: 38, to: 38 }, { effectId: 112, from: 1, to: 9 }, { effectId: 999999, from: 2, to: 2 },
    ]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('says on the page that everything is an estimate and the focus an unofficial hypothesis', async () => {
    await openBrisage();
    expect(screen.getByRole('note')).toHaveTextContent('Tout est une estimation');
    expect(screen.getByRole('note')).toHaveTextContent('hypothèse non officielle');
  });

  it('reads the cost from the price noted on Recherche and offers no level field', async () => {
    await pinnedItemPrices.save('mikhal', '777', 12345);
    await openBrisage();
    await pickCape();
    expect(await screen.findByText(/12\D345 kamas/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/niveau de l'objet/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Coût de l'objet/)).not.toBeInTheDocument();
  });

  it('asks for the cost when the item has no recorded price', async () => {
    await openBrisage();
    await pickCape();
    expect(await screen.findByLabelText(/Coût de l'objet/)).toBeInTheDocument();
  });

  it('treats a recorded price of 0 as no price', async () => {
    await pinnedItemPrices.save('mikhal', '777', 0);
    await openBrisage();
    await pickCape();
    expect(await screen.findByLabelText(/Coût de l'objet/)).toBeInTheDocument();
  });

  it('asks for the coefficient of an item never broken, and shows no result until it is given', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    expect(await screen.findByLabelText(/Coefficient relevé en jeu/)).toBeInTheDocument();
    expect(await screen.findByText(/Indiquez le coefficient/)).toBeInTheDocument();
    expect(screen.queryByText('Verdict')).not.toBeInTheDocument();
  });

  it('shows the verdict, the item count, the minimal coefficient and the focus rune', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient relevé en jeu/), { target: { value: '50' } });
    expect(await screen.findByText('Verdict')).toBeInTheDocument();
    expect(screen.getByText('Verdict').parentElement).toHaveTextContent('Rentable');
    expect(screen.getByText('Meilleure rune à focus').parentElement).toHaveTextContent('Focus Do');
    expect(screen.getByText('Coefficient minimal rentable').parentElement).not.toHaveTextContent('—');
    expect(screen.getByText('Brisages avant le seuil').parentElement).not.toHaveTextContent('—');
  });

  it('remembers the coefficient with its date for the next time', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    const input = await screen.findByLabelText(/Coefficient relevé en jeu/);
    fireEvent.change(input, { target: { value: '38' } });
    fireEvent.blur(input);
    expect(await screen.findByText(/Dernier coefficient/)).toHaveTextContent('38 %');
    expect(JSON.parse(window.localStorage.getItem('craftcheck-brisage-coefficients')!)['mikhal:777'].coefficient).toBe(38);
    expect(await screen.findByText('Verdict')).toBeInTheDocument();
  });

  it('starts from a stored coefficient', async () => {
    window.localStorage.setItem('craftcheck-brisage-coefficients', JSON.stringify({ 'mikhal:777': { coefficient: 44, savedAt: '2026-10-12T10:00:00.000Z' } }));
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    expect(await screen.findByText(/Dernier coefficient/)).toHaveTextContent('44 %');
    expect(screen.getByText(/Dernier coefficient/)).toHaveTextContent('12/10/2026');
    expect(await screen.findByText('Verdict')).toBeInTheDocument();
  });

  it('starts each line at its average roll and lets a roll be typed', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    expect(field('Jet de Vitalité').placeholder).toBe('42');
    expect(field('Jet de Dommages').placeholder).toBe('5');
    expect(screen.getAllByText('moyen')).toHaveLength(3);
    type('Jet de Vitalité', '44');
    expect(screen.getByText('modifié')).toBeInTheDocument();
    type('Jet de Vitalité', '');
    expect(screen.queryByText('modifié')).not.toBeInTheDocument();
  });

  it('names the runes without a price instead of inventing one', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient relevé en jeu/), { target: { value: '50' } });
    expect(await screen.findByText(/Prix manquant pour : /)).toHaveTextContent('Rune Vi');
    expect(screen.getByText('Verdict').parentElement).toHaveTextContent('Prix manquants');
  });

  it('says it is not profitable when the cost is far above the runes', async () => {
    await pinnedItemPrices.save('mikhal', '777', 99999999);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient relevé en jeu/), { target: { value: '50' } });
    expect(await screen.findByText('Pas rentable')).toBeInTheDocument();
  });

  it('says so when the item stats cannot be read', async () => {
    getItemEffectRanges.mockRejectedValue(new Error('down'));
    await openBrisage();
    type('Chercher un objet', 'Cape');
    fireEvent.click(await screen.findByRole('button', { name: /Cape du Chef Bwork/ }));
    expect(await screen.findByText(/n'ont pas pu être lues/)).toBeInTheDocument();
  });
});
