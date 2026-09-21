import { IDBFactory } from 'fake-indexeddb';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatKamas } from '../../src/domain/kamas';

// jest-dom normalizes the received text's whitespace (collapsing the narrow no-break space
// Intl.NumberFormat uses as a thousands separator into a plain space) but not the expected
// string, so the expectation needs the same normalization to compare equal.
const normalizeSpaces = (value: string) => value.replace(/ /g, ' ');

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: 'cat-1', label: 'Épées', sortOrder: 1, kind: 'Equipment', typeIds: [] },
  ]),
  searchItems: vi.fn().mockResolvedValue({
    data: [{ id: 'item-1', name: 'Épée Boueuse', level: 1, kind: 'Equipment', categoryId: 'cat-1' }],
    total: 1,
  }),
  getItemDetail: vi.fn().mockResolvedValue({
    recipe: { id: 'recipe-1', itemId: 'item-1', ingredients: [{ resourceId: 'resource-1', quantity: 2 }] },
    resources: [{ id: 'resource-1', name: 'Bois' }],
    stats: [],
  }),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({
    sourceName: 'test',
    sourceVersion: '1',
    catalogueVersion: '1',
    publishedAt: new Date().toISOString(),
  }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([
    { id: 'mikhal', name: 'Mikhal', type: 'mono' },
  ]),
}));

import App from '../../src/app/App';

describe('pinned items page shows craft cost and market price', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('flags unset prices, then shows them once the craft cost and the HDV price are filled in', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Épingler' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Épingler' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Désépingler' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));
    const card = (await screen.findByText('Épée Boueuse')).closest('.pinned-card') as HTMLElement;
    await waitFor(() => expect(within(card).getByText(/Craft :/)).toHaveTextContent('Craft : Non renseigné'));
    expect(within(card).getByText(/HDV :/)).toHaveTextContent('HDV : Non renseigné');

    fireEvent.click(screen.getByRole('link', { name: /Recherche/ }));
    const resourcePriceInput = await screen.findByPlaceholderText('Prix unitaire');
    fireEvent.change(resourcePriceInput, { target: { value: '1000' } });
    // Persistence only happens on blur (real navigation blurs the field the same way, since
    // focus moves to the clicked link) — not on every keystroke.
    fireEvent.blur(resourcePriceInput);
    fireEvent.change(screen.getByLabelText('Prix HDV'), { target: { value: '500000' } });
    await waitFor(() => expect(screen.getByLabelText('Prix HDV')).toHaveValue('500 000'));

    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));
    const updatedCard = (await screen.findByText('Épée Boueuse')).closest('.pinned-card') as HTMLElement;
    await waitFor(() =>
      expect(within(updatedCard).getByText(/Craft :/)).toHaveTextContent(normalizeSpaces(`Craft : ${formatKamas(2000)}`)),
    );
    expect(within(updatedCard).getByText(/HDV :/)).toHaveTextContent(normalizeSpaces(`HDV : ${formatKamas(500000)}`));

    // The craft cost (2 000) is far below the HDV price (500 000), so crafting is the more
    // profitable option: its price is highlighted green and the HDV price red.
    expect(within(updatedCard).getByText(/Craft :/)).toHaveClass('cheaper');
    expect(within(updatedCard).getByText(/HDV :/)).toHaveClass('pricier');
  });
});
