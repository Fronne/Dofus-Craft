import { IDBFactory } from 'fake-indexeddb';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LatestItemPriceLookup } from '../../src/services/community-price-api';

// specs/016: Dagues de Fouraille (208), one plain resource so the comparison can be complete.
const { getLatestItemPrice, submitCommunityPrice, getCommunityPrice } = vi.hoisted(() => ({
  getLatestItemPrice: vi.fn<(itemId: string, serverId: string) => Promise<LatestItemPriceLookup>>(),
  submitCommunityPrice: vi.fn<(resourceId: string, serverId: string, amountKamas: number, kind?: 'item') => Promise<{ id: string } | undefined>>(),
  getCommunityPrice: vi.fn(),
}));

vi.mock('../../src/services/community-price-api', () => ({
  getLatestItemPrice: (itemId: string, serverId: string) => getLatestItemPrice(itemId, serverId),
  submitCommunityPrice: (resourceId: string, serverId: string, amountKamas: number, kind?: 'item') =>
    submitCommunityPrice(resourceId, serverId, amountKamas, kind),
  getCommunityPrice: (...args: unknown[]) => getCommunityPrice(...args),
  getCommunityPrices: async (ids: string[], serverId: string) => {
    const results = await Promise.all(ids.map((id) => getCommunityPrice(id, serverId) as Promise<{ status: string; price?: unknown }>));
    if (results.some((result) => !result || result.status === 'unavailable')) return { status: 'unavailable' };
    return { status: 'found', prices: results.flatMap((result) => (result.status === 'found' ? [result.price] : [])) };
  },
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'cat-1', label: 'Dagues', sortOrder: 1, kind: 'Equipment', typeIds: [] }]),
  searchItems: vi.fn().mockResolvedValue({ data: [{ id: '208', name: 'Dagues de Fouraille', level: 13, kind: 'Equipment', categoryId: 'cat-1' }], total: 1 }),
  getItemDetail: vi.fn().mockResolvedValue({
    recipe: { id: '208', itemId: '208', ingredients: [{ resourceId: '362', quantity: 3 }] },
    resources: [{ id: '362', name: 'Peau de Larve Bleue', craftable: false }],
    stats: [],
  }),
  getResourceRecipe: vi.fn().mockResolvedValue(null),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';
import { pinnedItemPrices } from '../../src/persistence/indexeddb-pinned-item-price-repository';

const found = (amountKamas: number, contributedAt = new Date().toISOString()): LatestItemPriceLookup =>
  ({ status: 'found', price: { itemId: '208', serverId: 'mikhal', amountKamas, contributedAt } });

async function openDagues() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  return screen.findByLabelText('Prix HDV');
}

const hdvRow = () => screen.getByLabelText('Prix HDV').closest('.verdict-market-field') as HTMLElement;

describe('prix HDV partagé en Mode communautaire (specs/016)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('craftcheck-price-mode-choice', 'community');
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
    globalThis.indexedDB = new IDBFactory();
    getLatestItemPrice.mockReset();
    submitCommunityPrice.mockReset();
    getCommunityPrice.mockReset();
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('pre-fills the HDV field with the latest shared price, locked, with its date and no contribution count (US1)', async () => {
    getLatestItemPrice.mockResolvedValue(found(6000));
    const input = await openDagues();
    await waitFor(() => expect(input).toHaveValue('6 000'));
    expect(input).not.toHaveAttribute('readonly');
    expect(within(hdvRow()).queryByRole('button', { name: 'Modifier ce prix' })).not.toBeInTheDocument();
    expect(hdvRow()).toHaveTextContent(/Dernière mise à jour/);
    expect(hdvRow()).not.toHaveTextContent(/contribution/);
  });

  it('leaves the field empty and editable when nothing was shared (US1)', async () => {
    getLatestItemPrice.mockResolvedValue({ status: 'not-found' });
    const input = await openDagues();
    await waitFor(() => expect(getLatestItemPrice).toHaveBeenCalled());
    expect(input).toHaveValue('');
    expect(input).not.toHaveAttribute('readonly');
  });

  it('keeps Mode personnel exactly as before: local price, no lock, no date, nothing shared (FR-010)', async () => {
    window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
    await pinnedItemPrices.save('mikhal', '208', 4500);
    const input = await openDagues();
    await waitFor(() => expect(input).toHaveValue('4 500'));
    expect(input).not.toHaveAttribute('readonly');
    expect(hdvRow()).not.toHaveTextContent(/Dernière mise à jour/);
    expect(getLatestItemPrice).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(submitCommunityPrice).not.toHaveBeenCalled();
  });

  it('shares a typed price as an item and shows it as just updated (US2)', async () => {
    getLatestItemPrice.mockResolvedValueOnce({ status: 'not-found' }).mockResolvedValue(found(7000));
    submitCommunityPrice.mockResolvedValue({ id: 'c1' });
    const input = await openDagues();
    await waitFor(() => expect(getLatestItemPrice).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: '7000' } });
    fireEvent.blur(input);
    await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalledWith('208', 'mikhal', 7000, 'item'));
    await waitFor(() => expect(hdvRow()).toHaveTextContent('Dernière mise à jour : maintenant'));
    expect(input).not.toHaveAttribute('readonly');
  });

  it('shares nothing when the edit button is used and the field left unchanged (US2, FR-005)', async () => {
    getLatestItemPrice.mockResolvedValue(found(6000));
    const input = await openDagues();
    await waitFor(() => expect(input).toHaveValue('6 000'));
    fireEvent.blur(input);
    fireEvent.doubleClick(input);
    fireEvent.blur(input);
    expect(submitCommunityPrice).not.toHaveBeenCalled();
  });

  it('keeps a typed price shown and used when the service cannot be reached (US2, FR-011)', async () => {
    getLatestItemPrice.mockResolvedValue({ status: 'not-found' });
    submitCommunityPrice.mockResolvedValue(undefined);
    const input = await openDagues();
    await waitFor(() => expect(getLatestItemPrice).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: '7000' } });
    fireEvent.blur(input);
    await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalled());
    expect(input).toHaveValue('7 000');
    // The comparison uses it: it no longer says the HDV price is missing.
    expect(document.querySelector('.verdict')).not.toHaveTextContent(/prix HDV n.est pas renseigné/);
  });

  it('asks for confirmation beyond 50 % of the latest price; canceling shares nothing and puts it back (US3)', async () => {
    getLatestItemPrice.mockResolvedValue(found(10000, '2026-09-20T10:00:00.000Z'));
    submitCommunityPrice.mockResolvedValue({ id: 'c1' });
    const input = await openDagues();
    await waitFor(() => expect(input).toHaveValue('10 000'));

    fireEvent.change(input, { target: { value: '100000' } });
    fireEvent.blur(input);
    const dialog = await screen.findByRole('dialog', { hidden: true });
    expect(dialog).toHaveTextContent(/Dernier prix : 10\s000 kamas/);
    expect(dialog).toHaveTextContent(/Votre prix : 100\s000 kamas/);
    expect(dialog).toHaveTextContent(/Écart : 900\s%/);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler', hidden: true }));
    await waitFor(() => expect(input).toHaveValue('10 000'));
    expect(submitCommunityPrice).not.toHaveBeenCalled();
    expect(hdvRow()).not.toHaveTextContent('maintenant');
  });

  it('shares after confirmation, and asks nothing for a usual change or a first price (US3)', async () => {
    getLatestItemPrice.mockResolvedValue(found(10000));
    submitCommunityPrice.mockResolvedValue({ id: 'c1' });
    const input = await openDagues();
    await waitFor(() => expect(input).toHaveValue('10 000'));

    fireEvent.change(input, { target: { value: '14000' } });
    fireEvent.blur(input);
    await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalledWith('208', 'mikhal', 14000, 'item'));
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: '100000' } });
    fireEvent.blur(input);
    const dialog = await screen.findByRole('dialog', { hidden: true });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer quand même', hidden: true }));
    await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalledWith('208', 'mikhal', 100000, 'item'));
  });

  it('keeps a price just shared when re-reading the latest price fails right after (bug: field reset)', async () => {
    getLatestItemPrice.mockResolvedValueOnce({ status: 'not-found' }).mockResolvedValue({ status: 'unavailable' });
    submitCommunityPrice.mockResolvedValue({ id: 'c1' });
    const input = await openDagues();
    await waitFor(() => expect(getLatestItemPrice).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: '7000' } });
    fireEvent.blur(input);
    await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalled());
    await waitFor(() => expect(getLatestItemPrice).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(input).toHaveValue('7 000');
    expect(hdvRow()).toHaveTextContent('Dernière mise à jour : maintenant');
  });

  it('keeps a typed value when a background refresh cannot reach the service', async () => {
    getLatestItemPrice.mockResolvedValue({ status: 'unavailable' });
    submitCommunityPrice.mockResolvedValue(undefined);
    const input = await openDagues();
    await waitFor(() => expect(getLatestItemPrice).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: '7000' } });
    fireEvent.blur(input);
    await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(input).toHaveValue('7 000');
  });

  it('never carries the previous item price over to another item while the service is unreachable', async () => {
    const { searchItems } = await import('../../src/data/catalogue-repository');
    vi.mocked(searchItems).mockResolvedValue({ data: [
      { id: '208', name: 'Dagues de Fouraille', level: 13, kind: 'Equipment', categoryId: 'cat-1' },
      { id: '209', name: 'Épée de Test', level: 13, kind: 'Equipment', categoryId: 'cat-1' },
    ], total: 2, limit: 12, skip: 0 });
    getLatestItemPrice.mockImplementation(async (itemId) => (itemId === '208' ? found(6000) : { status: 'unavailable' }));
    const input = await openDagues();
    await waitFor(() => expect(input).toHaveValue('6 000'));
    fireEvent.click(screen.getByRole('button', { name: /Épée de Test/ }));
    await waitFor(() => expect(getLatestItemPrice).toHaveBeenCalledWith('209', 'mikhal'));
    await waitFor(() => expect(screen.getByLabelText('Prix HDV')).toHaveValue(''));
  });
});
