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
  getTodayUsage: vi.fn(),
  getKeyContributions: vi.fn(),
  getActivity: vi.fn(),
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
    for (const name of ['getTodayUsage', 'getKeyContributions', 'getActivity'] as const) api[name].mockResolvedValue({ status: 'unavailable' });
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

  // specs/070-admin-dashboard-graphiques
  const cardOf = (name: RegExp) => within(screen.getByRole('link', { name }).closest('li') as HTMLElement);
  const hourly = (hours: { hour: number; workersRequests: number }[]) => ({
    status: 'ok',
    value: {
      state: 'ok',
      date: '2026-10-21',
      readAt: '2026-10-21T10:37:05.000Z',
      hours: hours.map((entry) => ({ d1RowsRead: 0, d1RowsWritten: 0, ...entry })),
    },
  });

  describe('US1 (070) — courbe Cloudflare de la journée en cours', () => {
    it("montre le cumul de la journée, l'heure du seuil franchi en texte et le tableau de valeurs", async () => {
      api.getTodayUsage.mockResolvedValue(hourly([{ hour: 0, workersRequests: 60_000 }, { hour: 1, workersRequests: 25_000 }]));
      await renderPage();
      const card = cardOf(/Cloudflare/);
      expect(card.getByRole('img', { name: /journée UTC en cours/ })).toBeInTheDocument();
      // Written in the page (a list item) as well as in the tooltip of the ringed point.
      expect(card.getAllByText('Requêtes Workers : 80 % franchi à 1 h UTC').some((element) => element.tagName === 'LI')).toBe(true);
      expect(card.getByText(/lu à 10:37 UTC/)).toBeInTheDocument();
      expect(card.getByText('Voir les valeurs heure par heure')).toBeInTheDocument();
      // The last point of the table is the percentage the card's own summary gives.
      expect(card.getByRole('row', { name: /1 h \(partielle\)/, hidden: true })).toHaveTextContent('85 000 (85 %)');
      expect(screen.getByRole('link', { name: /Cloudflare/ })).toHaveTextContent('Requêtes Workers : 85 %');
    });

    it("n'imbrique ni graphique ni tableau dans le lien de la carte", async () => {
      api.getTodayUsage.mockResolvedValue(hourly([{ hour: 0, workersRequests: 1 }]));
      await renderPage();
      const link = screen.getByRole('link', { name: /Cloudflare/ });
      expect(link.querySelector('svg, details')).toBeNull();
      expect(link).toHaveAccessibleName(/^Utilisation Cloudflare/);
    });

    it("dit qu'aucune limite n'a atteint 80 % quand c'est le cas", async () => {
      api.getTodayUsage.mockResolvedValue(hourly([{ hour: 0, workersRequests: 10 }]));
      await renderPage();
      expect(cardOf(/Cloudflare/).getByText("Aucune limite n'a atteint 80 % aujourd'hui.")).toBeInTheDocument();
    });

    it.each([
      ['indisponible', { status: 'ok', value: { state: 'unavailable' } }],
      ['jeton non configuré', { status: 'ok', value: { state: 'not-configured', missing: ['CLOUDFLARE_API_TOKEN'] } }],
      ['appel en échec', { status: 'unavailable' }],
    ])("%s : la carte dit « Indisponible » à la place de la courbe, sans bloquer les autres", async (_name, answer) => {
      api.getTodayUsage.mockResolvedValue(answer);
      await renderPage();
      expect(cardOf(/Cloudflare/).getByText('Indisponible')).toBeInTheDocument();
      expect(cardOf(/Cloudflare/).queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Pages du site/ })).toHaveTextContent('1 page active sur 2');
      expect(screen.getAllByRole('link')).toHaveLength(6);
    });
  });

  const contributions = (overrides = {}) => ({
    status: 'ok',
    value: {
      month: '2026-10',
      months: ['2026-10', '2026-09'],
      total: 150,
      keys: [
        { keyId: 'a', label: 'Alice', revoked: false, rows: 120 },
        { keyId: 'b', label: 'Bob', revoked: true, rows: 30 },
      ],
      days: [{ date: '2026-10-01', rows: 150 }],
      ...overrides,
    },
  });

  describe('US2 (070) — lignes ajoutées par clé sur le mois', () => {
    it('montre le total du mois et une barre par clé, la clé révoquée signalée en texte', async () => {
      api.getKeyContributions.mockResolvedValue(contributions());
      await renderPage();
      const card = cardOf(/Clés/);
      expect(card.getByText('150 lignes ajoutées ce mois-ci')).toBeInTheDocument();
      const rows = card.getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('Alice');
      expect(rows[0]).toHaveTextContent('120');
      expect(rows[1]).toHaveTextContent('Bob');
      expect(rows[1]).toHaveTextContent('révoquée');
      expect(rows[1]).toHaveTextContent('30');
    });

    it('donne les mêmes valeurs dans un tableau, hors du lien de la carte', async () => {
      api.getKeyContributions.mockResolvedValue(contributions());
      await renderPage();
      const card = cardOf(/Clés/);
      expect(card.getByText('Voir les valeurs')).toBeInTheDocument();
      expect(card.getByRole('row', { name: /Alice 120/, hidden: true })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Clés/ }).querySelector('table, details')).toBeNull();
    });

    it('un mois sans ligne le dit au lieu de montrer un graphique vide', async () => {
      api.getKeyContributions.mockResolvedValue(contributions({ total: 0, keys: [], days: [] }));
      await renderPage();
      const card = cardOf(/Clés/);
      expect(card.getByText('0 ligne ce mois-ci')).toBeInTheDocument();
      expect(card.getByText('Aucune clé.')).toBeInTheDocument();
    });

    it('une lecture en échec rend seulement le visuel des clés indisponible', async () => {
      api.getKeyContributions.mockResolvedValue({ status: 'unavailable' });
      await renderPage();
      expect(cardOf(/Clés/).getByText('Indisponible')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Clés/ })).toHaveTextContent('Aucune clé active');
      expect(screen.getAllByRole('link')).toHaveLength(6);
    });
  });

  describe('US3 (070) — évolution par jour et mois précédents', () => {
    const september = (overrides = {}) => contributions({
      month: '2026-09',
      total: 50,
      keys: [{ keyId: 'a', label: 'Alice', revoked: false, rows: 50 }],
      days: [{ date: '2026-09-01', rows: 20 }, { date: '2026-09-02', rows: 30 }],
      ...overrides,
    });

    it("montre un point par jour du mois en cours, avec ses valeurs en texte", async () => {
      api.getKeyContributions.mockResolvedValue(contributions({ days: [{ date: '2026-10-01', rows: 100 }, { date: '2026-10-02', rows: 0 }, { date: '2026-10-03', rows: 50 }] }));
      await renderPage();
      const card = cardOf(/Clés/);
      expect(card.getByRole('img', { name: 'Lignes de prix ajoutées par jour, ce mois-ci' })).toBeInTheDocument();
      expect(card.getByRole('row', { name: /2026-10-02 0/, hidden: true })).toBeInTheDocument();
    });

    it('propose les mois ayant des données, le mois en cours choisi', async () => {
      api.getKeyContributions.mockResolvedValue(contributions());
      await renderPage();
      const select = cardOf(/Clés/).getByRole('combobox', { name: 'Mois' });
      expect(select).toHaveValue('2026-10');
      expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(['octobre 2026', 'septembre 2026']);
    });

    it('un mois précédent met à jour total, répartition et jours ensemble, sans recharger', async () => {
      api.getKeyContributions.mockResolvedValueOnce(contributions());
      await renderPage();
      api.getKeyContributions.mockResolvedValueOnce(september());
      const card = cardOf(/Clés/);
      await act(async () => {
        fireEvent.change(card.getByRole('combobox', { name: 'Mois' }), { target: { value: '2026-09' } });
      });
      expect(api.getKeyContributions).toHaveBeenLastCalledWith('2026-09');
      expect(card.getByText('50 lignes ajoutées en septembre 2026')).toBeInTheDocument();
      expect(card.queryByText('Bob')).not.toBeInTheDocument();
      expect(card.getByRole('img', { name: 'Lignes de prix ajoutées par jour, en septembre 2026' })).toBeInTheDocument();
      expect(card.getByRole('combobox', { name: 'Mois' })).toHaveValue('2026-09');
    });

    it('un mois sans donnée est indiqué comme vide, pas masqué', async () => {
      api.getKeyContributions.mockResolvedValueOnce(contributions());
      await renderPage();
      api.getKeyContributions.mockResolvedValueOnce(september({ total: 0, keys: [], days: [] }));
      const card = cardOf(/Clés/);
      await act(async () => {
        fireEvent.change(card.getByRole('combobox', { name: 'Mois' }), { target: { value: '2026-09' } });
      });
      expect(card.getByText('0 ligne en septembre 2026')).toBeInTheDocument();
      expect(card.queryByRole('img')).not.toBeInTheDocument();
    });

    it('une lecture du mois en échec dit « Indisponible » en gardant le sélecteur, et on peut revenir', async () => {
      api.getKeyContributions.mockResolvedValueOnce(contributions());
      await renderPage();
      const card = cardOf(/Clés/);
      api.getKeyContributions.mockResolvedValueOnce({ status: 'unavailable' });
      await act(async () => {
        fireEvent.change(card.getByRole('combobox', { name: 'Mois' }), { target: { value: '2026-09' } });
      });
      expect(card.getByText('Indisponible')).toBeInTheDocument();
      api.getKeyContributions.mockResolvedValueOnce(contributions());
      await act(async () => {
        fireEvent.change(card.getByRole('combobox', { name: 'Mois' }), { target: { value: '2026-10' } });
      });
      expect(card.queryByText('Indisponible')).not.toBeInTheDocument();
      expect(card.getByText('150 lignes ajoutées ce mois-ci')).toBeInTheDocument();
    });
  });

  describe('US4 (070) — un visuel utile sur les autres cartes', () => {
    const itemOf = (title: string) => within(screen.getByRole('heading', { level: 2, name: title }).closest('li') as HTMLElement);
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
    const activity = {
      status: 'ok',
      value: {
        pricesTotal: 251,
        visitorsToday: 22,
        days: [
          { date: '2026-10-21', prices: { manual: 1, capture: 0, bot: 0, sniffer: 240 }, visitors: 17 },
          { date: '2026-10-22', prices: { manual: 0, capture: 0, bot: 0, sniffer: 10 }, visitors: 22 },
        ],
      },
    };

    it('ajoute les cartes « Prix communautaires » et « Visites », en lecture seule, avec leur graphique et leur tableau', async () => {
      api.getActivity.mockResolvedValue(activity);
      await renderPage();
      const prices = itemOf('Prix communautaires');
      expect(prices.getByText('251 lignes sur 30 jours')).toBeInTheDocument();
      expect(prices.getByRole('img', { name: /Lignes de prix ajoutées par jour/ })).toBeInTheDocument();
      expect(prices.getByRole('row', { name: /2026-10-21/, hidden: true })).toHaveTextContent('240');
      // The origin is named in the legend and in the table, not only by a colour or a pattern.
      expect(prices.getAllByText('Outil des amis').length).toBeGreaterThanOrEqual(2);
      const visits = itemOf('Visites');
      expect(visits.getByText("22 visiteurs aujourd'hui")).toBeInTheDocument();
      expect(visits.getByRole('img', { name: /Visiteurs par jour/ })).toBeInTheDocument();
      // Nothing to open: these two are not links, and the six sections still are.
      expect(screen.queryByRole('link', { name: /Prix communautaires|Visites/ })).not.toBeInTheDocument();
      expect(screen.getAllByRole('link')).toHaveLength(6);
    });

    it('un historique indisponible rend seulement ces deux cartes indisponibles', async () => {
      await renderPage();
      expect(itemOf('Prix communautaires').getAllByText('Indisponible')).toHaveLength(2);
      expect(itemOf('Visites').getAllByText('Indisponible')).toHaveLength(2);
      expect(screen.getByRole('link', { name: /Pages du site/ })).toHaveTextContent('1 page active sur 2');
    });

    it('sans prix ni visiteur, le dit au lieu de montrer un graphique vide', async () => {
      api.getActivity.mockResolvedValue({ status: 'ok', value: { pricesTotal: 0, visitorsToday: 0, days: [{ date: '2026-10-22', prices: { manual: 0, capture: 0, bot: 0, sniffer: 0 }, visitors: 0 }] } });
      await renderPage();
      expect(itemOf('Prix communautaires').getByText('Aucun prix ajouté sur 30 jours')).toBeInTheDocument();
      expect(itemOf('Prix communautaires').getByText('Aucune donnée')).toBeInTheDocument();
      expect(itemOf('Visites').getByText("Aucun visiteur aujourd'hui")).toBeInTheDocument();
      expect(itemOf('Visites').queryByRole('img')).not.toBeInTheDocument();
    });

    const mapping = (uploadedAt: string) => ({ id: 1, build: '3.7.10.10', uploadedAt, active: true, keymapBytes: 1, schemaBytes: 1 });

    it("dit l'ancienneté de la correspondance active, et signale en texte celle de plus de 30 jours", async () => {
      api.listSnifferMappings.mockResolvedValue({ status: 'ok', value: [mapping(daysAgo(12))] });
      await renderPage();
      expect(cardOf(/Mapping/).getByText('Publiée il y a 12 jours')).toBeInTheDocument();
      expect(cardOf(/Mapping/).getByText('Version du jeu : 3.7.10.10')).toBeInTheDocument();
      cleanup();
      api.listSnifferMappings.mockResolvedValue({ status: 'ok', value: [mapping(daysAgo(40))] });
      await renderPage();
      expect(cardOf(/Mapping/).getByText(/en retard \(plus de 30 jours\)/)).toBeInTheDocument();
    });

    it('distingue les clés jamais utilisées, endormies et actives récemment, sans compter les révoquées', async () => {
      const key = (id: string, label: string, lastSeenAt: string | null, revokedAt: string | null = null) =>
        ({ id, label, createdAt: daysAgo(200), revokedAt, lastSeenAt, rowsToday: 0 });
      api.listSnifferKeys.mockResolvedValue({
        status: 'ok',
        value: [key('a', 'Alice', daysAgo(2)), key('b', 'Bob', daysAgo(45)), key('c', 'Carole', null), key('d', 'Denis', null, daysAgo(3))],
      });
      api.getKeyContributions.mockResolvedValue(contributions());
      await renderPage();
      const card = cardOf(/Clés/);
      expect(card.getByText('Alice : active récemment')).toBeInTheDocument();
      expect(card.getByText('Bob : endormie (aucun envoi depuis 45 jours)')).toBeInTheDocument();
      expect(card.getByText('Carole : jamais utilisée')).toBeInTheDocument();
      expect(card.queryByText(/Denis :/)).not.toBeInTheDocument();
    });

    it('compare la valeur des compteurs en barres, la plus haute en premier', async () => {
      const counter = (id: string, player: string, count: number) => ({
        id, player, breedId: 1, sex: 'm', count, atLeast: false, unitOne: 'fois', unitMany: 'fois',
        target: { itemId: 1, name: 'Dofus', icon: 'https://api.dofusdb.fr/img/items/1.png' }, createdAt: 'x', updatedAt: 'x',
      });
      api.list.mockResolvedValue({ status: 'ok', value: [counter('1', 'Nicomoux', 5), counter('2', 'Zed', 120)] });
      await renderPage();
      const rows = cardOf(/Compteurs/).getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('Zed · Dofus');
      expect(rows[0]).toHaveTextContent('120');
      expect(rows[1]).toHaveTextContent('Nicomoux · Dofus');
    });

    it("dit « Aucune donnée » quand il n'y a aucun compteur", async () => {
      await renderPage();
      expect(cardOf(/Compteurs/).getByText('Aucune donnée')).toBeInTheDocument();
    });

    it("dit le temps restant du bandeau, ou qu'il est sans fin programmée", async () => {
      const message = (endsAt: string | null) => ({ status: 'ok', value: { text: 'Bonjour', tone: 'info', endsAt, version: 'v' } });
      api.getMessage.mockResolvedValue(message(new Date(Date.now() + 5.5 * 86_400_000).toISOString()));
      await renderPage();
      expect(cardOf(/Bandeau/).getByText('Se termine dans 5 jours')).toBeInTheDocument();
      cleanup();
      api.getMessage.mockResolvedValue(message(null));
      await renderPage();
      expect(cardOf(/Bandeau/).getByText('Sans fin programmée')).toBeInTheDocument();
    });

    it("n'ajoute rien sur « Pages du site », ni sur « Bandeau » quand il n'y a pas de bandeau", async () => {
      await renderPage();
      expect(screen.getByRole('link', { name: /Pages du site/ }).closest('li')?.querySelector('.dashboard-visual')).toBeNull();
      expect(screen.getByRole('link', { name: /Bandeau/ }).closest('li')?.querySelector('.dashboard-visual')).toBeNull();
    });

    it('un bandeau dont la lecture échoue le dit sans bloquer les autres', async () => {
      api.getMessage.mockResolvedValue({ status: 'unavailable' });
      await renderPage();
      expect(cardOf(/Bandeau/).getAllByText('Indisponible').length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: /Compteurs/ })).toHaveTextContent('Aucun compteur');
    });
  });

  describe('beaucoup de clés (070)', () => {
    it('garde les 8 premières clés et regroupe les autres en « Autres (N) », sans perdre le total', async () => {
      const keys = Array.from({ length: 10 }, (_, index) => ({ keyId: `k${index}`, label: `Ami ${index + 1}`, revoked: false, rows: 100 - index * 10 }));
      api.getKeyContributions.mockResolvedValue({
        status: 'ok',
        value: { month: '2026-10', months: ['2026-10'], total: 550, keys, days: [{ date: '2026-10-01', rows: 550 }] },
      });
      await renderPage();
      const card = cardOf(/Clés/);
      const bars = card.getAllByRole('listitem').map((item) => item.textContent);
      expect(bars.filter((text) => /^Ami \d/.test(text ?? ''))).toHaveLength(8);
      // The two least active keys (20 and 10 rows) are folded into one bar that still adds up.
      const others = card.getAllByRole('listitem').find((item) => /Autres \(2\)/.test(item.textContent ?? ''));
      expect(others).toHaveTextContent('30');
      expect(card.getByText('550 lignes ajoutées ce mois-ci')).toBeInTheDocument();
      // The table keeps the same fold, so the list stays short for the keyboard too.
      expect(card.getByRole('row', { name: /Autres \(2\) 30/, hidden: true })).toBeInTheDocument();
    });

    it('tronque un libellé très long à l\'affichage et le garde en entier au survol et dans le tableau', async () => {
      const label = 'Un ami au pseudonyme vraiment beaucoup trop long pour la carte';
      api.getKeyContributions.mockResolvedValue({
        status: 'ok',
        value: { month: '2026-10', months: ['2026-10'], total: 5, keys: [{ keyId: 'k', label, revoked: false, rows: 5 }], days: [{ date: '2026-10-01', rows: 5 }] },
      });
      await renderPage();
      const card = cardOf(/Clés/);
      const row = card.getByRole('listitem');
      expect(row).not.toHaveTextContent(label);
      expect(row).toHaveTextContent(/^Un ami au pseudonyme\s*…/);
      expect(row).toHaveAttribute('title', `${label} : 5`);
      expect(card.getByRole('rowheader', { name: label, hidden: true })).toBeInTheDocument();
    });
  });
});
