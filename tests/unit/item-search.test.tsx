import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemSearch } from '../../src/features/catalogue/ItemSearch';

describe('ItemSearch result limit', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the primary search and level filters', () => {
    render(
      <ItemSearch
        query=""
        setQuery={vi.fn()}
        category=""
        setCategory={vi.fn()}
        levelMin=""
        setLevelMin={vi.fn()}
        levelMax=""
        setLevelMax={vi.fn()}
        onReset={vi.fn()}
        categories={[]}
      />,
    );

    expect(screen.getByPlaceholderText('Rechercher un objet ou une panoplie...')).toBeInTheDocument();
    expect(screen.getByLabelText('Niveau min')).toHaveValue('1');
    expect(screen.getByLabelText('Niveau max')).toHaveValue('200');
    expect(screen.getByText('Tous les niveaux')).toBeInTheDocument();
  });

  it('commits the level range once a handle stops moving, leaving a bound at its end empty', () => {
    vi.useFakeTimers();
    const setLevelMin = vi.fn();
    const setLevelMax = vi.fn();
    render(
      <ItemSearch
        query=""
        setQuery={vi.fn()}
        category=""
        setCategory={vi.fn()}
        levelMin=""
        setLevelMin={setLevelMin}
        levelMax=""
        setLevelMax={setLevelMax}
        onReset={vi.fn()}
        categories={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Niveau min'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Niveau min'), { target: { value: '60' } });
    expect(screen.getByText('60 – 200')).toBeInTheDocument();
    expect(setLevelMin).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(250));
    expect(setLevelMin).toHaveBeenCalledTimes(1);
    expect(setLevelMin).toHaveBeenCalledWith('60');
    expect(setLevelMax).toHaveBeenCalledWith('');
    vi.useRealTimers();
  });

  it('never lets the min handle go past the max one', () => {
    render(
      <ItemSearch
        query=""
        setQuery={vi.fn()}
        category=""
        setCategory={vi.fn()}
        levelMin="50"
        setLevelMin={vi.fn()}
        levelMax="100"
        setLevelMax={vi.fn()}
        onReset={vi.fn()}
        categories={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Niveau min'), { target: { value: '150' } });
    expect(screen.getByLabelText('Niveau min')).toHaveValue('100');
    expect(screen.getByText('Niveau 100')).toBeInTheDocument();
  });

  it('shows reset only when a filter is active', () => {
    render(
      <ItemSearch
        query="strigide"
        setQuery={vi.fn()}
        category=""
        setCategory={vi.fn()}
        levelMin=""
        setLevelMin={vi.fn()}
        levelMax=""
        setLevelMax={vi.fn()}
        onReset={vi.fn()}
        categories={[]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Réinitialiser les filtres' })).toBeInTheDocument();
  });
});
