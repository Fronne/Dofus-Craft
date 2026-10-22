import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerCounter } from '../../src/domain/player-counter';
import { DEFAULT_SITE_SETTINGS as ALL_PAGES } from '../../src/domain/site-settings';

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
  getTodayUsage: vi.fn(),
  getKeyContributions: vi.fn(),
  getActivity: vi.fn(),
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

// specs/068-admin-dashboard: a section is open on its own, so each group of tests names the one it exercises.
let openSection = '#compteurs';

async function renderPage() {
  window.location.hash = openSection;
  render(<AdminPage />);
  await act(async () => {});
}

const card = () => screen.getByRole('article', { name: 'Compteur de Nicomoux' });

describe('page d\'administration (specs/014-admin-counters)', () => {
  beforeEach(() => {
    openSection = '#compteurs';
    for (const fn of Object.values(api)) fn.mockReset();
    api.me.mockResolvedValue({ status: 'ok', value: 'owner@example.com' });
    api.list.mockResolvedValue({ status: 'ok', value: [nicomoux] });
    api.getMessage.mockResolvedValue({ status: 'ok', value: null });
    api.getSettings.mockResolvedValue({ status: 'ok', value: { ...ALL_PAGES, forgemagiePage: false, hdvPage: true } });
    api.listSnifferKeys.mockResolvedValue({ status: 'ok', value: [] });
    api.listSnifferMappings.mockResolvedValue({ status: 'ok', value: [] });
    api.getUsage.mockResolvedValue({ status: 'ok', value: { state: 'not-configured', missing: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] } });
    for (const name of ['getTodayUsage', 'getKeyContributions', 'getActivity'] as const) api[name].mockResolvedValue({ status: 'unavailable' });
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
    beforeEach(() => { openSection = '#bandeau'; });
    const published = { text: 'Maintenance mardi', tone: 'important', endsAt: null, version: 'v1' };

    it('publishes a message with its style, and previews it', async () => {
      api.saveMessage.mockResolvedValue({ status: 'ok', value: published });
      window.location.hash = openSection;
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
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = (await screen.findByRole('heading', { name: 'Bandeau d\'information' })).closest('section') as HTMLElement;
      fireEvent.click(within(section).getByRole('button', { name: 'Publier' }));
      expect(await within(section).findByText('Le message ne peut pas être vide.')).toBeInTheDocument();
      expect(api.saveMessage).not.toHaveBeenCalled();
    });

    it('removes the published message', async () => {
      api.getMessage.mockResolvedValue({ status: 'ok', value: published });
      api.deleteMessage.mockResolvedValue({ status: 'ok', value: undefined });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = (await screen.findByRole('heading', { name: 'Bandeau d\'information' })).closest('section') as HTMLElement;
      expect(await within(section).findByDisplayValue('Maintenance mardi')).toBeInTheDocument();
      fireEvent.click(within(section).getByRole('button', { name: 'Retirer' }));
      expect(await within(section).findByText('Message retiré.')).toBeInTheDocument();
      expect(within(section).queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument();
    });

    it('says when the published message has expired', async () => {
      api.getMessage.mockResolvedValue({ status: 'ok', value: { ...published, endsAt: '2020-01-01T10:00:00.000Z' } });
      window.location.hash = openSection;
      render(<AdminPage />);
      expect(await screen.findByText(/^Expiré le 1 janvier 2020/)).toBeInTheDocument();
    });
  });

  describe('pages du site (specs/050, specs/053)', () => {
    beforeEach(() => { openSection = '#pages'; });
    const pages = async () => (await screen.findByRole('heading', { name: 'Pages du site' })).closest('section') as HTMLElement;
    const row = (section: HTMLElement, label: string) => within(section).getByText(label, { exact: false, selector: 'p' }).parentElement as HTMLElement;

    it('shows the Forgemagie page as disabled, and enables it in one click', async () => {
      api.saveSettings.mockResolvedValue({ status: 'ok', value: { ...ALL_PAGES, forgemagiePage: true, hdvPage: true } });
      window.location.hash = openSection;
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
      api.saveSettings.mockResolvedValue({ status: 'ok', value: { ...ALL_PAGES, forgemagiePage: false, hdvPage: false } });
      window.location.hash = openSection;
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
      api.getSettings.mockResolvedValue({ status: 'ok', value: { ...ALL_PAGES, forgemagiePage: true, hdvPage: true } });
      api.saveSettings.mockResolvedValue({ status: 'ok', value: { ...ALL_PAGES, forgemagiePage: false, hdvPage: true } });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await pages();
      fireEvent.click(await within(section).findByRole('button', { name: 'Désactiver la page Forgemagie' }));
      expect(await within(section).findByText('Page Forgemagie désactivée.')).toBeInTheDocument();
      expect(api.saveSettings).toHaveBeenCalledWith({ forgemagiePage: false });
    });

    it('says when saving failed and keeps the saved state (FR-008)', async () => {
      api.saveSettings.mockResolvedValue({ status: 'unavailable' });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await pages();
      fireEvent.click(await within(section).findByRole('button', { name: 'Désactiver la page HDV' }));
      expect(await within(section).findByRole('alert')).toHaveTextContent('Enregistrement impossible pour le moment.');
      expect(within(row(section, 'Page HDV :')).getByText('Activée')).toBeInTheDocument();
    });

    it('offers to retry when the state could not be read, without a button that would guess it', async () => {
      api.getSettings.mockResolvedValue({ status: 'unavailable' });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await pages();
      expect(await within(section).findByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
      expect(within(section).queryByRole('button', { name: /^(Activer|Désactiver)/ })).not.toBeInTheDocument();
    });
  });

  // specs/057-sniffer-admin (contracts/admin-sniffer-api.md « Interface »).
  describe('outil des amis : clés et mapping (specs/057)', () => {
    // The keys and the mappings are two sections: a test opens the other one by changing the anchor.
    beforeEach(() => { openSection = '#cles'; });
    const alice = { id: 'key-a', label: 'Alice', createdAt: '2026-10-15T08:00:00.000Z', revokedAt: null, lastSeenAt: null, rowsToday: 0 };
    const keys = async () => (await screen.findByRole('heading', { name: 'Clés sniffer' })).closest('section') as HTMLElement;
    const mappings = async () => (await screen.findByRole('heading', { name: 'Mapping' })).closest('section') as HTMLElement;
    const mapping = (id: number, active: boolean) => ({ id, build: '3.7.10.10', uploadedAt: '2026-10-15T08:00:00.000Z', active, keymapBytes: 991, schemaBytes: 5766 });

    it('shows a new key once, until it is dismissed', async () => {
      api.createSnifferKey.mockResolvedValue({ status: 'ok', value: { key: alice, secret: 'dcp_secret' } });
      api.listSnifferKeys.mockResolvedValueOnce({ status: 'ok', value: [] }).mockResolvedValue({ status: 'ok', value: [alice] });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await keys();
      fireEvent.change(within(section).getByLabelText("Nom de l'ami"), { target: { value: 'Alice' } });
      fireEvent.click(within(section).getByRole('button', { name: 'Créer une clé' }));
      expect(await within(section).findByText('dcp_secret')).toBeInTheDocument();
      expect(api.createSnifferKey).toHaveBeenCalledWith('Alice');
      expect(within(section).getByText('Cette clé ne sera plus affichée : transmettez-la maintenant.')).toBeInTheDocument();
      expect(await within(section).findByText(/dernier envoi : jamais/)).toBeInTheDocument();
      fireEvent.click(within(section).getByRole('button', { name: "J'ai copié la clé" }));
      expect(within(section).queryByText('dcp_secret')).not.toBeInTheDocument();
    });

    it('revokes a key only after confirmation (FR-006)', async () => {
      api.listSnifferKeys.mockResolvedValue({ status: 'ok', value: [alice] });
      api.revokeSnifferKey.mockResolvedValue({ status: 'ok', value: { ...alice, revokedAt: '2026-10-15T09:00:00.000Z' } });
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await keys();
      fireEvent.click(await within(section).findByRole('button', { name: 'Révoquer' }));
      expect(confirm).toHaveBeenCalledWith('Révoquer la clé de Alice ? Son outil ne pourra plus envoyer de prix.');
      expect(api.revokeSnifferKey).not.toHaveBeenCalled();
      fireEvent.click(within(section).getByRole('button', { name: 'Révoquer' }));
      expect(await within(section).findByText('Clé de Alice révoquée.')).toBeInTheDocument();
      expect(api.revokeSnifferKey).toHaveBeenCalledWith('key-a');
    });

    it("sends the files' text and shows the server's refusal", async () => {
      api.uploadSnifferMapping.mockResolvedValue({ status: 'invalid', field: 'keymap', error: "keymap.json n'a pas d'entrée price_list." });
      window.location.hash = '#correspondances';
      render(<AdminPage />);
      const section = await mappings();
      fireEvent.change(within(section).getByLabelText('Build du client'), { target: { value: '3.7.10.10' } });
      // jsdom's File has no text(); browsers do.
      const file = (content: string, name: string) => Object.assign(new File([content], name), { text: async () => content });
      fireEvent.change(within(section).getByLabelText('keymap.json'), { target: { files: [file('{"a":1}', 'keymap.json')] } });
      fireEvent.change(within(section).getByLabelText('schema.json'), { target: { files: [file('{}', 'schema.json')] } });
      // Submitted directly: jsdom's `required` check reads its own file list, not the one set above.
      fireEvent.submit(within(section).getByRole('button', { name: 'Publier' }).closest('form')!);
      expect(await within(section).findByRole('alert')).toHaveTextContent("keymap.json n'a pas d'entrée price_list.");
      expect(api.uploadSnifferMapping).toHaveBeenCalledWith({ build: '3.7.10.10', keymap: '{"a":1}', schema: '{}' });
    });

    it('goes back to an older mapping after confirmation (US4)', async () => {
      api.listSnifferMappings.mockResolvedValueOnce({ status: 'ok', value: [mapping(2, true), mapping(1, false)] })
        .mockResolvedValue({ status: 'ok', value: [mapping(2, false), mapping(1, true)] });
      api.activateSnifferMapping.mockResolvedValue({ status: 'ok', value: mapping(1, true) });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      window.location.hash = '#correspondances';
      render(<AdminPage />);
      const section = await mappings();
      expect(await within(section).findByText('Build 3.7.10.10')).toBeInTheDocument();
      fireEvent.click(within(section).getByRole('button', { name: 'Réactiver' }));
      expect(await within(section).findByText('Mapping n° 1 réactivé pour 3.7.10.10.')).toBeInTheDocument();
      expect(api.activateSnifferMapping).toHaveBeenCalledWith(1);
    });
  });
});

// specs/058-admin-cloudflare-usage: the "Utilisation Cloudflare" section.
describe('section Utilisation Cloudflare (specs/058-admin-cloudflare-usage)', () => {
  beforeEach(() => { openSection = '#cloudflare'; });
  const day = (date: string, workersRequests: number, d1RowsRead = 0, d1RowsWritten = 0) => ({ date, workersRequests, d1RowsRead, d1RowsWritten });
  const history = (days: number, last = day('2026-10-19', 50_000, 4_000_000, 112_000)) =>
    [...Array.from({ length: days - 1 }, (_, index) => day(`2026-09-${String(index + 1).padStart(2, '0')}`, 0)), last];
  const ok = (days: 7 | 30, last?: ReturnType<typeof day>) => ({
    status: 'ok',
    value: { state: 'ok', days, readAt: '2026-10-19T14:03:00.000Z', history: history(days, last) },
  });
  const section = () => screen.getByRole('region', { name: 'Utilisation Cloudflare' });
  const row = (label: string) => within(section().querySelector('.usage-list') as HTMLElement).getByText(label).closest('li')!;

  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.me.mockResolvedValue({ status: 'ok', value: 'owner@example.com' });
    api.list.mockResolvedValue({ status: 'ok', value: [] });
    api.getMessage.mockResolvedValue({ status: 'ok', value: null });
    api.getSettings.mockResolvedValue({ status: 'ok', value: { ...ALL_PAGES, forgemagiePage: false, hdvPage: true } });
    api.listSnifferKeys.mockResolvedValue({ status: 'ok', value: [] });
    api.listSnifferMappings.mockResolvedValue({ status: 'ok', value: [] });
    api.getUsage.mockResolvedValue(ok(7));
  });
  afterEach(cleanup);

  it('shows consumed / limit / percent with a bar and the level in words (US1)', async () => {
    await renderPage();
    const workers = row('Requêtes Workers');
    expect(workers).toHaveTextContent('50 000 / 100 000');
    expect(workers).toHaveTextContent('50 %');
    expect(within(workers).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50000');
    expect(workers).toHaveTextContent('Dans la limite');
    const reads = row('Lectures de lignes D1');
    expect(reads).toHaveTextContent('80 %');
    expect(reads).toHaveTextContent('Proche de la limite');
  });

  it('shows an overrun as it is while the bar stays full, and zero as zero', async () => {
    await renderPage();
    const writes = row('Écritures de lignes D1');
    expect(writes).toHaveTextContent('112 %');
    expect(writes).toHaveTextContent('Limite dépassée');
    expect(writes.querySelector('.usage-bar-fill')).toHaveStyle({ width: '100%' });
    api.getUsage.mockResolvedValue(ok(7, day('2026-10-19', 0)));
    fireEvent.click(within(section()).getByRole('button', { name: 'Actualiser' }));
    await act(async () => {});
    const workers = row('Requêtes Workers');
    expect(workers).toHaveTextContent('0 / 100 000');
    expect(workers).toHaveTextContent('0 %');
  });

  it('refreshes on demand and tells when it last read (US1)', async () => {
    await renderPage();
    expect(section()).toHaveTextContent('Dernière lecture : 14:03 UTC');
    fireEvent.click(within(section()).getByRole('button', { name: 'Actualiser' }));
    await act(async () => {});
    expect(api.getUsage).toHaveBeenCalledTimes(2);
  });

  it('draws 7 days by default and 30 days on request, without reloading the page (US2)', async () => {
    api.getUsage.mockImplementation(async (days: 7 | 30) => ok(days));
    await renderPage();
    expect(api.getUsage).toHaveBeenLastCalledWith(7);
    const chart = () => section().querySelector('figure')!;
    expect(chart().querySelectorAll('polyline')[0].getAttribute('points')!.split(' ')).toHaveLength(7);
    fireEvent.click(within(section()).getByRole('button', { name: '30 jours' }));
    await act(async () => {});
    expect(api.getUsage).toHaveBeenLastCalledWith(30);
    expect(chart().querySelectorAll('polyline')[0].getAttribute('points')!.split(' ')).toHaveLength(30);
    expect(within(section()).getByRole('button', { name: '30 jours' })).toHaveAttribute('aria-pressed', 'true');
  });

  it("keeps a day without consumption as a 0 point and gives each day's values as text (US2)", async () => {
    await renderPage();
    const rows = section().querySelectorAll('figure tbody tr');
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent('2026-09-01');
    expect(rows[0]).toHaveTextContent('0 (0 %)');
    expect(rows[6]).toHaveTextContent('50 000 (50 %)');
  });

  it('explains how to configure the token instead of failing (US3)', async () => {
    api.getUsage.mockResolvedValue({ status: 'ok', value: { state: 'not-configured', missing: ['CLOUDFLARE_API_TOKEN'] } });
    await renderPage();
    expect(section()).toHaveTextContent('Jeton Cloudflare non configuré');
    expect(section()).toHaveTextContent('CLOUDFLARE_API_TOKEN');
    expect(section()).toHaveTextContent('wrangler secret put CLOUDFLARE_API_TOKEN');
    expect(within(section()).queryByRole('alert')).toBeNull();
  });

  it.each([
    ['a refused token', { status: 'ok', value: { state: 'denied' } }, 'Cloudflare a refusé le jeton'],
    ['Cloudflare being down', { status: 'ok', value: { state: 'unavailable' } }, 'indisponibles'],
    ['the call failing', { status: 'unavailable' }, 'Enregistrement impossible'],
  ])('says so and offers to retry on %s, leaving the other sections usable (US3)', async (_name, reply, text) => {
    api.getUsage.mockResolvedValueOnce(reply).mockResolvedValue(ok(7));
    await renderPage();
    expect(within(section()).getByRole('alert')).toHaveTextContent(text);
    fireEvent.click(within(section()).getByRole('button', { name: 'Réessayer' }));
    await act(async () => {});
    expect(section()).toHaveTextContent('50 000 / 100 000');
  });

  describe('les sept pages du site (specs/071)', () => {
    beforeEach(() => { openSection = '#pages'; });
    const pages = async () => (await screen.findByRole('heading', { name: 'Pages du site' })).closest('section') as HTMLElement;
    const row = (section: HTMLElement, label: string) => within(section).getByText(label, { exact: false, selector: 'p' }).parentElement as HTMLElement;
    const allOffExcept = (...on: string[]) => Object.fromEntries(
      ['searchPage', 'pinnedPage', 'pricesPage', 'hdvPage', 'petsPage', 'forgemagiePage', 'brisagePage'].map((field) => [field, on.includes(field)]),
    );

    it('liste les sept pages dans l\'ordre de la navigation, chacune avec son état en texte', async () => {
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await pages();
      await within(section).findByText('Désactivée');
      const labels = within(section).getAllByText(/^Page .* :/, { selector: 'p' }).map((paragraph) => paragraph.textContent);
      expect(labels).toEqual([
        'Page Recherche : Activée',
        'Page Suivis : Activée',
        'Page Rentabilité : Activée',
        'Page HDV : Activée',
        'Page XP Familier : Activée',
        'Page Forgemagie : Désactivée',
        'Page Brisage : Activée',
      ]);
    });

    it.each(['Recherche', 'Suivis', 'Rentabilité', 'XP Familier', 'Brisage'])('désactive la page %s seule, sans demander confirmation', async (label) => {
      const field = { Recherche: 'searchPage', Suivis: 'pinnedPage', Rentabilité: 'pricesPage', 'XP Familier': 'petsPage', Brisage: 'brisagePage' }[label] as string;
      api.saveSettings.mockResolvedValue({ status: 'ok', value: { ...ALL_PAGES, [field]: false } });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await pages();
      fireEvent.click(await within(section).findByRole('button', { name: `Désactiver la page ${label}` }));
      expect(await within(section).findByText(`Page ${label} désactivée.`)).toBeInTheDocument();
      expect(api.saveSettings).toHaveBeenCalledWith({ [field]: false });
      expect(within(row(section, `Page ${label} :`)).getByText('Désactivée')).toBeInTheDocument();
    });

    it('demande confirmation pour désactiver la dernière page active, et ne l\'envoie qu\'après', async () => {
      api.getSettings.mockResolvedValue({ status: 'ok', value: allOffExcept('brisagePage') });
      api.saveSettings.mockResolvedValue({ status: 'ok', value: allOffExcept() });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await pages();
      fireEvent.click(await within(section).findByRole('button', { name: 'Désactiver la page Brisage' }));
      expect(within(section).getByRole('alert')).toHaveTextContent("C'est la dernière page active : le site n'aura plus aucune page disponible.");
      expect(api.saveSettings).not.toHaveBeenCalled();
      fireEvent.click(within(section).getByRole('button', { name: 'Confirmer la désactivation' }));
      expect(await within(section).findByText('Page Brisage désactivée.')).toBeInTheDocument();
      expect(api.saveSettings).toHaveBeenCalledWith({ brisagePage: false });
    });

    it('annule la désactivation de la dernière page active sans rien envoyer', async () => {
      api.getSettings.mockResolvedValue({ status: 'ok', value: allOffExcept('brisagePage') });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await pages();
      fireEvent.click(await within(section).findByRole('button', { name: 'Désactiver la page Brisage' }));
      fireEvent.click(within(section).getByRole('button', { name: 'Annuler' }));
      expect(api.saveSettings).not.toHaveBeenCalled();
      expect(within(section).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(section).getByRole('button', { name: 'Désactiver la page Brisage' })).toBeInTheDocument();
    });

    it('ne demande pas de confirmation pour activer une page, ni pour désactiver une page quand une autre reste active', async () => {
      api.getSettings.mockResolvedValue({ status: 'ok', value: allOffExcept('brisagePage', 'hdvPage') });
      api.saveSettings.mockResolvedValue({ status: 'ok', value: allOffExcept('brisagePage') });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await pages();
      fireEvent.click(await within(section).findByRole('button', { name: 'Désactiver la page HDV' }));
      expect(await within(section).findByText('Page HDV désactivée.')).toBeInTheDocument();
      expect(within(section).queryByRole('button', { name: 'Confirmer la désactivation' })).not.toBeInTheDocument();
    });

    it('dit quand l\'enregistrement échoue et garde l\'état réellement enregistré', async () => {
      api.saveSettings.mockResolvedValue({ status: 'unavailable' });
      window.location.hash = openSection;
      render(<AdminPage />);
      const section = await pages();
      fireEvent.click(await within(section).findByRole('button', { name: 'Désactiver la page Suivis' }));
      expect(await within(section).findByRole('alert')).toBeInTheDocument();
      expect(within(row(section, 'Page Suivis :')).getByText('Activée')).toBeInTheDocument();
    });
  });
});
