import { describe, expect, it } from 'vitest';
import {
  READ_ONLY_CARDS,
  SECTIONS,
  parseSection,
  summarizeBanner,
  summarizeCounters,
  summarizeKeys,
  summarizeMappings,
  summarizePages,
  summarizePrices,
  summarizeUsage,
  summarizeVisits,
} from '../../admin/dashboard-summary';
import { DEFAULT_SITE_SETTINGS as ALL_PAGES } from '../../src/domain/site-settings';
import type { Activity, SnifferKeyJson, SnifferMappingJson } from '../../admin/admin-api';
import type { PlayerCounter } from '../../src/domain/player-counter';
import type { UsageDay, UsageResponse } from '../../src/domain/cloudflare-usage';

const key = (revokedAt: string | null): SnifferKeyJson => ({ id: 'k', label: 'Ami', createdAt: '2026-10-01', revokedAt, lastSeenAt: null, rowsToday: 0 });
const mapping = (id: number, active: boolean): SnifferMappingJson => ({ id, build: `b${id}`, uploadedAt: '2026-10-01', active, keymapBytes: 1, schemaBytes: 1 });
const day = (workersRequests: number, d1RowsRead = 0, d1RowsWritten = 0): UsageDay => ({ date: '2026-10-21', workersRequests, d1RowsRead, d1RowsWritten });
const usage = (today: UsageDay): UsageResponse => ({ state: 'ok', days: 7, readAt: '2026-10-21T10:00:00Z', history: [today] });

describe('tableau de bord de l\'administration (specs/068-admin-dashboard)', () => {
  describe('parseSection', () => {
    it('reconnaît une ancre avec ou sans #', () => {
      expect(parseSection('#compteurs')).toBe('compteurs');
      expect(parseSection('cloudflare')).toBe('cloudflare');
      expect(parseSection('#donnees')).toBe('donnees');
    });
    it('renvoie undefined pour une ancre vide ou inconnue', () => {
      expect(parseSection('')).toBeUndefined();
      expect(parseSection('#')).toBeUndefined();
      expect(parseSection('#nimporte')).toBeUndefined();
    });
  });

  it('résume les pages actives', () => {
    expect(summarizePages({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true }).text).toBe('6 pages actives sur 7');
    expect(summarizePages({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true }).text).toBe('7 pages actives sur 7');
    expect(summarizePages({ ...ALL_PAGES, searchPage: false, pinnedPage: false, pricesPage: false, hdvPage: false, petsPage: false }).text).toBe('1 page active sur 7');
    expect(summarizePages({ ...ALL_PAGES, searchPage: false, pinnedPage: false, pricesPage: false, hdvPage: false, petsPage: false, brisagePage: false }).text).toBe('0 page active sur 7');
  });

  it('résume le bandeau', () => {
    expect(summarizeBanner(null).text).toBe('Aucun bandeau');
    expect(summarizeBanner({ text: 'Hello' } as never).text).toBe('Bandeau affiché');
  });

  it('résume les compteurs', () => {
    expect(summarizeCounters([]).text).toBe('Aucun compteur');
    expect(summarizeCounters([{}] as PlayerCounter[]).text).toBe('1 compteur');
    expect(summarizeCounters([{}, {}] as PlayerCounter[]).text).toBe('2 compteurs');
  });

  it('ne compte que les clés non révoquées', () => {
    expect(summarizeKeys([]).text).toBe('Aucune clé active');
    expect(summarizeKeys([key('2026-10-02')]).text).toBe('Aucune clé active');
    expect(summarizeKeys([key(null), key('2026-10-02')]).text).toBe('1 clé active');
    expect(summarizeKeys([key(null), key(null)]).text).toBe('2 clés actives');
  });

  it('résume les correspondances et la version active', () => {
    expect(summarizeMappings([]).text).toBe('Aucune correspondance active');
    expect(summarizeMappings([mapping(1, false)]).text).toBe('Aucune correspondance active');
    expect(summarizeMappings([mapping(1, false), mapping(2, true)]).text).toBe('2 correspondances · active : b2');
  });

  describe('summarizeUsage', () => {
    it('affiche la métrique la plus proche de sa limite', () => {
      const summary = summarizeUsage(usage(day(42_000)));
      expect(summary).toMatchObject({ state: 'ok', tone: 'good' });
      expect(summary.text).toBe('Requêtes Workers : 42 % · Dans la limite');
    });
    it('avertit à 80 %', () => {
      expect(summarizeUsage(usage(day(80_000)))).toMatchObject({ tone: 'warning', text: expect.stringContaining('Proche de la limite') });
    });
    it('signale le dépassement à 100 %, même si une autre métrique est plus basse', () => {
      expect(summarizeUsage(usage(day(100_000, 10)))).toMatchObject({ tone: 'over', text: expect.stringContaining('Limite dépassée') });
    });
    it('dit « Jeton non configuré » sans alerte', () => {
      expect(summarizeUsage({ state: 'not-configured', missing: [] })).toMatchObject({ state: 'ok', tone: 'neutral', text: 'Jeton non configuré' });
    });
    it('est indisponible si refusé, indisponible ou sans historique', () => {
      expect(summarizeUsage({ state: 'denied' }).state).toBe('unavailable');
      expect(summarizeUsage({ state: 'unavailable' }).state).toBe('unavailable');
      expect(summarizeUsage({ state: 'ok', days: 7, readAt: 'x', history: [] }).state).toBe('unavailable');
    });
  });

  // specs/070-admin-dashboard-graphiques
  describe('cartes en lecture seule', () => {
    const activity = (pricesTotal: number, visitorsToday: number): Activity => ({ days: [], pricesTotal, visitorsToday });

    it("ne sont pas des sections : leur ancre est inconnue, donc le tableau de bord s'affiche", () => {
      expect(READ_ONLY_CARDS.map((card) => card.id)).toEqual(['prix', 'visites']);
      expect(SECTIONS.map((section) => section.id)).not.toContain('prix');
      expect(parseSection('#prix')).toBeUndefined();
      expect(parseSection('#visites')).toBeUndefined();
    });

    it('résume les prix des 30 derniers jours', () => {
      expect(summarizePrices(activity(5120, 0))).toMatchObject({ state: 'ok', text: expect.stringMatching(/^5\s120 lignes sur 30 jours$/) });
      expect(summarizePrices(activity(1, 0)).text).toBe('1 ligne sur 30 jours');
      expect(summarizePrices(activity(0, 3)).text).toBe('Aucun prix ajouté sur 30 jours');
    });

    it('résume les visiteurs du jour', () => {
      expect(summarizeVisits(activity(0, 22)).text).toBe("22 visiteurs aujourd'hui");
      expect(summarizeVisits(activity(0, 1)).text).toBe("1 visiteur aujourd'hui");
      expect(summarizeVisits(activity(9, 0)).text).toBe("Aucun visiteur aujourd'hui");
    });
  });
});
