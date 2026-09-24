import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerCounter } from '../../src/domain/player-counter';

const api = vi.hoisted(() => ({
  me: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('../../admin/admin-api', () => ({ adminApi: api }));

const searchDofusDbItemsByName = vi.fn();
vi.mock('../../src/services/dofusdb-api', () => ({
  searchDofusDbItemsByName: (...args: unknown[]) => searchDofusDbItemsByName(...args),
}));

import { AdminPage } from '../../admin/AdminPage';

const nicomoux: PlayerCounter = {
  id: 'nicomoux',
  player: 'Nicomoux',
  breedId: 12,
  sex: 'm',
  count: 157,
  atLeast: false,
  unitOne: 'tentative de FM',
  unitMany: 'tentatives de FM',
  target: { itemId: 14094, name: 'Amulette du Strigide', icon: 'https://api.dofusdb.fr/img/items/1235.png' },
  createdAt: '2026-09-24T00:00:01.000Z',
  updatedAt: '2026-09-24T00:00:01.000Z',
};
const amulet = { itemId: 14094, name: 'Amulette du Strigide', icon: 'https://api.dofusdb.fr/img/items/1235.png' };

async function renderPage() {
  render(<AdminPage />);
  await act(async () => {});
}

const card = () => screen.getByRole('article', { name: 'Compteur de Nicomoux' });

describe('page d\'administration (specs/014-admin-counters)', () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.me.mockResolvedValue({ status: 'ok', value: 'owner@example.com' });
    api.list.mockResolvedValue({ status: 'ok', value: [nicomoux] });
    searchDofusDbItemsByName.mockReset().mockResolvedValue([amulet]);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('US1 — changer le chiffre', () => {
    it('lists the counters with portrait, player, class and target, and who is signed in', async () => {
      await renderPage();
      expect(screen.getByText('Connecté : owner@example.com')).toBeInTheDocument();
      expect(card()).toHaveTextContent('Nicomoux');
      expect(card()).toHaveTextContent('Pandawa');
      expect(card()).toHaveTextContent('Amulette du Strigide');
      expect(card().querySelector('img')).toHaveAttribute('src', '/class-heads/Head_120.png');
    });

    it('saves a new number and "at least"', async () => {
      api.update.mockResolvedValue({ status: 'ok', value: { ...nicomoux, count: 162, atLeast: true } });
      await renderPage();
      fireEvent.change(within(card()).getByLabelText('Chiffre'), { target: { value: '162' } });
      fireEvent.click(within(card()).getByLabelText('Au moins (affiche un +)'));
      fireEvent.click(within(card()).getByRole('button', { name: 'Enregistrer' }));
      await act(async () => {});
      expect(api.update).toHaveBeenCalledWith('nicomoux', { count: 162, atLeast: true });
      expect(screen.getByText('Enregistré.')).toBeInTheDocument();
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('refuses an invalid number without calling the API (FR-012)', async () => {
      await renderPage();
      fireEvent.change(within(card()).getByLabelText('Chiffre'), { target: { value: '-3' } });
      fireEvent.click(within(card()).getByRole('button', { name: 'Enregistrer' }));
      await act(async () => {});
      expect(api.update).not.toHaveBeenCalled();
      expect(within(card()).getByRole('status')).toHaveTextContent('nombre entier positif ou nul');
    });

    it('keeps the typed value and says so when saving fails (FR-013)', async () => {
      api.update.mockResolvedValue({ status: 'unavailable' });
      await renderPage();
      fireEvent.change(within(card()).getByLabelText('Chiffre'), { target: { value: '170' } });
      fireEvent.click(within(card()).getByRole('button', { name: 'Enregistrer' }));
      await act(async () => {});
      expect(screen.getByText('Enregistrement impossible pour le moment.')).toBeInTheDocument();
      expect(within(card()).getByLabelText('Chiffre')).toHaveValue('170');
    });

    it('asks to sign in again when the session has expired', async () => {
      api.list.mockResolvedValue({ status: 'forbidden' });
      await renderPage();
      expect(screen.getByRole('alert')).toHaveTextContent('rechargez la page pour vous reconnecter');
    });
  });

  describe('US3 — ajouter un compteur', () => {
    const form = () => screen.getByRole('form', { name: 'Nouveau compteur' });

    it('previews the official portrait for the chosen class and sex', async () => {
      await renderPage();
      fireEvent.change(within(form()).getByLabelText('Classe'), { target: { value: '17' } });
      fireEvent.click(within(form()).getByLabelText('Femme'));
      expect(within(form()).getByAltText('Aperçu du portrait')).toHaveAttribute('src', '/class-heads/Head_171.png');
    });

    it('creates a complete counter with an item picked from the catalogue', async () => {
      api.create.mockResolvedValue({ status: 'ok', value: { ...nicomoux, id: 'new', player: 'Glyphinette' } });
      await renderPage();
      fireEvent.change(within(form()).getByLabelText('Pseudo'), { target: { value: 'Glyphinette' } });
      fireEvent.change(within(form()).getByLabelText('Classe'), { target: { value: '17' } });
      fireEvent.click(within(form()).getByLabelText('Femme'));
      fireEvent.change(within(form()).getByLabelText('Libellé au singulier'), { target: { value: 'Dofus raté' } });
      fireEvent.change(within(form()).getByLabelText('Libellé au pluriel'), { target: { value: 'Dofus ratés' } });
      fireEvent.change(within(form()).getByLabelText('Chiffre de départ'), { target: { value: '3' } });
      fireEvent.change(within(form()).getByLabelText('Objet visé'), { target: { value: 'strigide' } });
      fireEvent.click(within(form()).getByRole('button', { name: 'Rechercher' }));
      await act(async () => {});
      fireEvent.click(within(form()).getByRole('button', { name: 'Amulette du Strigide' }));
      fireEvent.click(within(form()).getByRole('button', { name: 'Ajouter' }));
      await act(async () => {});
      expect(api.create).toHaveBeenCalledWith({
        player: 'Glyphinette',
        breedId: 17,
        sex: 'f',
        count: 3,
        atLeast: false,
        unitOne: 'Dofus raté',
        unitMany: 'Dofus ratés',
        target: amulet,
      });
      expect(screen.getByText('Compteur ajouté.')).toBeInTheDocument();
      expect(api.list).toHaveBeenCalledTimes(2);
    });

    it('refuses a counter with a missing field, naming it, without calling the API', async () => {
      await renderPage();
      fireEvent.change(within(form()).getByLabelText('Pseudo'), { target: { value: 'Glyphinette' } });
      fireEvent.click(within(form()).getByRole('button', { name: 'Ajouter' }));
      await act(async () => {});
      expect(api.create).not.toHaveBeenCalled();
      expect(within(form()).getByRole('status')).toHaveTextContent('Classe');
    });

    it('says when the game catalogue cannot be reached', async () => {
      searchDofusDbItemsByName.mockRejectedValue(new Error('down'));
      await renderPage();
      fireEvent.change(within(form()).getByLabelText('Objet visé'), { target: { value: 'strigide' } });
      fireEvent.click(within(form()).getByRole('button', { name: 'Rechercher' }));
      await act(async () => {});
      expect(within(form()).getByRole('status')).toHaveTextContent('Le catalogue du jeu est injoignable');
    });
  });

  describe('US4 — supprimer un compteur', () => {
    it('deletes after a confirmation naming the player and what is counted', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      api.remove.mockResolvedValue({ status: 'ok', value: undefined });
      await renderPage();
      fireEvent.click(within(card()).getByRole('button', { name: 'Supprimer' }));
      await act(async () => {});
      expect(confirm).toHaveBeenCalledWith('Supprimer le compteur de Nicomoux (tentatives de FM) ?');
      expect(api.remove).toHaveBeenCalledWith('nicomoux');
      expect(screen.getByText('Compteur supprimé.')).toBeInTheDocument();
    });

    it('does nothing when the confirmation is refused', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      await renderPage();
      fireEvent.click(within(card()).getByRole('button', { name: 'Supprimer' }));
      await act(async () => {});
      expect(api.remove).not.toHaveBeenCalled();
    });
  });
});
