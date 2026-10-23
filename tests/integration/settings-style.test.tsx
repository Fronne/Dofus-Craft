import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParametresPage } from '../../src/features/settings/ParametresPage';

// specs/051-site-visual-refresh (US5): one style for everyone — Paramètres no longer offers a
// design nor an accent color, and keeps its other settings.
describe('Paramètres sans réglage de design ni d’accent (specs/051)', () => {
  afterEach(cleanup);

  function open(setTheme = vi.fn()) {
    render(<ParametresPage theme="dark" setTheme={setTheme} dofus="emeraude" setDofus={vi.fn()} priceMode="personal" setPriceMode={vi.fn()} />);
    return setTheme;
  }

  it('offers neither a design nor an accent color', () => {
    open();
    expect(screen.queryByRole('heading', { name: /design/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /couleur/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /classique|moderne/i })).not.toBeInTheDocument();
  });

  it('still offers the theme and the price mode', () => {
    const setTheme = open();
    expect(screen.getByRole('heading', { name: 'Thème' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gestion des prix' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mode personnel/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Thème clair' }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
