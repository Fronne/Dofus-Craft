import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PriceUpdateNote } from '../../src/components/PriceUpdateNote';

// specs/082-auteur-prix-communautaires: the line under a community price.
afterEach(cleanup);
const recent = new Date(Date.now() - 20_000).toISOString();

describe('PriceUpdateNote', () => {
  it('tells the author and when', () => {
    render(<PriceUpdateNote date={recent} author="Cyril" />);
    expect(screen.getByText('Dernière mise à jour : par Cyril · il y a quelques instants')).toBeInTheDocument();
  });

  it('tells only when without an author', () => {
    render(<PriceUpdateNote date={recent} />);
    expect(screen.getByText('Dernière mise à jour : il y a quelques instants')).toBeInTheDocument();
  });

  it('gives the exact date to a touch screen or a screen reader, with the author', () => {
    render(<PriceUpdateNote date="2026-11-02T10:00:00.000Z" author="Cyril" />);
    const note = screen.getByLabelText(/^Dernière mise à jour : par Cyril, /);
    expect(note).toHaveAttribute('tabindex', '0');
    expect(note).toHaveAttribute('title');
  });
});
