import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    getItemEffectRanges.mockReset();
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
    expect(await screen.findByText(/12\D345/)).toBeInTheDocument();
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
    expect(await screen.findByText('Rentable avec un focus Do')).toBeInTheDocument();
    expect(screen.getByText("Sans focus, rentable jusqu'à").nextElementSibling).toHaveTextContent('%');
    expect(screen.getByText('Brisages possibles avant ce seuil').nextElementSibling).toHaveTextContent(/^\d+$/);
    // The best focus is highlighted on its line, with the rune icon and the kamas icon of the site.
    const best = screen.getByText('Meilleur focus').closest('tr')!;
    expect(best).toHaveTextContent('Dommages');
    expect(best.querySelector('img[src*="78015"]')).not.toBeNull();
    expect(document.querySelector('img.kamas-amount-icon')).not.toBeNull();
  });

  it('says to break normally, with no highlighted line, when no focus pays more', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    // At 100 % the normal breaking keeps every line whole: a focus cannot beat it.
    fireEvent.change(await screen.findByLabelText(/Coefficient relevé en jeu/), { target: { value: '100' } });
    expect(await screen.findByText('Rentable sans focus')).toBeInTheDocument();
    expect(screen.getByText(/Le focus ne rapporte pas plus/)).toBeInTheDocument();
    expect(screen.queryByText('Meilleur focus')).not.toBeInTheDocument();
    // The gain strip keeps « actuel » on the 100 % point, with the break-even point.
    expect(screen.getByText(/à 100 % · actuel/)).toBeInTheDocument();
    expect(screen.getByText(/· seuil/)).toBeInTheDocument();
  });

  it('accepts a coefficient above 100 %', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    const input = await screen.findByLabelText(/Coefficient relevé en jeu/);
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);
    expect(await screen.findByText(/Dernier coefficient/)).toHaveTextContent('150 %');
    expect(await screen.findByText(/Rentable/)).toBeInTheDocument();
    expect(screen.getByText(/à 150 % · actuel/)).toBeInTheDocument();
  });

  it('brings back the item, the typed coefficient and the typed rolls after a reload', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient relevé en jeu/), { target: { value: '60' } });
    await screen.findByLabelText('Jet de Vitalité');
    type('Jet de Vitalité', '44');
    cleanup();
    // The server is remembered: the page opens straight on Brisage.
    render(<App />);
    await screen.findByRole('heading', { name: 'Brisage' });
    expect(await screen.findByText(/Cape du Chef Bwork/)).toBeInTheDocument();
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
    fireEvent.change(await screen.findByLabelText(/Coefficient relevé en jeu/), { target: { value: '50' } });
    expect(await screen.findAllByLabelText('Jet de Vitalité')).toHaveLength(1);
    expect(field('Jet de Vitalité').placeholder).toBe('42');
  });

  it('flags a negative roll and keeps the average', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient relevé en jeu/), { target: { value: '50' } });
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
    const input = await screen.findByLabelText(/Coefficient relevé en jeu/);
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

  it('starts each line at its average roll and lets a roll be typed', async () => {
    await pinnedItemPrices.save('mikhal', '777', 1000);
    await pricesKnown();
    await openBrisage();
    await pickCape();
    fireEvent.change(await screen.findByLabelText(/Coefficient relevé en jeu/), { target: { value: '50' } });
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
    fireEvent.change(await screen.findByLabelText(/Coefficient relevé en jeu/), { target: { value: '50' } });
    await screen.findByLabelText('Jet de Vitalité');
    // Vitalité 40–44 and Dommages 1–9 are free; Chance (38) is fixed: no field, no switch effect.
    expect(screen.queryByLabelText('Jet de Chance')).not.toBeInTheDocument();
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
