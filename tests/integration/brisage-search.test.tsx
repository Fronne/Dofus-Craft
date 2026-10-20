import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// specs/064-recherche-objets-par-stats. Effect ids: Vitalité 125, Sagesse 124, Prospection 176.
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
    { id: '1', name: 'Coiffe du Chasseur', level: 150, effects: [{ effectId: 176, from: 10, to: 20 }, { effectId: 125, from: 100, to: 150 }] },
    { id: '2', name: 'Cape du Sage', level: 100, effects: [{ effectId: 124, from: 30, to: 40 }, { effectId: 125, from: 50, to: 60 }] },
    { id: '3', name: 'Amulette du Prospecteur', level: 60, effects: [{ effectId: 176, from: 5, to: 5 }] },
    { id: '4', name: 'Anneau Costaud', level: 190, effects: [{ effectId: 176, from: 40, to: 60 }] },
  ],
};

const names = () => screen.queryAllByRole('strong').map((node) => node.textContent);
const resultNames = () => screen.queryAllByRole('listitem').map((li) => within(li).queryByText(/^(Coiffe|Cape|Amulette|Anneau)/)?.textContent).filter(Boolean);

async function openStats() {
  window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.history.pushState({}, '', '/brisage');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  await screen.findByRole('heading', { name: 'Brisage' });
  fireEvent.click(screen.getByLabelText('Par stats'));
}

const chip = (label: string) => screen.getByRole('button', { name: label });

describe('Brisage – recherche par stats (specs/064)', () => {
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

  it('invites to choose a stat and lists nothing before', async () => {
    await openStats();
    expect(await screen.findByText(/Choisissez au moins une stat/)).toBeInTheDocument();
    expect(screen.queryByText(/objets? trouvés?/)).not.toBeInTheDocument();
  });

  it('offers only targetable stats: the hunt stat is not there', async () => {
    await openStats();
    await screen.findByText(/Choisissez au moins une stat/);
    expect(chip('Prospection')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /chasse/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filtrer les stats'), { target: { value: 'sagess' } });
    expect(chip('Sagesse')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prospection' })).not.toBeInTheDocument();
  });

  it('lists the items with the stat, labelled as an estimate at 100 %, most runes first', async () => {
    await openStats();
    fireEvent.click(await screen.findByRole('button', { name: 'Prospection' }));
    expect(await screen.findByText(/3 objets trouvés/)).toBeInTheDocument();
    expect(screen.getByText(/estimation à 100 %/)).toBeInTheDocument();
    const order = resultNames();
    expect(order).toHaveLength(3);
    expect(order).not.toContain('Cape du Sage');
    expect(order[0]).toBe('Anneau Costaud');
  });

  it('keeps only the items that have EVERY chosen stat and explains an empty list', async () => {
    await openStats();
    fireEvent.click(await screen.findByRole('button', { name: 'Prospection' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vitalité' }));
    expect(await screen.findByText(/1 objet trouvé/)).toBeInTheDocument();
    expect(resultNames()).toEqual(['Coiffe du Chasseur']);
    fireEvent.click(screen.getByRole('button', { name: 'Sagesse' }));
    expect(await screen.findByText(/Aucun objet ne porte toutes ces stats/)).toBeInTheDocument();
  });

  it('changes the sort without leaving the page, an unknown value is shown as a dash', async () => {
    await openStats();
    fireEvent.click(await screen.findByRole('button', { name: 'Prospection' }));
    await screen.findByText(/3 objets trouvés/);
    fireEvent.change(screen.getByLabelText('Trier par'), { target: { value: 'maxRoll' } });
    expect(resultNames()[0]).toBe('Anneau Costaud');
    fireEvent.change(screen.getByLabelText('Trier par'), { target: { value: 'kamas' } });
    await waitFor(() => expect(screen.getAllByText('Valeur : —')).toHaveLength(3));
  });

  it('applies the level range and refuses an inverted one', async () => {
    await openStats();
    fireEvent.click(await screen.findByRole('button', { name: 'Prospection' }));
    await screen.findByText(/3 objets trouvés/);
    fireEvent.change(screen.getByLabelText('Niveau minimum'), { target: { value: '100' } });
    expect(await screen.findByText(/2 objets trouvés/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Niveau maximum'), { target: { value: '50' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/niveau minimum/i);
    fireEvent.change(screen.getByLabelText('Niveau maximum'), { target: { value: '' } });
    expect(await screen.findByText(/2 objets trouvés/)).toBeInTheDocument();
  });

  it('opens the item in the brisage, then finds the choices again; nothing else is written', async () => {
    await openStats();
    fireEvent.click(await screen.findByRole('button', { name: 'Prospection' }));
    await screen.findByText(/3 objets trouvés/);
    fireEvent.click(screen.getByRole('button', { name: /Anneau Costaud/ }));
    expect(await screen.findByText('Anneau Costaud')).toBeInTheDocument();
    expect(getItemEffectRanges).toHaveBeenCalledWith('4');
    expect(window.localStorage.getItem('craftcheck-brisage-session')).toContain('"id":"4"');
    expect(Object.keys(window.localStorage).filter((key) => key.includes('coefficient'))).toEqual([]);

    fireEvent.click(await screen.findByRole('button', { name: /Changer d'objet/ }));
    expect(await screen.findByText(/3 objets trouvés/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prospection', pressed: true })).toBeInTheDocument();
  });

  it('says so when the list of items is unavailable and shows no list', async () => {
    loadIndex.mockRejectedValue(new Error('indisponible'));
    await openStats();
    expect(await screen.findByRole('alert')).toHaveTextContent(/indisponible/);
    expect(names()).not.toContain('Coiffe du Chasseur');
  });

  it('does not touch the search by name', async () => {
    await openStats();
    fireEvent.click(screen.getByLabelText('Par nom'));
    expect(await screen.findByLabelText('Chercher un objet')).toBeInTheDocument();
  });
});
