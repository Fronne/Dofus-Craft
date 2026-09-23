import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePinnedItems } from '../../src/features/catalogue/usePinnedItems';

const itemA = { id: 'a', name: 'Item A', kind: 'Equipment' as const, categoryId: 'cat-1' };
const itemB = { id: 'b', name: 'Item B', kind: 'Equipment' as const, categoryId: 'cat-1' };

// This project has no `renderHook` precedent (hooks are tested through the pages/components that
// consume them) — this minimal harness follows that same convention while still exercising
// `usePinnedItems`'s collection operations in isolation, ahead of any real page using them
// (specs/005-pinned-item-collections, Phase 2 Foundational).
function TestHarness() {
  const { pinnedItems, pin, assignCollection, renameCollection, deleteCollection } = usePinnedItems();
  return (
    <div>
      <button onClick={() => pin(itemA)}>pin-a</button>
      <button onClick={() => pin(itemB)}>pin-b</button>
      <button onClick={() => assignCollection('a', 'PvP')}>assign-a-PvP</button>
      <button onClick={() => assignCollection('b', 'pvp')}>assign-b-pvp-lowercase</button>
      <button onClick={() => assignCollection('a', '   ')}>assign-a-blank</button>
      <button onClick={() => renameCollection('PvP', 'Arene')}>rename-PvP-to-Arene</button>
      <button onClick={() => renameCollection('Arene', 'pvp')}>rename-Arene-to-existing-pvp</button>
      <button onClick={() => deleteCollection('PvP')}>delete-PvP</button>
      <ul>
        {pinnedItems.map((entry) => (
          <li key={entry.item.id}>{entry.item.id}:{entry.collectionName ?? 'none'}</li>
        ))}
      </ul>
    </div>
  );
}

describe('usePinnedItems collection operations (specs/005-pinned-item-collections)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('assigns a collection, reusing the existing casing for a case-insensitive match (FR-009)', () => {
    render(<TestHarness />);
    fireEvent.click(screen.getByText('pin-a'));
    fireEvent.click(screen.getByText('pin-b'));
    fireEvent.click(screen.getByText('assign-a-PvP'));
    fireEvent.click(screen.getByText('assign-b-pvp-lowercase'));

    expect(screen.getByText('a:PvP')).toBeInTheDocument();
    expect(screen.getByText('b:PvP')).toBeInTheDocument();
  });

  it('normalizes a blank name to "Sans collection" (absent)', () => {
    render(<TestHarness />);
    fireEvent.click(screen.getByText('pin-a'));
    fireEvent.click(screen.getByText('assign-a-PvP'));
    fireEvent.click(screen.getByText('assign-a-blank'));

    expect(screen.getByText('a:none')).toBeInTheDocument();
  });

  it('renameCollection reassigns every item currently in that collection (FR-006)', () => {
    render(<TestHarness />);
    fireEvent.click(screen.getByText('pin-a'));
    fireEvent.click(screen.getByText('pin-b'));
    fireEvent.click(screen.getByText('assign-a-PvP'));
    fireEvent.click(screen.getByText('assign-b-pvp-lowercase'));
    fireEvent.click(screen.getByText('rename-PvP-to-Arene'));

    expect(screen.getByText('a:Arene')).toBeInTheDocument();
    expect(screen.getByText('b:Arene')).toBeInTheDocument();
  });

  it('renameCollection onto an existing name (case-insensitive) merges both groups', () => {
    render(<TestHarness />);
    fireEvent.click(screen.getByText('pin-a'));
    fireEvent.click(screen.getByText('pin-b'));
    fireEvent.click(screen.getByText('assign-a-PvP')); // a -> PvP
    fireEvent.click(screen.getByText('rename-PvP-to-Arene')); // a -> Arene
    fireEvent.click(screen.getByText('assign-b-pvp-lowercase')); // no existing "pvp" left, becomes lowercase
    fireEvent.click(screen.getByText('rename-Arene-to-existing-pvp'));

    expect(screen.getByText('a:pvp')).toBeInTheDocument();
    expect(screen.getByText('b:pvp')).toBeInTheDocument();
  });

  it('deleteCollection moves its items to "Sans collection" without unpinning them (FR-007)', () => {
    render(<TestHarness />);
    fireEvent.click(screen.getByText('pin-a'));
    fireEvent.click(screen.getByText('assign-a-PvP'));
    fireEvent.click(screen.getByText('delete-PvP'));

    expect(screen.getByText('a:none')).toBeInTheDocument();
  });
});

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: 'cat-1', label: 'Équipements', sortOrder: 1, kind: 'Equipment', typeIds: [] },
  ]),
  searchItems: vi.fn().mockImplementation((query: string) => {
    const items = [
      { id: 'item-1', name: 'Épée Boueuse', level: 1, kind: 'Equipment', categoryId: 'cat-1' },
      { id: 'item-2', name: 'Amulette du Wa Wabbit', level: 5, kind: 'Equipment', categoryId: 'cat-1' },
    ];
    const filtered = query ? items.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())) : items;
    return Promise.resolve({ data: filtered, total: filtered.length });
  }),
  getItemDetail: vi.fn().mockResolvedValue({ recipe: undefined, resources: [], stats: [] }),
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
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';

async function pinItemByName(name: string) {
  const search = screen.getByLabelText(/Rechercher un objet/);
  fireEvent.change(search, { target: { value: name } });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
  fireEvent.click(await screen.findByRole('button', { name: 'Épingler' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Désépingler' })).toBeInTheDocument());
}

// jsdom has no full DataTransfer implementation — a minimal stand-in with the two methods
// EpinglesPage.tsx's drag handlers actually use (setData/getData) is enough to drive a
// drag-and-drop sequence in tests.
function makeDataTransfer() {
  const store: Record<string, string> = {};
  return {
    setData: (format: string, data: string) => {
      store[format] = data;
    },
    getData: (format: string) => store[format] ?? '',
    effectAllowed: '',
  };
}

function dropCardOnGroup(cardText: string, groupHeadingName: string) {
  const card = screen.getByText(cardText).closest('.pinned-card') as HTMLElement;
  const body = screen.getByRole('heading', { name: groupHeadingName })
    .closest('.pinned-collection')!
    .querySelector('.pinned-collection-body') as HTMLElement;
  const dataTransfer = makeDataTransfer();
  fireEvent.dragStart(card, { dataTransfer });
  fireEvent.dragOver(body, { dataTransfer });
  fireEvent.drop(body, { dataTransfer });
  fireEvent.dragEnd(card, { dataTransfer });
}

// Assumes it is called while already on the Épinglés page. Creation (the single page-level "+
// Nouvelle collection" button) and assignment (dragging the card onto the group, the only way to
// assign one on this page) are two separate steps now — this helper does both for convenience, and
// is safe to call again with a name that already exists (the underlying operation dedupes).
async function createCollectionForItem(itemName: string, collectionName: string) {
  fireEvent.click(await screen.findByRole('button', { name: '+ Nouvelle collection' }));
  fireEvent.change(screen.getByLabelText('Nom de la nouvelle collection'), { target: { value: collectionName } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer la collection' }));
  await screen.findByRole('heading', { name: collectionName });
  dropCardOnGroup(itemName, collectionName);
}

// specs/005-pinned-item-collections, User Story 1: grouping and a posteriori assignment on the
// real EpinglesPage.
describe('grouping pinned items by collection on EpinglesPage (specs/005-pinned-item-collections US1)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // specs/011-search-onboarding: these tests go through the Recherche page but aren't about its
    // guided tour, which would otherwise open on top of it.
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
    globalThis.indexedDB = new IDBFactory();
    // BrowserRouter reads from `window.location`, which otherwise carries over the previous test's
    // ending route (e.g. "/epingles") into this one's fresh `render(<App />)`.
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a collection via the single page-level button, visible immediately even with no items yet', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await pinItemByName('Épée Boueuse');
    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));

    fireEvent.click(await screen.findByRole('button', { name: '+ Nouvelle collection' }));
    fireEvent.change(screen.getByLabelText('Nom de la nouvelle collection'), { target: { value: 'Vide pour l\'instant' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la collection' }));

    const group = (await screen.findByRole('heading', { name: "Vide pour l'instant" })).closest('.pinned-collection') as HTMLElement;
    expect(within(group).getByText('Aucun objet dans cette collection pour le moment.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nom de la nouvelle collection')).not.toBeInTheDocument();
  });

  it('moves a card into another collection by dragging it there (drag-and-drop)', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await pinItemByName('Épée Boueuse');
    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));

    // Create the "PvP" collection without assigning anything to it yet, so the item starts out in
    // "Sans collection" and this test can exercise the drag itself moving it across.
    fireEvent.click(await screen.findByRole('button', { name: '+ Nouvelle collection' }));
    fireEvent.change(screen.getByLabelText('Nom de la nouvelle collection'), { target: { value: 'PvP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer la collection' }));
    await screen.findByRole('heading', { name: 'PvP' });

    dropCardOnGroup('Épée Boueuse', 'PvP');

    await waitFor(() => {
      const pvpGroup = screen.getByRole('heading', { name: 'PvP' }).closest('.pinned-collection') as HTMLElement;
      expect(within(pvpGroup).getByText('Épée Boueuse')).toBeInTheDocument();
    });
    // "Sans collection" had exactly one item, which just moved out — unlike a named collection, it
    // has no existence of its own and disappears entirely once empty (data-model.md).
    expect(screen.queryByRole('heading', { name: 'Sans collection' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Épée Boueuse')).toHaveLength(1);
  });

  it('shows every item under a single "Sans collection" group before any assignment (scenario 1)', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await pinItemByName('Épée Boueuse');
    await pinItemByName('Amulette du Wa Wabbit');

    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));

    expect(await screen.findByRole('heading', { name: 'Sans collection' })).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(1);
  });

  it('moves an assigned item into its own group, then groups a second item alongside it (scenarios 2-3)', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await pinItemByName('Épée Boueuse');
    await pinItemByName('Amulette du Wa Wabbit');
    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));

    await createCollectionForItem('Épée Boueuse', 'PvP');

    const pvpHeading = await screen.findByRole('heading', { name: 'PvP' });
    expect(within(pvpHeading.closest('.pinned-collection') as HTMLElement).getByText('Épée Boueuse')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'Sans collection' }).closest('.pinned-collection') as HTMLElement).getByText('Amulette du Wa Wabbit')).toBeInTheDocument();

    dropCardOnGroup('Amulette du Wa Wabbit', 'PvP');

    await waitFor(() => {
      const group = screen.getByRole('heading', { name: 'PvP' }).closest('.pinned-collection') as HTMLElement;
      expect(within(group).getByText('Épée Boueuse')).toBeInTheDocument();
      expect(within(group).getByText('Amulette du Wa Wabbit')).toBeInTheDocument();
    });
  });

  it('moves an item to a new collection and out of its previous one, never both at once (scenario 4, FR-008)', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await pinItemByName('Épée Boueuse');
    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));

    await createCollectionForItem('Épée Boueuse', 'PvP');
    await screen.findByRole('heading', { name: 'PvP' });

    await createCollectionForItem('Épée Boueuse', 'Set');

    // "PvP" stays visible (empty) — it was explicitly created and never deleted; only the item
    // itself moved. It no longer contains the item, only "Set" does (FR-008).
    const setGroup = (await screen.findByRole('heading', { name: 'Set' })).closest('.pinned-collection') as HTMLElement;
    expect(within(setGroup).getByText('Épée Boueuse')).toBeInTheDocument();
    const pvpGroup = screen.getByRole('heading', { name: 'PvP' }).closest('.pinned-collection') as HTMLElement;
    expect(within(pvpGroup).queryByText('Épée Boueuse')).not.toBeInTheDocument();
  });
});

// specs/005-pinned-item-collections, User Story 3: renaming/deleting a collection from its group
// heading on EpinglesPage.
describe('renaming or deleting a collection from its group heading (specs/005-pinned-item-collections US3)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
    globalThis.indexedDB = new IDBFactory();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renaming a collection keeps its items grouped together, now under the new name (scenario 1)', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await pinItemByName('Épée Boueuse');
    await pinItemByName('Amulette du Wa Wabbit');
    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));
    await createCollectionForItem('Épée Boueuse', 'PvP');
    await screen.findByRole('heading', { name: 'PvP' });
    dropCardOnGroup('Amulette du Wa Wabbit', 'PvP');
    await waitFor(() => expect(within(screen.getByRole('heading', { name: 'PvP' }).closest('.pinned-collection') as HTMLElement).getByText('Amulette du Wa Wabbit')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Renommer la collection PvP' }));
    fireEvent.change(screen.getByLabelText('Renommer la collection PvP'), { target: { value: 'Arène' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider le renommage' }));

    const renamed = (await screen.findByRole('heading', { name: 'Arène' })).closest('.pinned-collection') as HTMLElement;
    expect(within(renamed).getByText('Épée Boueuse')).toBeInTheDocument();
    expect(within(renamed).getByText('Amulette du Wa Wabbit')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'PvP' })).not.toBeInTheDocument();
  });

  it('renaming a collection to an existing other collection\'s exact name merges both groups (scenario 3, FR-009)', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await pinItemByName('Épée Boueuse');
    await pinItemByName('Amulette du Wa Wabbit');
    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));
    await createCollectionForItem('Épée Boueuse', 'PvP');
    await screen.findByRole('heading', { name: 'PvP' });
    await createCollectionForItem('Amulette du Wa Wabbit', 'Arène');
    await screen.findByRole('heading', { name: 'Arène' });

    fireEvent.click(screen.getByRole('button', { name: 'Renommer la collection Arène' }));
    fireEvent.change(screen.getByLabelText('Renommer la collection Arène'), { target: { value: 'PvP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider le renommage' }));

    await waitFor(() => expect(screen.queryAllByRole('heading', { level: 2, name: /PvP|Arène/ })).toHaveLength(1));
    const merged = screen.getByRole('heading', { name: 'PvP' }).closest('.pinned-collection') as HTMLElement;
    expect(within(merged).getByText('Épée Boueuse')).toBeInTheDocument();
    expect(within(merged).getByText('Amulette du Wa Wabbit')).toBeInTheDocument();
  });

  it('deleting a collection moves its items to "Sans collection", keeps them pinned, and removes the heading (scenario 2, FR-007)', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await pinItemByName('Épée Boueuse');
    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));
    await createCollectionForItem('Épée Boueuse', 'PvP');
    await screen.findByRole('heading', { name: 'PvP' });

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la collection PvP' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'PvP' })).not.toBeInTheDocument());
    const ungrouped = screen.getByRole('heading', { name: 'Sans collection' }).closest('.pinned-collection') as HTMLElement;
    expect(within(ungrouped).getByText('Épée Boueuse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Désépingler Épée Boueuse' })).toBeInTheDocument();
  });
});
