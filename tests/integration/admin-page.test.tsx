import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerCounter } from '../../src/domain/player-counter';

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
    api.getMessage.mockResolvedValue({ status: 'ok', value: null });
    api.getSettings.mockResolvedValue({ status: 'ok', value: { forgemagiePage: false, hdvPage: true } });
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
      expect(within(card()).getByRole('alert')).toHaveTextContent('nombre entier positif ou nul');
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

  describe('bandeau d\'information (specs/020)', () => {
    const published = { text: 'Maintenance mardi', tone: 'important', endsAt: null, version: 'v1' };

    it('publishes a message with its style, and previews it', async () => {
      api.saveMessage.mockResolvedValue({ status: 'ok', value: published });
      render(<AdminPage />);
      const section = (await screen.findByRole('heading', { name: 'Bandeau d\'information' })).closest('section') as HTMLElement;
      fireEvent.change(within(section).getByLabelText('Message'), { target: { value: 'Maintenance mardi' } });
      fireEvent.click(within(section).getByLabelText('Important'));
      expect(section.querySelector('.info-banner--important')).toHaveTextContent('Maintenance mardi');
      fireEvent.click(within(section).getByRole('button', { name: 'Publier' }));
      expect(await within(section).findByText('Message publié.')).toBeInTheDocument();
      expect(api.saveMessage).toHaveBeenCalledWith({ text: 'Maintenance mardi', tone: 'important', endsAt: null });
      expect(within(section).getByRole('button', { name: 'Retirer' })).toBeInTheDocument();
    });

    it('refuses an empty message without calling the API', async () => {
      render(<AdminPage />);
      const section = (await screen.findByRole('heading', { name: 'Bandeau d\'information' })).closest('section') as HTMLElement;
      fireEvent.click(within(section).getByRole('button', { name: 'Publier' }));
      expect(await within(section).findByText('Le message ne peut pas être vide.')).toBeInTheDocument();
      expect(api.saveMessage).not.toHaveBeenCalled();
    });

    it('removes the published message', async () => {
      api.getMessage.mockResolvedValue({ status: 'ok', value: published });
      api.deleteMessage.mockResolvedValue({ status: 'ok', value: undefined });
      render(<AdminPage />);
      const section = (await screen.findByRole('heading', { name: 'Bandeau d\'information' })).closest('section') as HTMLElement;
      expect(await within(section).findByDisplayValue('Maintenance mardi')).toBeInTheDocument();
      fireEvent.click(within(section).getByRole('button', { name: 'Retirer' }));
      expect(await within(section).findByText('Message retiré.')).toBeInTheDocument();
      expect(within(section).queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument();
    });

    it('says when the published message has expired', async () => {
      api.getMessage.mockResolvedValue({ status: 'ok', value: { ...published, endsAt: '2020-01-01T10:00:00.000Z' } });
      render(<AdminPage />);
      expect(await screen.findByText(/^Expiré le 1 janvier 2020/)).toBeInTheDocument();
    });
  });

  describe('pages du site (specs/050, specs/053)', () => {
    const pages = async () => (await screen.findByRole('heading', { name: 'Pages du site' })).closest('section') as HTMLElement;
    const row = (section: HTMLElement, label: string) => within(section).getByText(label, { exact: false, selector: 'p' }).parentElement as HTMLElement;

    it('shows the Forgemagie page as disabled, and enables it in one click', async () => {
      api.saveSettings.mockResolvedValue({ status: 'ok', value: { forgemagiePage: true, hdvPage: true } });
      render(<AdminPage />);
      const section = await pages();
      await within(section).findByText('Désactivée');
      fireEvent.click(within(section).getByRole('button', { name: 'Activer la page Forgemagie' }));
      expect(await within(section).findByText('Page Forgemagie activée.')).toBeInTheDocument();
      expect(api.saveSettings).toHaveBeenCalledWith({ forgemagiePage: true });
      expect(within(row(section, 'Page Forgemagie :')).getByText('Activée')).toBeInTheDocument();
      expect(within(section).getByRole('button', { name: 'Désactiver la page Forgemagie' })).toBeInTheDocument();
    });

    it('shows the HDV page as enabled, and disables it alone in one click (specs/053, FR-010)', async () => {
      api.saveSettings.mockResolvedValue({ status: 'ok', value: { forgemagiePage: false, hdvPage: false } });
      render(<AdminPage />);
      const section = await pages();
      await within(section).findByText('Désactivée');
      expect(within(row(section, 'Page HDV :')).getByText('Activée')).toBeInTheDocument();
      fireEvent.click(within(section).getByRole('button', { name: 'Désactiver la page HDV' }));
      expect(await within(section).findByText('Page HDV désactivée.')).toBeInTheDocument();
      expect(api.saveSettings).toHaveBeenCalledWith({ hdvPage: false });
      expect(within(row(section, 'Page HDV :')).getByText('Désactivée')).toBeInTheDocument();
      expect(within(section).getByRole('button', { name: 'Activer la page HDV' })).toBeInTheDocument();
    });

    it('disables an enabled page', async () => {
      api.getSettings.mockResolvedValue({ status: 'ok', value: { forgemagiePage: true, hdvPage: true } });
      api.saveSettings.mockResolvedValue({ status: 'ok', value: { forgemagiePage: false, hdvPage: true } });
      render(<AdminPage />);
      const section = await pages();
      fireEvent.click(await within(section).findByRole('button', { name: 'Désactiver la page Forgemagie' }));
      expect(await within(section).findByText('Page Forgemagie désactivée.')).toBeInTheDocument();
      expect(api.saveSettings).toHaveBeenCalledWith({ forgemagiePage: false });
    });

    it('says when saving failed and keeps the saved state (FR-008)', async () => {
      api.saveSettings.mockResolvedValue({ status: 'unavailable' });
      render(<AdminPage />);
      const section = await pages();
      fireEvent.click(await within(section).findByRole('button', { name: 'Désactiver la page HDV' }));
      expect(await within(section).findByRole('alert')).toHaveTextContent('Enregistrement impossible pour le moment.');
      expect(within(row(section, 'Page HDV :')).getByText('Activée')).toBeInTheDocument();
    });

    it('offers to retry when the state could not be read, without a button that would guess it', async () => {
      api.getSettings.mockResolvedValue({ status: 'unavailable' });
      render(<AdminPage />);
      const section = await pages();
      expect(await within(section).findByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
      expect(within(section).queryByRole('button', { name: /^(Activer|Désactiver)/ })).not.toBeInTheDocument();
    });
  });
});
