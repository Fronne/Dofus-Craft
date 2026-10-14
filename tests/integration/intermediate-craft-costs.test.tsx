import { IDBFactory } from 'fake-indexeddb';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatKamas } from '../../src/domain/kamas';
import type { Recipe, Resource } from '../../src/domain/types';

// jest-dom normalizes the received text's whitespace but not the expected string.
const n = (value: string) => value.replace(/\u202f/g, ' ');
// The verdict shows its amounts with the kamas icon, not the word « kamas »: only the number is text.
const verdictAmount = (value: number) => new Intl.NumberFormat('fr-FR').format(value);

// specs/015 quickstart.md: Dagues de Fouraille = 2 × Planche Agglomérée (craftable) + 3 × Peau de
// Larve Bleue ; Planche Agglomérée = 10 × Bois de Frêne.
const { DAGUES, DAGUES_RECIPE, PLANCHE, PEAU, getResourceRecipe, chain } = vi.hoisted(() => {
  const PLANCHE_RECIPE: Recipe = { id: '16489', itemId: '16489', ingredients: [{ resourceId: '303', quantity: 10 }] };
  // `chain.deep` makes Bois de Frêne craftable too (2 × Sève), for the third-level case.
  const chain = { deep: false };
  const BOIS = (): Resource => ({ id: '303', name: 'Bois de Frêne', craftable: chain.deep });
  const BOIS_RECIPE: Recipe = { id: '303', itemId: '303', ingredients: [{ resourceId: '999', quantity: 2 }] };
  const SEVE: Resource = { id: '999', name: 'Sève', craftable: false };
  return {
    chain,
    DAGUES: { id: '208', name: 'Dagues de Fouraille', level: 20, kind: 'Equipment' as const, categoryId: 'cat-1' },
    DAGUES_RECIPE: { id: '208', itemId: '208', ingredients: [{ resourceId: '16489', quantity: 2 }, { resourceId: '362', quantity: 3 }] } as Recipe,
    PLANCHE: { id: '16489', name: 'Planche Agglomérée', craftable: true } as Resource,
    PEAU: { id: '362', name: 'Peau de Larve Bleue', craftable: false } as Resource,
    getResourceRecipe: vi.fn(async (id: string) => {
      if (id === '16489') return { recipe: PLANCHE_RECIPE, resources: [BOIS()] };
      if (id === '303' && chain.deep) return { recipe: BOIS_RECIPE, resources: [SEVE] };
      return null;
    }),
  };
});

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'cat-1', label: 'Dagues', sortOrder: 1, kind: 'Equipment', typeIds: [] }]),
  searchItems: vi.fn().mockResolvedValue({ data: [DAGUES], total: 1 }),
  getItemDetail: vi.fn().mockResolvedValue({ recipe: DAGUES_RECIPE, resources: [PLANCHE, PEAU], stats: [] }),
  getResourceRecipe: (id: string) => getResourceRecipe(id),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';
import { prices } from '../../src/persistence/indexeddb-resource-price-repository';

async function openDagues(carnet: Record<string, number>) {
  for (const [id, value] of Object.entries(carnet)) await prices.save('mikhal', id, value);
  render(<App />);
  const serverButton = await screen.findByRole('button', { name: 'Mikhal' });
  serverButton.click();
  return screen.findByRole('heading', { name: 'Prix des ressources' });
}

function line(name: string): HTMLElement {
  return screen.getAllByText(name).map((element) => element.closest('.price-line')).find(Boolean) as HTMLElement;
}

describe('coût de craft des ressources intermédiaires (specs/015)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
    globalThis.indexedDB = new IDBFactory();
    getResourceRecipe.mockClear();
    chain.deep = false;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('counts a craftable ingredient at its recipe cost when that is cheaper (US1, scénario 1)', async () => {
    await openDagues({ '16489': 5000, '362': 100, '303': 200 });

    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent(n(`Coût de craft : ${verdictAmount(4300)}`)));
    const planche = line('Planche Agglomérée');
    expect(within(planche).getByText('Crafté')).toBeInTheDocument();
    expect(planche).toHaveTextContent(n(`Achat : ${formatKamas(5000)}`));
    expect(planche).toHaveTextContent(n(`Craft : ${formatKamas(2000)}`));
    // A plain resource shows no buy/craft indication at all.
    expect(within(line('Peau de Larve Bleue')).queryByText(/Acheté|Crafté/)).not.toBeInTheDocument();
  });

  it('keeps buying when the recipe costs more (US1, scénario 1 bis)', async () => {
    await openDagues({ '16489': 5000, '362': 100, '303': 600 });

    await waitFor(() => expect(within(line('Planche Agglomérée')).getByText('Acheté')).toBeInTheDocument());
    expect(screen.getByText(/Coût de craft/)).toHaveTextContent(n(`Coût de craft : ${verdictAmount(10300)}`));
  });

  it('unfolds a craftable ingredient into its recipe and prices a sub-resource from there (US2)', async () => {
    await openDagues({ '16489': 5000, '362': 100 });

    const toggle = await screen.findByRole('button', { name: 'Afficher la recette de Planche Agglomérée' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Afficher la recette de Peau/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Bois de Frêne')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Masquer la recette de Planche Agglomérée' })).toHaveAttribute('aria-expanded', 'true');
    const bois = line('Bois de Frêne');
    // 10 per plank × 2 planks.
    expect(bois).toHaveTextContent('× 20');

    const input = within(bois).getByPlaceholderText('Prix unitaire');
    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent(n(`Coût de craft : ${verdictAmount(4300)}`)));
    await waitFor(async () => expect((await prices.getMany('mikhal', ['303']))['303']?.unitPriceKamas).toBe(200));
    // The plank's carnet price is untouched: its recipe cost is never stored as a price (FR-008).
    expect((await prices.getMany('mikhal', ['16489']))['16489']?.unitPriceKamas).toBe(5000);
  });

  it('unfolds a sub-resource that crafts in turn (US2, third level)', async () => {
    chain.deep = true;
    await openDagues({ '16489': 5000, '362': 100, '999': 5 });

    fireEvent.click(await screen.findByRole('button', { name: 'Afficher la recette de Planche Agglomérée' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Afficher la recette de Bois de Frêne' }));
    // 2 per wood × 10 wood per plank × 2 planks.
    expect(line('Sève')).toHaveTextContent('× 40');
    // Sève 5 → Bois 10 → Planche 100 → 2 × 100 + 3 × 100.
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent(n(`Coût de craft : ${verdictAmount(500)}`)));
  });

  it('forces buying or crafting an ingredient, everywhere and across visits (US3)', async () => {
    await openDagues({ '16489': 5000, '362': 100, '303': 200 });
    await waitFor(() => expect(within(line('Planche Agglomérée')).getByText('Crafté')).toBeInTheDocument());

    const planche = line('Planche Agglomérée');
    expect(within(planche).getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(planche).getByRole('button', { name: 'Acheter' }));

    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent(n(`Coût de craft : ${verdictAmount(10300)}`)));
    expect(within(line('Planche Agglomérée')).getByText('Acheté')).toBeInTheDocument();
    expect(within(line('Planche Agglomérée')).getByText(/votre choix/)).toBeInTheDocument();
    expect(within(line('Planche Agglomérée')).getByRole('button', { name: 'Acheter' })).toHaveAttribute('aria-pressed', 'true');

    // Still forced after leaving and coming back.
    document.body.innerHTML = '';
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent(n(`Coût de craft : ${verdictAmount(10300)}`)));

    fireEvent.click(within(line('Planche Agglomérée')).getByRole('button', { name: 'Auto' }));
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent(n(`Coût de craft : ${verdictAmount(4300)}`)));
  });

  it('reports a forced option with no known value as a missing price, without switching to the other one (US3)', async () => {
    window.localStorage.setItem('craftcheck-ingredient-choices', JSON.stringify({ '16489': 'buy' }));
    await openDagues({ '362': 100, '303': 200 });

    // Wait until the recipe cost is actually known, so "missing" can't be a still-loading state.
    await waitFor(() => expect(line('Planche Agglomérée')).toHaveTextContent(n(`Craft : ${formatKamas(2000)}`)));
    expect(within(line('Planche Agglomérée')).getByText('Prix manquant')).toBeInTheDocument();
    expect(screen.getByText(/Coût de craft/)).toHaveTextContent('(partiel)');
  });

  it('unfolds the first craftable recipe during the tour step about it, then folds it back (specs/011 révision)', async () => {
    window.localStorage.removeItem('craftcheck-search-tour-seen');
    await openDagues({ '16489': 5000, '362': 100, '303': 200 });
    await screen.findByRole('button', { name: 'Afficher la recette de Planche Agglomérée' });
    const tour = () => screen.getByRole('dialog');
    const next = () => fireEvent.click(within(tour()).getByRole('button', { name: 'Suivant' }));

    for (let step = 1; step < 6; step += 1) next();
    expect(within(tour()).getByText('6 / 7')).toBeInTheDocument();
    expect(await screen.findByText('Bois de Frêne')).toBeInTheDocument();

    next();
    await waitFor(() => expect(screen.queryByText('Bois de Frêne')).not.toBeInTheDocument());
  });
});
