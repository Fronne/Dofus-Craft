import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getItemDetail: vi.fn(),
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
import { applyDesign, getDesignId } from '../../src/persistence/design-preference';

async function openSettings() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
}

const root = () => document.documentElement;

describe('réglage Design (specs/012-modern-design)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
    delete root().dataset.design;
  });
  afterEach(() => {
    document.body.innerHTML = '';
    delete root().dataset.design;
  });

  it('offers Classique and Moderne, Moderne being active by default (FR-001, FR-004)', async () => {
    await openSettings();
    expect(await screen.findByRole('button', { name: 'Moderne' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Classique' })).toHaveAttribute('aria-pressed', 'false');
    expect(root().dataset.design).toBe('modern');
    expect(window.localStorage.getItem('craftcheck-design-choice')).toBeNull();
  });

  it('ignores a design saved under the former key, which may not have been a real choice', async () => {
    window.localStorage.setItem('craftcheck-design', 'classic');
    await openSettings();
    expect(await screen.findByRole('button', { name: 'Moderne' })).toHaveAttribute('aria-pressed', 'true');
    expect(root().dataset.design).toBe('modern');
  });

  it('switches to the new design immediately and remembers it (US1, FR-002)', async () => {
    window.localStorage.setItem('craftcheck-design-choice', 'classic');
    await openSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Moderne' }));
    expect(root().dataset.design).toBe('modern');
    expect(window.localStorage.getItem('craftcheck-design-choice')).toBe('modern');
    expect(screen.getByRole('button', { name: 'Moderne' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('goes back to the classic design in one click (US2)', async () => {
    await openSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Moderne' }));
    fireEvent.click(screen.getByRole('button', { name: 'Classique' }));
    expect(root().hasAttribute('data-design')).toBe(false);
    expect(window.localStorage.getItem('craftcheck-design-choice')).toBe('classic');
  });

  it('applies a remembered design before the app renders, as main.tsx does (US2, FR-003)', () => {
    window.localStorage.setItem('craftcheck-design-choice', 'modern');
    applyDesign(getDesignId());
    expect(root().dataset.design).toBe('modern');
  });
});
