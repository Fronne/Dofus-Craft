import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoodDealsPayload } from '../../src/services/good-deals-api';

// specs/078-bons-plans-hdv (US1, US2, US3): the « Bons plans » page and its badge, on mocked announcements.
const getGoodDealsPayload = vi.fn<(serverId: string) => Promise<GoodDealsPayload | undefined>>();

vi.mock('../../src/services/good-deals-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/good-deals-api')>()),
  getGoodDealsPayload: (serverId: string) => getGoodDealsPayload(serverId),
}));

vi.mock('../../src/data/brisage-items-repository', () => ({
  loadBrisageItemsIndex: vi.fn().mockResolvedValue({
    source: 'test', sourceUrl: '', retrievedAt: '2026-10-31',
    items: [
      // Vitalité (125) and Force (118) are normal; Soins (178) is an exo on this item.
      { id: '2423', name: 'Abrabottes', level: 45, effects: [{ effectId: 125, from: 1, to: 60 }, { effectId: 118, from: 1, to: 30 }] },
      { id: '2500', name: 'Abracapa', level: 45, effects: [{ effectId: 125, from: 1, to: 60 }] },
    ],
  }),
}));

vi.mock('../../src/app/ServerContext', () => ({
  useActiveServer: () => ({ serverId: 'mikhal', servers: [{ id: 'mikhal', name: 'Mikhal', type: 'mono' }] }),
}));

import { BonsPlansPage } from '../../src/features/good-deals/BonsPlansPage';

const NOW = Date.now();
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const listing = (id: string, itemId: string, price: number, vitality: number, lastSeenAt = minutesAgo(30), extra: { effectId: number; value: number }[] = []) =>
  ({ listingId: id, itemId, priceKamas: price, lastSeenAt, stats: [{ effectId: 125, value: vitality }, ...extra] });

// Four ordinary copies of Abrabottes around 1 000 000 k, one at 600 000 k (a deal), and a plain exo one.
const MARKET = [listing('a1', '2423', 1_000_000, 50), listing('a2', '2423', 1_020_000, 51), listing('a3', '2423', 980_000, 49), listing('a4', '2423', 1_010_000, 50)];
const DEAL = listing('deal', '2423', 600_000, 50);
// Abracapa: four copies carrying the same exo (Force is not a normal Abracapa line), one far cheaper.
const EXO_MARKET = [1, 2, 3, 4].map((n) => listing(`e${n}`, '2500', 2_000_000, 40, minutesAgo(30), [{ effectId: 118, value: 10 }]));
const EXO_DEAL = listing('exodeal', '2500', 1_200_000, 40, minutesAgo(30), [{ effectId: 118, value: 10 }]);

beforeEach(() => {
  getGoodDealsPayload.mockReset();
});

afterEach(cleanup);

describe('page Bons plans', () => {
  it('lists the good deals with their badge, saving and age, and not the ordinary announcements', async () => {
    getGoodDealsPayload.mockResolvedValue({ thresholdPercent: 25, listings: [...MARKET, DEAL] });
    render(<BonsPlansPage />);
    expect(await screen.findAllByText('Abrabottes')).toHaveLength(1);
    expect(screen.getByText(/^−4\d %$/)).toBeInTheDocument();
    expect(screen.getByText(/^600\s000\skamas$/)).toBeInTheDocument();
    expect(screen.getByText('1 bon plan')).toBeInTheDocument();
    expect(screen.queryByText(/^1\s0[12]0\s000\skamas$/)).not.toBeInTheDocument();
    expect(screen.getByText(/vu il y a 30 minutes/)).toBeInTheDocument();
  });

  it('explains the badge: saving, expected price, number of comparable announcements', async () => {
    getGoodDealsPayload.mockResolvedValue({ thresholdPercent: 25, listings: [...MARKET, DEAL] });
    render(<BonsPlansPage />);
    const badge = await screen.findByLabelText(/^Bon plan\./);
    expect(badge.getAttribute('title')).toMatch(/Prix attendu pour ce jet/);
    expect(badge.getAttribute('title')).toMatch(/Comparé à 4 annonces/);
  });

  it('ignores announcements not seen for more than 24 hours', async () => {
    const stale = minutesAgo(25 * 60);
    getGoodDealsPayload.mockResolvedValue({ thresholdPercent: 25, listings: [...MARKET, { ...DEAL, lastSeenAt: stale }] });
    render(<BonsPlansPage />);
    expect(await screen.findByText('Aucun bon plan pour le moment')).toBeInTheDocument();
  });

  it('says so when no announcement was read on the server', async () => {
    getGoodDealsPayload.mockResolvedValue({ thresholdPercent: 25, listings: [] });
    render(<BonsPlansPage />);
    expect(await screen.findByText("Aucune annonce récente n'a été relevée sur ce serveur.")).toBeInTheDocument();
  });

  it('says it could not read the announcements, without inventing any', async () => {
    getGoodDealsPayload.mockResolvedValue(undefined);
    render(<BonsPlansPage />);
    expect(await screen.findByText('Annonces indisponibles')).toBeInTheDocument();
    expect(screen.queryByText(/^−\d+ %$/)).not.toBeInTheDocument();
  });

  it('applies the threshold the Worker serves', async () => {
    getGoodDealsPayload.mockResolvedValue({ thresholdPercent: 60, listings: [...MARKET, DEAL] });
    render(<BonsPlansPage />);
    expect(await screen.findByText('Aucun bon plan pour le moment')).toBeInTheDocument();
  });

  it('sorts by saving in kamas or in percent', async () => {
    // Abrabottes: 400 000 k saved (40 %); Abracapa: 60 000 k saved (60 %).
    const cheap = [1, 2, 3, 4].map((n) => listing(`c${n}`, '2500', 100_000, 40));
    getGoodDealsPayload.mockResolvedValue({
      thresholdPercent: 25,
      listings: [...MARKET, DEAL, ...cheap, listing('cheapdeal', '2500', 40_000, 40)],
    });
    render(<BonsPlansPage />);
    const order = () => screen.getAllByText(/^(Abrabottes|Abracapa)$/).map((node) => node.textContent);
    await screen.findAllByText('Abrabottes');
    expect(order()).toEqual(['Abrabottes', 'Abracapa']);
    fireEvent.change(screen.getByLabelText(/Trier par/), { target: { value: 'savingPercent' } });
    await waitFor(() => expect(order()).toEqual(['Abracapa', 'Abrabottes']));
  });

  it('keeps only exo announcements with « Exo uniquement »', async () => {
    getGoodDealsPayload.mockResolvedValue({ thresholdPercent: 25, listings: [...MARKET, DEAL, ...EXO_MARKET, EXO_DEAL] });
    render(<BonsPlansPage />);
    await screen.findAllByText('Abrabottes');
    expect(screen.getByText('Abracapa')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Exo uniquement'));
    await waitFor(() => expect(screen.queryByText('Abrabottes')).not.toBeInTheDocument());
    expect(screen.getByText('Abracapa')).toBeInTheDocument();
    expect(screen.getByText('Exo')).toBeInTheDocument();
  });

  it('filters on a stat of the roll', async () => {
    getGoodDealsPayload.mockResolvedValue({ thresholdPercent: 25, listings: [...MARKET, DEAL, ...EXO_MARKET, EXO_DEAL] });
    render(<BonsPlansPage />);
    await screen.findAllByText('Abrabottes');
    fireEvent.change(screen.getByRole('combobox', { name: /^Jet/ }), { target: { value: '118' } });
    await waitFor(() => expect(screen.queryByText('Abrabottes')).not.toBeInTheDocument());
    const row = screen.getByText('Abracapa').closest('li') as HTMLElement;
    expect(within(row).getByText(/10 Force/)).toBeInTheDocument();
  });
});
