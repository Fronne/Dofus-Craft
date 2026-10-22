import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  me: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getMessage: vi.fn(),
  saveMessage: vi.fn(),
  deleteMessage: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  listSnifferKeys: vi.fn(),
  createSnifferKey: vi.fn(),
  revokeSnifferKey: vi.fn(),
  listSnifferMappings: vi.fn(),
  uploadSnifferMapping: vi.fn(),
  activateSnifferMapping: vi.fn(),
  getUsage: vi.fn(),
}));
vi.mock('../../admin/admin-api', () => ({ adminApi: api }));
vi.mock('../../src/services/dofusdb-api', () => ({ searchDofusDbItemsByName: vi.fn().mockResolvedValue([]) }));

import { AdminPage } from '../../admin/AdminPage';

const today = { date: '2026-10-21', workersRequests: 85_000, d1RowsRead: 10, d1RowsWritten: 10 };

async function renderPage(hash = '') {
  window.location.hash = hash;
  render(<AdminPage />);
  await act(async () => {});
}

async function goTo(hash: string) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

const cardNames = () => screen.getAllByRole('link').map((link) => within(link).getByRole('heading').textContent);

describe('tableau de bord de l\'administration (specs/068-admin-dashboard)', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.me.mockResolvedValue({ status: 'ok', value: 'owner@example.com' });
    api.list.mockResolvedValue({ status: 'ok', value: [] });
    api.getMessage.mockResolvedValue({ status: 'ok', value: null });
    api.getSettings.mockResolvedValue({ status: 'ok', value: { forgemagiePage: false, hdvPage: true } });
    api.listSnifferKeys.mockResolvedValue({ status: 'ok', value: [] });
    api.listSnifferMappings.mockResolvedValue({ status: 'ok', value: [] });
    api.getUsage.mockResolvedValue({ status: 'ok', value: { state: 'ok', days: 7, readAt: '2026-10-21T10:00:00Z', history: [today] } });
  });
  afterEach(() => {
    cleanup();
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  describe('US1 — voir l\'état de tout d\'un coup d\'œil', () => {
    it('affiche six cartes avec leur résumé et l\'e-mail connecté', async () => {
      await renderPage();
      expect(screen.getByText('Connecté : owner@example.com')).toBeInTheDocument();
      expect(cardNames()).toEqual([
        'Pages du site',
        "Bandeau d'information",
        'Compteurs',
        'Clés sniffer',
        'Mapping',
        'Utilisation Cloudflare',
      ]);
      expect(screen.getByRole('link', { name: /Pages du site/ })).toHaveTextContent('1 page active sur 2');
      expect(screen.getByRole('link', { name: /Bandeau/ })).toHaveTextContent('Aucun bandeau');
      expect(screen.getByRole('link', { name: /Compteurs/ })).toHaveTextContent('Aucun compteur');
      expect(screen.getByRole('link', { name: /Clés/ })).toHaveTextContent('Aucune clé active');
    });

    it('annonce le bandeau affiché', async () => {
      api.getMessage.mockResolvedValue({ status: 'ok', value: { text: 'Bonjour', tone: 'info', updatedAt: '2026-10-21' } });
      await renderPage();
      expect(screen.getByRole('link', { name: /Bandeau/ })).toHaveTextContent('Bandeau affiché');
    });

    it('signale en texte la consommation Cloudflare proche de la limite', async () => {
      await renderPage();
      expect(screen.getByRole('link', { name: /Cloudflare/ })).toHaveTextContent('Requêtes Workers : 85 % · Proche de la limite');
    });

    it('une lecture en échec rend seulement sa carte indisponible', async () => {
      api.listSnifferKeys.mockResolvedValue({ status: 'unavailable' });
      await renderPage();
      expect(screen.getByRole('link', { name: /Clés/ })).toHaveTextContent('Indisponible');
      expect(screen.getByRole('link', { name: /Compteurs/ })).toHaveTextContent('Aucun compteur');
    });
  });

  describe('US2 — accéder à une section', () => {
    it('ouvre la section seule et revient au tableau de bord', async () => {
      await renderPage('#pages');
      expect(screen.getByRole('heading', { name: 'Pages du site' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: "Bandeau d'information" })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Retour au tableau de bord/ })).toHaveAttribute('href', '#');
      await goTo('');
      expect(screen.getAllByRole('link')).toHaveLength(6);
    });

    it.each([
      ['#bandeau', "Bandeau d'information"],
      ['#compteurs', 'Compteurs'],
      ['#cles', 'Clés sniffer'],
      ['#correspondances', 'Mapping'],
      ['#cloudflare', 'Utilisation Cloudflare'],
    ])('%s ouvre la bonne section', async (hash, name) => {
      await renderPage(hash);
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Retour au tableau de bord/ })).toBeInTheDocument();
    });

    it('les cartes pointent vers l\'ancre de leur section', async () => {
      await renderPage();
      expect(screen.getByRole('link', { name: /Compteurs/ })).toHaveAttribute('href', '#compteurs');
    });

    it('la carte reflète une modification faite dans la section', async () => {
      api.saveSettings.mockResolvedValue({ status: 'ok', value: { forgemagiePage: true, hdvPage: true } });
      await renderPage('#pages');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Activer la page Forgemagie' }));
      });
      api.getSettings.mockResolvedValue({ status: 'ok', value: { forgemagiePage: true, hdvPage: true } });
      await goTo('');
      expect(screen.getByRole('link', { name: /Pages du site/ })).toHaveTextContent('2 pages actives sur 2');
    });
  });

  describe('US3 — navigation par ancre', () => {
    it('bascule entre section et tableau de bord quand l\'ancre change', async () => {
      await renderPage();
      await goTo('#cloudflare');
      expect(screen.getByRole('heading', { level: 2, name: 'Utilisation Cloudflare' })).toBeInTheDocument();
      await goTo('');
      expect(screen.getAllByRole('link')).toHaveLength(6);
    });

    it('ne prend pas le focus au premier rendu, puis le donne au titre à chaque changement de vue', async () => {
      await renderPage();
      const title = screen.getByRole('heading', { level: 1, name: 'Administration' });
      expect(title).not.toHaveFocus();
      await goTo('#pages');
      expect(title).toHaveFocus();
      title.blur();
      await goTo('');
      expect(title).toHaveFocus();
    });

    it('teinte la carte Cloudflare selon le niveau, en plus du texte', async () => {
      await renderPage();
      expect(screen.getByRole('link', { name: /Cloudflare/ })).toHaveClass('dashboard-card--warning');
      api.getUsage.mockResolvedValue({ status: 'ok', value: { state: 'ok', days: 7, readAt: 'x', history: [{ ...today, workersRequests: 100_000 }] } });
      cleanup();
      await renderPage();
      expect(screen.getByRole('link', { name: /Cloudflare/ })).toHaveClass('dashboard-card--over');
    });

    it('une ancre inconnue affiche le tableau de bord', async () => {
      await renderPage('#nimporte');
      expect(screen.getAllByRole('link')).toHaveLength(6);
    });
  });
});
