import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// specs/064-recherche-objets-par-stats, reprise par specs/065-refonte-page-brisage : the stats filter now lives in the
// "Filtres" panel above the cards. Effect ids: Vitalité 125, Sagesse 124, Prospection 176.
const getItemEffectRanges = vi.fn();
const loadIndex = vi.fn();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getCommunityPrices: vi.fn().mockResolvedValue({ status: 'found', prices: [] }),
  getSharedItemPrices: vi.fn().mockResolvedValue({ status: 'found', items: [] }),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getItemDetail: vi.fn().mockResolvedValue({ recipe: undefined, resources: [] }),
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

vi.mock('../../src/data/brisage-items-repository', () => ({
  loadBrisageItemsIndex: () => loadIndex(),
}));

import App from '../../src/app/App';

const INDEX = {
  source: 'test',
  sourceUrl: 'https://example.test',
  retrievedAt: '2026-10-20',
  items: [
    { id: '1', name: 'Coiffe du Chasseur', level: 150, categoryId: 'equipment-type-16', effects: [{ effectId: 176, from: 10, to: 20 }, { effectId: 125, from: 100, to: 150 }] },
    { id: '2', name: 'Cape du Sage', level: 100, categoryId: 'equipment-type-17', effects: [{ effectId: 124, from: 30, to: 40 }, { effectId: 125, from: 50, to: 60 }] },
    { id: '3', name: 'Amulette du Prospecteur', level: 60, categoryId: 'equipment-type-1', effects: [{ effectId: 176, from: 5, to: 5 }] },
    { id: '4', name: 'Anneau Costaud', level: 190, categoryId: 'equipment-type-9', effects: [{ effectId: 176, from: 40, to: 60 }] },
  ],
};

const resultNames = () => screen.queryAllByRole('listitem').map((li) => within(li).queryByText(/^(Coiffe|Cape|Amulette|Anneau)/)?.textContent).filter(Boolean);

async function openBrisage() {
  window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.history.pushState({}, '', '/brisage');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  await screen.findByRole('heading', { name: 'Brisage' });
}

async function openFilters() {
  await openBrisage();
  fireEvent.click(await screen.findByRole('button', { name: /^Filtres/ }));
}

const stat = (label: string) => screen.getByRole('button', { name: label });

describe('Brisage – filtres et cartes (specs/064, specs/065)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getItemEffectRanges.mockReset();
    getItemEffectRanges.mockResolvedValue([{ effectId: 176, from: 10, to: 20 }]);
    loadIndex.mockReset();
    loadIndex.mockResolvedValue(INDEX);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('lists the items by level before any filter, with no estimate', async () => {
    await openBrisage();
    expect(await screen.findByText(/4 objets trouvés/)).toBeInTheDocument();
    expect(screen.queryByText(/estimation à 100 %/)).not.toBeInTheDocument();
    expect(resultNames()[0]).toBe('Anneau Costaud');
  });

  it('keeps the filters folded until the button is pressed, in three columns of stats', async () => {
    await openBrisage();
    const toggle = await screen.findByRole('button', { name: /^Filtres/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Prospection' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Caractéristiques', 'Dommages', 'Résistances']);
    expect(document.querySelectorAll('.brisage-stat-column')).toHaveLength(3);
  });

  it('offers only targetable stats: the hunt stat is not there', async () => {
    await openFilters();
    expect(stat('Prospection')).toBeInTheDocument();
    const panel = within(document.querySelector('.brisage-filters') as HTMLElement);
    expect(panel.queryByRole('button', { name: /chasse/i })).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Arme de chasse' })).not.toBeInTheDocument();
  });

  it('lists the items with the stat, labelled as an estimate at 100 %, most runes first', async () => {
    await openFilters();
    fireEvent.click(stat('Prospection'));
    expect(await screen.findByText(/3 objets trouvés/)).toBeInTheDocument();
    expect(screen.getByText(/estimation à 100 %/)).toBeInTheDocument();
    const order = resultNames();
    expect(order).toHaveLength(3);
    expect(order).not.toContain('Cape du Sage');
    expect(order[0]).toBe('Anneau Costaud');
  });

  it('keeps only the items that have EVERY chosen stat and explains an empty list', async () => {
    await openFilters();
    fireEvent.click(stat('Prospection'));
    fireEvent.click(stat('Vitalité'));
    expect(await screen.findByText(/1 objet trouvé/)).toBeInTheDocument();
    expect(resultNames()).toEqual(['Coiffe du Chasseur']);
    fireEvent.click(stat('Sagesse'));
    expect(await screen.findByText(/Aucun objet ne porte toutes ces stats/)).toBeInTheDocument();
  });

  it('shows the active filters as removable chips even when the panel is folded', async () => {
    await openFilters();
    fireEvent.click(stat('Prospection'));
    fireEvent.click(screen.getByRole('button', { name: /^Filtres/ }));
    expect(screen.queryByRole('button', { name: 'Vitalité' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre Prospection' }));
    expect(await screen.findByText(/4 objets trouvés/)).toBeInTheDocument();
  });

  it('offers no sort field in the filters', async () => {
    await openFilters();
    fireEvent.click(stat('Prospection'));
    await screen.findByText(/3 objets trouvés/);
    expect(screen.queryByLabelText('Trier par')).not.toBeInTheDocument();
  });

  it('applies the level range', async () => {
    await openFilters();
    fireEvent.click(stat('Prospection'));
    await screen.findByText(/3 objets trouvés/);
    fireEvent.change(screen.getByLabelText('Niveau min'), { target: { value: '100' } });
    expect(await screen.findByText(/2 objets trouvés/)).toBeInTheDocument();
  });

  it('opens the item in the brisage from its card; nothing else is written', async () => {
    await openBrisage();
    fireEvent.click(await screen.findByRole('button', { name: /Anneau Costaud/ }));
    expect(await screen.findByRole('heading', { name: 'Anneau Costaud' })).toBeInTheDocument();
    expect(getItemEffectRanges).toHaveBeenCalledWith('4');
    expect(window.localStorage.getItem('craftcheck-brisage-session')).toContain('"id":"4"');
    expect(Object.keys(window.localStorage).filter((key) => key.includes('coefficient'))).toEqual([]);
    // The cards stay there to pick another item, the chosen one marked.
    expect(screen.getByRole('button', { name: /Anneau Costaud/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Cape du Sage/ }));
    expect(await screen.findByRole('heading', { name: 'Cape du Sage' })).toBeInTheDocument();
  });

  it('says so when the list of items is unavailable and shows no card', async () => {
    loadIndex.mockRejectedValue(new Error('indisponible'));
    await openBrisage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/indisponible/);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Coiffe du Chasseur/ })).not.toBeInTheDocument());
  });

  it('shows the first six cards as a carousel, without a "show more" button', async () => {
    loadIndex.mockResolvedValue({
      ...INDEX,
      items: Array.from({ length: 8 }, (_, i) => ({ id: String(100 + i), name: `Cape numéro ${i}`, level: 10 + i, effects: [{ effectId: 125, from: 1, to: 2 }] })),
    });
    await openBrisage();
    expect(await screen.findByText(/8 objets trouvés/)).toBeInTheDocument();
    expect(resultNames()).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /Afficher/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réduire' })).not.toBeInTheDocument();
  });
});
