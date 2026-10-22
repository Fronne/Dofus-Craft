import { describe, expect, it } from 'vitest';
import {
  parseSection,
  summarizeBanner,
  summarizeCounters,
  summarizeKeys,
  summarizeMappings,
  summarizePages,
  summarizeUsage,
} from '../../admin/dashboard-summary';
import type { SnifferKeyJson, SnifferMappingJson } from '../../admin/admin-api';
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
    });
    it('renvoie undefined pour une ancre vide ou inconnue', () => {
      expect(parseSection('')).toBeUndefined();
      expect(parseSection('#')).toBeUndefined();
      expect(parseSection('#nimporte')).toBeUndefined();
    });
  });

  it('résume les pages actives', () => {
    expect(summarizePages({ forgemagiePage: false, hdvPage: true }).text).toBe('1 page active sur 2');
    expect(summarizePages({ forgemagiePage: true, hdvPage: true }).text).toBe('2 pages actives sur 2');
    expect(summarizePages({ forgemagiePage: false, hdvPage: false }).text).toBe('0 page active sur 2');
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
});
