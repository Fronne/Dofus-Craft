import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// specs/060-page-brisage. Real rune data: Rune Vi 1523, Rune Cha 1525, Rune Do 7435.
const getItemEffectLines = vi.fn();

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
  getItemEffectLines: (id: string) => getItemEffectLines(id),
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
  await waitFor(() => expect(screen.getAllByLabelText('Stat de la ligne')).toHaveLength(4));
}

describe('Brisage page (specs/060)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getItemEffectLines.mockReset();
    // Vi 44, Cha 38, Do 4 and a line the table does not know (Effet 999999).
    getItemEffectLines.mockResolvedValue([
      { effectId: 125, value: 44 }, { effectId: 123, value: 38 }, { effectId: 112, value: 4 }, { effectId: 999999, value: 2 },
    ]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('says on the page that everything is an estimate and the focus an unofficial hypothesis', async () => {
    await openBrisage();
    expect(screen.getByRole('note')).toHaveTextContent('Tout est une estimation');
    expect(screen.getByRole('note')).toHaveTextContent('hypothèse non officielle');
    expect(screen.getByRole('note')).toHaveTextContent('niveau 40');
  });

  it('asks for the missing rune prices instead of inventing them', async () => {
    await openBrisage();
    await pickCape();
    type('Coût de l\'objet (kamas)', '100');
    expect(await screen.findByText(/Prix manquant pour 3 rune/)).toBeInTheDocument();
    expect(screen.getAllByText('prix manquant').length).toBeGreaterThan(0);
    expect(screen.getByText('Prix manquants')).toBeInTheDocument();
    expect(screen.getByText(/1 ligne\(s\) sans poids ni rune connus/)).toBeInTheDocument();
  });

  it('ranks a focus on the expensive Dommages rune first, with the threshold and the item count', async () => {
    const carnet = resourcePricesFor('personal');
    await carnet.save('mikhal', '1523', 5);
    await carnet.save('mikhal', '1525', 5);
    await carnet.save('mikhal', '7435', 3000);
    await openBrisage();
    await pickCape();
    type('Coût de l\'objet (kamas)', '1000');
    const table = (await screen.findByText('Classement des options')).nextElementSibling!.nextElementSibling as HTMLElement;
    await waitFor(() => expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Focus Do'));
    expect(screen.getByText('Meilleure option').parentElement).toHaveTextContent('Focus Do');
    expect(screen.getByText('Coefficient minimal rentable').parentElement).not.toHaveTextContent('—');
    expect(screen.getByText('Descente du coefficient')).toBeInTheDocument();
  });

  it('lets a typed price replace the missing one', async () => {
    await openBrisage();
    await pickCape();
    type('Coût de l\'objet (kamas)', '10');
    for (const name of ['Rune Vi', 'Rune Cha', 'Rune Do']) type(`Prix de ${name}`, '100');
    await waitFor(() => expect(screen.queryByText(/Prix manquant pour/)).not.toBeInTheDocument());
    expect(screen.getByText('Brisage normal')).toBeInTheDocument();
  });

  it('says it is not profitable when the coefficient is under the threshold', async () => {
    await openBrisage();
    await pickCape();
    type('Coût de l\'objet (kamas)', '99999999');
    for (const name of ['Rune Vi', 'Rune Cha', 'Rune Do']) type(`Prix de ${name}`, '10');
    expect(await screen.findByText('Pas rentable')).toBeInTheDocument();
    expect(screen.getByText(/déjà sous le seuil/)).toBeInTheDocument();
  });

  it('keeps edited settings on the device and restores the defaults', async () => {
    await openBrisage();
    fireEvent.change(field('Poids de Vitalité'), { target: { value: '0.5' } });
    expect(JSON.parse(window.localStorage.getItem('craftcheck-brisage-settings')!).stats[125].weight).toBe(0.5);
    fireEvent.click(screen.getByRole('button', { name: 'Rétablir les valeurs par défaut' }));
    expect(field('Poids de Vitalité').value).toBe('0.2');
    expect(window.localStorage.getItem('craftcheck-brisage-settings')).toBeNull();
  });

  it('works with manual lines when the item stats cannot be read', async () => {
    getItemEffectLines.mockRejectedValue(new Error('down'));
    await openBrisage();
    type('Chercher un objet', 'Cape');
    fireEvent.click(await screen.findByRole('button', { name: /Cape du Chef Bwork/ }));
    expect(await screen.findByText(/n'ont pas pu être lues/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une ligne' }));
    fireEvent.change(screen.getByLabelText(/Valeur de la ligne/), { target: { value: '30' } });
    type('Coût de l\'objet (kamas)', '10');
    expect(await screen.findByText(/Prix manquant pour 1 rune/)).toBeInTheDocument();
  });
});
