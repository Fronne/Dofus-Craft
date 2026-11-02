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
import { CALIBRATION_STORAGE_KEY } from '../../src/features/good-deals/deal-calibration';

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
  window.localStorage.clear();
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

  // specs/080-bons-plans-filtre-calibrage (US1): one exo at a time, and optionally its exact value.
  describe('filtre par exo', () => {
    const pickForce = async () => {
      await screen.findAllByText('Abrabottes');
      fireEvent.click(screen.getByRole('button', { name: "Choisir la rune de l'exo" }));
      fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une rune' }), { target: { value: 'force' } });
      fireEvent.click(within(screen.getByRole('list', { name: "Runes disponibles pour l'exo" })).getByRole('button'));
    };

    beforeEach(() => {
      getGoodDealsPayload.mockResolvedValue({ thresholdPercent: 25, listings: [...MARKET, DEAL, ...EXO_MARKET, EXO_DEAL] });
    });

    it('no longer offers the list « Jet » nor « Exo uniquement »', async () => {
      render(<BonsPlansPage />);
      await screen.findAllByText('Abrabottes');
      expect(screen.queryByRole('combobox', { name: /^Jet/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Exo uniquement')).not.toBeInTheDocument();
    });

    it('offers the exos of the announcements only, and finds them by search', async () => {
      render(<BonsPlansPage />);
      await screen.findAllByText('Abrabottes');
      fireEvent.click(screen.getByRole('button', { name: "Choisir la rune de l'exo" }));
      expect(within(screen.getByRole('list', { name: "Runes disponibles pour l'exo" })).getAllByRole('button')).toHaveLength(1);
      fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une rune' }), { target: { value: 'sagesse' } });
      expect(screen.getByText('Aucune rune ne correspond.')).toBeInTheDocument();
    });

    it('keeps every value of the exo until one is given', async () => {
      render(<BonsPlansPage />);
      await pickForce();
      await waitFor(() => expect(screen.queryByText('Abrabottes')).not.toBeInTheDocument());
      const row = screen.getByText('Abracapa').closest('li') as HTMLElement;
      expect(within(row).getByText(/10 Force/)).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Valeur'), { target: { value: '10' } });
      expect(screen.getByText('Abracapa')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Valeur'), { target: { value: '11' } });
      await waitFor(() => expect(screen.queryByText('Abracapa')).not.toBeInTheDocument());
    });

    it('takes the exo off', async () => {
      render(<BonsPlansPage />);
      await pickForce();
      await waitFor(() => expect(screen.queryByText('Abrabottes')).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: "Retirer l'exo" }));
      expect(await screen.findByText('Abrabottes')).toBeInTheDocument();
      expect(screen.getByText('Abracapa')).toBeInTheDocument();
      expect(screen.queryByLabelText('Valeur')).not.toBeInTheDocument();
    });
  });

  // specs/080-bons-plans-filtre-calibrage (US2): the player's calibration, kept in the browser.
  describe('calibrage', () => {
    const threshold = () => screen.getByLabelText(/Seuil de bon plan/);

    beforeEach(() => {
      getGoodDealsPayload.mockResolvedValue({ thresholdPercent: 25, listings: [...MARKET, DEAL] });
    });

    it('explains the columns, the levels and the states of a gap', async () => {
      render(<BonsPlansPage />);
      await screen.findByText('1 bon plan');
      expect(document.querySelector('.good-deal-calibration-titles')?.textContent).toBe('StatImportanceÉcart accepté');
      expect(screen.queryByText(/prix médian/)).not.toBeInTheDocument();
      const help = screen.getByRole('button', { name: 'Comment fonctionne le calibrage' });
      fireEvent.click(help);
      for (const text of ['Primordiale : compte 1,5 fois', 'Très importante : compte 1 fois', 'Moyenne : compte 0,5 fois', 'Faible : compte 0,25 fois', 'Aucune : ignorée']) {
        expect(screen.getByText(text)).toBeInTheDocument();
      }
      expect(screen.getByText(/prix médian/)).toBeInTheDocument();
      expect(screen.getByText(/95 est correct, 94 est un défaut/)).toBeInTheDocument();
      expect(screen.getByText(/^Auto :/)).toBeInTheDocument();
      expect(screen.getByText(/^Vide :/)).toBeInTheDocument();
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.queryByText(/prix médian/)).not.toBeInTheDocument();
      expect(help).toHaveFocus();
      fireEvent.click(help);
      fireEvent.mouseDown(document.body);
      expect(screen.queryByText(/prix médian/)).not.toBeInTheDocument();
    });

    it('judges again at once, without reading the announcements again', async () => {
      render(<BonsPlansPage />);
      await screen.findByText('1 bon plan');
      fireEvent.change(threshold(), { target: { value: '60' } });
      expect(await screen.findByText('Aucun bon plan pour le moment')).toBeInTheDocument();
      expect(getGoodDealsPayload).toHaveBeenCalledTimes(1);
    });

    it('ignores a threshold out of bounds', async () => {
      render(<BonsPlansPage />);
      await screen.findByText('1 bon plan');
      fireEvent.change(threshold(), { target: { value: '900' } });
      expect(screen.getByText('1 bon plan')).toBeInTheDocument();
      expect(window.localStorage.getItem(CALIBRATION_STORAGE_KEY)).toBeNull();
    });

    it('finds the calibration back after a reload', async () => {
      const { unmount } = render(<BonsPlansPage />);
      await screen.findByText('1 bon plan');
      fireEvent.change(threshold(), { target: { value: '60' } });
      fireEvent.change(screen.getByLabelText('Importance de Sagesse'), { target: { value: '1.5' } });
      fireEvent.change(screen.getByLabelText('Écart accepté de Force'), { target: { value: '12' } });
      unmount();
      render(<BonsPlansPage />);
      expect(await screen.findByText('Aucun bon plan pour le moment')).toBeInTheDocument();
      expect(threshold()).toHaveValue(60);
      expect(screen.getByLabelText('Importance de Sagesse')).toHaveValue('1.5');
      expect(screen.getByLabelText('Écart accepté de Force')).toHaveValue(12);
    });

    it('stops a stat with a scaled gap from making defects when its field is emptied', async () => {
      render(<BonsPlansPage />);
      await screen.findByText('1 bon plan');
      const vitality = screen.getByLabelText('Écart accepté de Vitalité');
      expect(vitality).toHaveAttribute('placeholder', 'Auto');
      fireEvent.change(vitality, { target: { value: '5' } });
      fireEvent.change(vitality, { target: { value: '' } });
      expect(vitality).toHaveAttribute('placeholder', 'Aucun');
      expect(JSON.parse(window.localStorage.getItem(CALIBRATION_STORAGE_KEY) as string)).toEqual({ gaps: { 125: null } });
    });

    it('goes back to the defaults with « Réinitialiser »', async () => {
      render(<BonsPlansPage />);
      await screen.findByText('1 bon plan');
      const force = screen.getByLabelText('Écart accepté de Force');
      const defaultGap = (force as HTMLInputElement).value;
      fireEvent.change(threshold(), { target: { value: '60' } });
      fireEvent.change(force, { target: { value: '' } });
      await screen.findByText('Aucun bon plan pour le moment');
      fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
      expect(await screen.findByText('1 bon plan')).toBeInTheDocument();
      expect(threshold()).toHaveValue(25);
      expect(screen.getByLabelText('Écart accepté de Force')).toHaveValue(Number(defaultGap));
      expect(window.localStorage.getItem(CALIBRATION_STORAGE_KEY)).toBeNull();
    });
  });
});
