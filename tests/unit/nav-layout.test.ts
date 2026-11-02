import { describe, expect, it } from 'vitest';
import { groupKey, layoutNav, type LayoutItem } from '../../src/app/nav-layout';

const ITEMS: LayoutItem[] = [
  { to: '/', priority: 10 },
  { to: '/suivis', priority: 8 },
  { to: '/rentabilite', priority: 9 },
  { to: '/hdv', priority: 7, group: 'market' },
  { to: '/familier', priority: 4, group: 'tools' },
  { to: '/brisage', priority: 5, group: 'tools' },
  { to: '/bons-plans', priority: 6, group: 'market' },
];
// Every link is 100 wide, every menu 100 wide, no gap.
const WIDTHS: Record<string, number> = Object.fromEntries([
  ...ITEMS.map((item) => [item.to, 100]),
  [groupKey('market'), 100],
  [groupKey('tools'), 100],
]);
const layout = (room: number, extra: Partial<Parameters<typeof layoutNav>[0]> = {}) =>
  [...layoutNav({ items: ITEMS, widths: WIDTHS, room, gap: 0, moreWidth: 100, compact: false, ...extra })].sort();

describe('layoutNav', () => {
  it('shows every link and the Outils menu when the bar has room', () => {
    expect(layout(600)).toEqual(['/', '/bons-plans', '/hdv', '/rentabilite', '/suivis', groupKey('tools')].sort());
  });

  it('never shows the Outils pages as links', () => {
    expect(layout(10_000)).not.toContain('/familier');
    expect(layout(10_000)).not.toContain('/brisage');
  });

  it('groups HDV and Bons plans under Marché when the links do not fit', () => {
    expect(layout(500)).toEqual(['/', '/rentabilite', '/suivis', groupKey('market'), groupKey('tools')].sort());
  });

  it('sends the least important free links to Plus, keeping Recherche last', () => {
    // Marché + Outils + Plus = 300: with 450, only Recherche (the most important) fits beside them.
    expect(layout(450)).toEqual(['/', groupKey('market'), groupKey('tools')].sort());
    // With 500 everything fits once the Marché pages are grouped, so « Plus » is not needed.
    expect(layout(500)).toEqual(['/', '/rentabilite', '/suivis', groupKey('market'), groupKey('tools')].sort());
  });

  it('keeps Recherche even when nothing else fits', () => {
    expect(layout(0)).toContain('/');
  });

  it('keeps every page as a link on the phone bar', () => {
    expect(layout(0, { compact: true })).toEqual(ITEMS.map((item) => item.to).sort());
  });

  it('shows a lone Marché page as a link, not a menu', () => {
    const lone = ITEMS.filter((item) => item.to !== '/bons-plans');
    const shown = layoutNav({ items: lone, widths: WIDTHS, room: 10_000, gap: 0, moreWidth: 100, compact: false });
    expect(shown.has('/hdv')).toBe(true);
    expect(shown.has(groupKey('market'))).toBe(false);
  });
});
