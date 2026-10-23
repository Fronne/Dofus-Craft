import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDofusTheme } from '../../src/app/useDofusTheme';
import { ParametresPage } from '../../src/features/settings/ParametresPage';

// specs/074-dofus-color-themes (US1, US2, US3): the six Dofus of Paramètres give the site its colors.
function Harness() {
  const [dofus, setDofus] = useDofusTheme();
  return <ParametresPage theme="dark" setTheme={vi.fn()} dofus={dofus} setDofus={setDofus} priceMode="personal" setPriceMode={vi.fn()} />;
}

describe('Paramètres : choix du Dofus (specs/074)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.dofus;
    document.head.innerHTML = '<link rel="icon" href="/dofus-emeraude.png"><meta name="theme-color" content="#08181c">';
  });
  afterEach(cleanup);

  const names = ['Dofus Émeraude', 'Dofus Pourpre', 'Dofus Turquoise', 'Dofus Ocre', 'Dofus Ébène', 'Dofus Ivoire'];

  it('shows the six Dofus in order, the emerald being the active one', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Dofus' })).toBeInTheDocument();
    const buttons = names.map((name) => screen.getByRole('button', { name }));
    buttons.forEach((button, index) => expect(button).toHaveAttribute('aria-pressed', index === 0 ? 'true' : 'false'));
    expect(document.documentElement.dataset.dofus).toBeUndefined();
  });

  it('applies the clicked Dofus to the page, the tab icon and the address bar, and remembers it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Dofus Ocre' }));
    expect(screen.getByRole('button', { name: 'Dofus Ocre' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dofus Émeraude' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.dataset.dofus).toBe('ocre');
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/dofus-ocre.png');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#18120c');
    expect(window.localStorage.getItem('craftcheck-dofus')).toBe('ocre');
  });

  it('goes back to the emerald without leaving an attribute behind', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Dofus Pourpre' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dofus Émeraude' }));
    expect(document.documentElement.dataset.dofus).toBeUndefined();
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/dofus-emeraude.png');
  });

  it('opens on the remembered Dofus, and on the emerald when the memory is nonsense', () => {
    window.localStorage.setItem('craftcheck-dofus', 'turquoise');
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Dofus Turquoise' })).toHaveAttribute('aria-pressed', 'true');
    cleanup();
    window.localStorage.setItem('craftcheck-dofus', 'n-importe-quoi');
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Dofus Émeraude' })).toHaveAttribute('aria-pressed', 'true');
  });
});
