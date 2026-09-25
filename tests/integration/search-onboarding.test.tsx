import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

const SEEN_KEY = 'craftcheck-search-tour-seen';

async function openSearchPage() {
  const view = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  return view;
}

function tour() {
  return screen.getByRole('dialog', { name: /./ });
}

function clickTourButton(name: string) {
  fireEvent.click(within(tour()).getByRole('button', { name }));
}

describe('onboarding de la page Recherche (specs/011-search-onboarding)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getCategories.mockResolvedValue([]);
    getItemDetail.mockResolvedValue({ recipe: undefined, resources: [], stats: [] });
    searchItems.mockResolvedValue({ total: 0, limit: 12, skip: 0, data: [] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('starts automatically on a first visit, at step 1 of 7 (FR-001, FR-006)', async () => {
    await openSearchPage();
    expect(within(tour()).getByText('1 / 7')).toBeInTheDocument();
    expect(within(tour()).getByText('Rechercher un objet')).toBeInTheDocument();
  });

  it('moves forward and back, with no "Précédent" on the first step (FR-005)', async () => {
    await openSearchPage();
    expect(within(tour()).queryByRole('button', { name: 'Précédent' })).not.toBeInTheDocument();
    clickTourButton('Suivant');
    expect(within(tour()).getByText('2 / 7')).toBeInTheDocument();
    clickTourButton('Précédent');
    expect(within(tour()).getByText('1 / 7')).toBeInTheDocument();
  });

  it('closes on "Terminer" at the last step and remembers it (US1 scenario 3)', async () => {
    await openSearchPage();
    for (let step = 1; step < 7; step += 1) clickTourButton('Suivant');
    expect(within(tour()).getByText('7 / 7')).toBeInTheDocument();
    clickTourButton('Terminer');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SEEN_KEY)).toBe('1');
  });

  it('closes on "Passer" and remembers it', async () => {
    await openSearchPage();
    clickTourButton('Suivant');
    clickTourButton('Passer');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SEEN_KEY)).toBe('1');
  });

  it('closes on Escape and remembers it (US1 scenario 4)', async () => {
    await openSearchPage();
    act(() => {
      tour().dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SEEN_KEY)).toBe('1');
  });

  it('does not start again once seen', async () => {
    window.localStorage.setItem(SEEN_KEY, '1');
    await openSearchPage();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('explains missing areas when no item is selected instead of pointing at nothing (FR-008)', async () => {
    await openSearchPage();
    clickTourButton('Suivant');
    expect(await within(tour()).findByText('Cette zone apparaît après avoir choisi un objet craftable.')).toBeInTheDocument();
    clickTourButton('Suivant');
    clickTourButton('Suivant');
    expect(await within(tour()).findByText('Cette zone apparaît après avoir choisi un objet.')).toBeInTheDocument();
  });

  it('is not remembered as seen when the player leaves the page mid-tour', async () => {
    const { unmount } = await openSearchPage();
    clickTourButton('Suivant');
    unmount();
    expect(window.localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  it('never sends anything to the network while it runs (FR-009, FR-010)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchSpy);
    await openSearchPage();
    const callsBefore = fetchSpy.mock.calls.length;
    for (let step = 1; step < 7; step += 1) clickTourButton('Suivant');
    clickTourButton('Terminer');
    expect(fetchSpy.mock.calls.length).toBe(callsBefore);
  });

  it('reopens at step 1 from the help button, even once seen (US2, FR-007)', async () => {
    window.localStorage.setItem(SEEN_KEY, '1');
    await openSearchPage();
    const help = screen.getByRole('button', { name: 'Comment fonctionne cette page ?' });
    fireEvent.click(help);
    expect(within(tour()).getByText('1 / 7')).toBeInTheDocument();
    clickTourButton('Suivant');
    clickTourButton('Suivant');
    clickTourButton('Passer');
    fireEvent.click(help);
    expect(within(tour()).getByText('1 / 7')).toBeInTheDocument();
  });
});
