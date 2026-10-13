import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemResults, RESULTS_MORE_STEP, RESULTS_PAGE_SIZE } from '../../src/features/catalogue/ItemResults';

describe('ItemResults controls', () => {
  afterEach(cleanup);

  // specs/051-site-visual-refresh (FR-018): what the Recherche page asks for before any « Afficher plus ».
  it('starts with a page of 6 results, then reveals 12 at a time', () => {
    expect(RESULTS_PAGE_SIZE).toBe(6);
    expect(RESULTS_MORE_STEP).toBe(12);
  });

  it('reveals 12 more results (after the first 6) from a button below the grid, next to how many are shown', () => {
    const setResultLimit = vi.fn();
    render(
      <ItemResults
        items={[{ id: '1', name: 'Item', level: 1, kind: 'Equipment', categoryId: 'equipment-type-1' }]}
        selected=""
        onSelect={vi.fn()}
        total={50}
        resultLimit={6}
        setResultLimit={setResultLimit}
      />,
    );

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('1 sur 50')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Afficher 12 de plus' }));
    expect(setResultLimit).toHaveBeenCalledWith(18);
    expect(screen.getByText('50 objets trouvés')).toBeInTheDocument();
  });

  it('hides the button once every result is shown', () => {
    render(
      <ItemResults
        items={[{ id: '1', name: 'Item', level: 1, kind: 'Equipment', categoryId: 'equipment-type-1' }]}
        selected=""
        onSelect={vi.fn()}
        total={1}
        resultLimit={6}
        setResultLimit={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /de plus/ })).not.toBeInTheDocument();
  });

  it('shows the item count even before any filter is applied', () => {
    // The catalogue is preloaded in the background from app start (App.tsx), so by the time
    // this renders, `total` reflects the real matching count rather than a capped preview —
    // safe to always show it as a number instead of a generic placeholder label.
    render(
      <ItemResults
        items={[{ id: '1', name: 'Item', level: 1, kind: 'Equipment', categoryId: 'equipment-type-1' }]}
        selected=""
        onSelect={vi.fn()}
        total={21}
        resultLimit={6}
        setResultLimit={vi.fn()}
      />,
    );

    expect(screen.getByText('21 objets trouvés')).toBeInTheDocument();
  });

  it('offers « Réduire » once more than one page is shown, going back to 6 results', () => {
    const setResultLimit = vi.fn();
    const items = Array.from({ length: 24 }, (_, index) => ({
      id: String(index), name: `Item ${index}`, level: 1, kind: 'Equipment' as const, categoryId: 'equipment-type-1',
    }));
    render(
      <ItemResults items={items} selected="" onSelect={vi.fn()} total={24} resultLimit={24} setResultLimit={setResultLimit} />,
    );

    // Everything is shown: no more to reveal, but still a way back to a short list.
    expect(screen.queryByRole('button', { name: /de plus/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réduire' }));
    expect(setResultLimit).toHaveBeenCalledWith(6);
  });

  it('does not offer « Réduire » on the first page', () => {
    render(
      <ItemResults
        items={[{ id: '1', name: 'Item', level: 1, kind: 'Equipment', categoryId: 'equipment-type-1' }]}
        selected=""
        onSelect={vi.fn()}
        total={50}
        resultLimit={6}
        setResultLimit={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Réduire' })).not.toBeInTheDocument();
  });
});
