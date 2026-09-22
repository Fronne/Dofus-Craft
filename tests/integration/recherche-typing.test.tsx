import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

const searchItems = vi.fn();
const getItemDetail = vi.fn();
const getCategories = vi.fn();

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: (...args: unknown[]) => getCategories(...args),
  searchItems: (...args: unknown[]) => searchItems(...args),
  getItemDetail: (...args: unknown[]) => getItemDetail(...args),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({
    sourceName: 'test',
    sourceVersion: '1',
    catalogueVersion: '1',
    publishedAt: new Date().toISOString(),
  }),
}));

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  submitCommunityPrice: vi.fn(),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';

async function selectServerAndGoToSearch() {
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
}

describe('saisie dans le champ de recherche sans perte de caractère (regression)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getCategories.mockResolvedValue([{ id: 'cat-1', label: 'Épées', sortOrder: 1, kind: 'Equipment', typeIds: [] }]);
    getItemDetail.mockResolvedValue({ recipe: undefined, resources: [], stats: [] });
    // Each partial query returns a *different* single item, so every debounced search resolution
    // changes `catalogue.items` and makes RecherchePage's "auto-select the first result" effect
    // fire a `setSelected` (a second, concurrent URL update) — the exact condition that used to
    // silently drop a character typed right around then (see RecherchePage.tsx's `query` comment
    // and specs/010-search-instant-cache's follow-up fix; reproduced live via
    // `npm run dev` + Playwright before this fix, 4-7 mismatches per 60 typed words).
    searchItems.mockImplementation((query: string) =>
      Promise.resolve({
        total: 1,
        limit: 12,
        skip: 0,
        data: [{ id: `item-${query}`, name: `Objet ${query}`, level: 1, kind: 'Equipment' as const, categoryId: 'cat-1' }],
      }),
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('keeps every typed character, even when a search result update lands between two keystrokes', async () => {
    const { unmount } = render(<App />);
    await selectServerAndGoToSearch();

    const input = screen.getByPlaceholderText(/rechercher/i) as HTMLInputElement;
    const word = 'fosse';
    for (const char of word) {
      // Reads the DOM's own current value first, exactly like a real browser's native input does
      // on every keystroke — independent of whatever React's own controlled `value` prop currently
      // shows, so this only passes if the field never got silently reset to a stale value.
      const current = input.value;
      fireEvent.change(input, { target: { value: current + char } });
      // Give the debounced search (250ms) and the resulting auto-select effect enough room to
      // resolve and race with the next keystroke, matching a user typing with small pauses.
      await new Promise((resolve) => setTimeout(resolve, 260));
    }

    await waitFor(() => expect(input).toHaveValue(word));

    unmount();
  });
});
