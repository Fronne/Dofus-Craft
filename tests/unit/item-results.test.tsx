import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemResults, RESULTS_MORE_STEP, RESULTS_PAGE_SIZE } from '../../src/features/catalogue/ItemResults';

const oneItem = [{ id: '1', name: 'Item', level: 12, kind: 'Equipment' as const, categoryId: 'equipment-type-1' }];

describe('ItemResults carousel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // specs/051-site-visual-refresh (FR-018): what the Recherche page asks for before more results are brought in.
  it('starts with a page of 6 results, then brings in 12 at a time', () => {
    expect(RESULTS_PAGE_SIZE).toBe(6);
    expect(RESULTS_MORE_STEP).toBe(12);
  });

  it('draws each result as a card with its name and level, in a horizontal list', () => {
    render(<ItemResults items={oneItem} selected="" onSelect={vi.fn()} total={1} resultLimit={6} setResultLimit={vi.fn()} />);

    const list = screen.getByRole('list', { name: 'Objets trouvés' });
    expect(list).toContainElement(screen.getByRole('button', { name: /Item/ }));
    expect(screen.getByText('Niveau 12')).toBeInTheDocument();
  });

  it('has no « Afficher plus » nor « Réduire » button any more', () => {
    render(<ItemResults items={oneItem} selected="" onSelect={vi.fn()} total={50} resultLimit={6} setResultLimit={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /de plus/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réduire' })).not.toBeInTheDocument();
    expect(screen.getByText('50 objets trouvés')).toBeInTheDocument();
  });

  it('asks for 12 more results when the cards all fit without scrolling and more exist', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(800);
    const setResultLimit = vi.fn();
    render(<ItemResults items={oneItem} selected="" onSelect={vi.fn()} total={50} resultLimit={6} setResultLimit={setResultLimit} />);

    expect(setResultLimit).toHaveBeenCalledWith(18);
  });

  it('asks for nothing once every result is shown', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(800);
    const setResultLimit = vi.fn();
    render(<ItemResults items={oneItem} selected="" onSelect={vi.fn()} total={1} resultLimit={6} setResultLimit={setResultLimit} />);

    expect(setResultLimit).not.toHaveBeenCalled();
  });

  it('shows the item count even before any filter is applied', () => {
    // The catalogue is preloaded in the background from app start (App.tsx), so by the time
    // this renders, `total` reflects the real matching count rather than a capped preview —
    // safe to always show it as a number instead of a generic placeholder label.
    render(<ItemResults items={oneItem} selected="" onSelect={vi.fn()} total={21} resultLimit={6} setResultLimit={vi.fn()} />);

    expect(screen.getByText('21 objets trouvés')).toBeInTheDocument();
  });
});
