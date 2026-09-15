import { render, screen } from '@testing-library/react';
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
    expect(screen.getByLabelText('Niveau min')).toBeInTheDocument();
    expect(screen.getByLabelText('Niveau max')).toBeInTheDocument();
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
