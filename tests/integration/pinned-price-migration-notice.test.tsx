import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PinnedPriceMigrationNotice } from '../../src/features/server/PinnedPriceMigrationNotice';

const item = {
  id: '1',
  name: 'Amulette du Bouftou',
  kind: 'Equipment' as const,
  categoryId: 'equipment-type-1',
};

describe('PinnedPriceMigrationNotice', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a dismissible warning when a legacy unscoped marketPrice is detected', () => {
    window.localStorage.setItem(
      'craftcheck-pinned-items',
      JSON.stringify([{ item, marketPrice: '125000' }]),
    );

    render(<PinnedPriceMigrationNotice />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });

  it('renders nothing when no legacy marketPrice is detected', () => {
    window.localStorage.setItem('craftcheck-pinned-items', JSON.stringify([{ item }]));

    render(<PinnedPriceMigrationNotice />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays dismissed after being closed once', () => {
    window.localStorage.setItem(
      'craftcheck-pinned-items',
      JSON.stringify([{ item, marketPrice: '125000' }]),
    );

    render(<PinnedPriceMigrationNotice />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
