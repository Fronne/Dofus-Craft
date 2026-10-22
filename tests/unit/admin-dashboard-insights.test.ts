import { describe, expect, it } from 'vitest';
import { bannerRemaining, counterBars, keyActivity, mappingAge } from '../../admin/dashboard-insights';
import type { SnifferKeyJson, SnifferMappingJson } from '../../admin/admin-api';
import type { InfoMessage } from '../../src/domain/info-message';
import type { PlayerCounter } from '../../src/domain/player-counter';

// specs/070-admin-dashboard-graphiques (data-model.md « Visuels côté navigateur »).
const NOW = new Date('2026-10-22T12:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const mapping = (overrides: Partial<SnifferMappingJson> = {}): SnifferMappingJson => ({
  id: 1, build: '3.7.10.10', uploadedAt: daysAgo(2), active: true, keymapBytes: 1, schemaBytes: 1, ...overrides,
});

const key = (overrides: Partial<SnifferKeyJson> = {}): SnifferKeyJson => ({
  id: 'k', label: 'Alice', createdAt: daysAgo(100), revokedAt: null, lastSeenAt: daysAgo(1), rowsToday: 0, ...overrides,
});

describe('mappingAge', () => {
  it('has nothing to say without an active mapping', () => {
    expect(mappingAge([], NOW)).toEqual({ state: 'none' });
    expect(mappingAge([mapping({ active: false })], NOW)).toEqual({ state: 'none' });
  });

  it('tells how long ago the active mapping was published', () => {
    expect(mappingAge([mapping({ uploadedAt: daysAgo(0) })], NOW)).toMatchObject({ days: 0, text: "Publiée aujourd'hui", stale: false });
    expect(mappingAge([mapping({ uploadedAt: daysAgo(1) })], NOW)).toMatchObject({ days: 1, text: 'Publiée hier' });
    expect(mappingAge([mapping({ uploadedAt: daysAgo(12) })], NOW)).toMatchObject({ days: 12, text: 'Publiée il y a 12 jours', build: '3.7.10.10' });
  });

  it('is late only strictly after 30 days, and says so in words', () => {
    expect(mappingAge([mapping({ uploadedAt: daysAgo(29) })], NOW)).toMatchObject({ stale: false });
    const thirty = mappingAge([mapping({ uploadedAt: daysAgo(30) })], NOW);
    expect(thirty).toMatchObject({ days: 30, stale: false });
    const late = mappingAge([mapping({ uploadedAt: daysAgo(31) })], NOW);
    expect(late).toMatchObject({ days: 31, stale: true });
    expect(late.state === 'ok' && late.text).toContain('en retard');
  });

  it('takes the most recently uploaded of several active mappings, and ignores inactive ones', () => {
    const result = mappingAge([
      mapping({ id: 1, build: '3.7.9.0', uploadedAt: daysAgo(40) }),
      mapping({ id: 2, build: '3.7.10.10', uploadedAt: daysAgo(3) }),
      mapping({ id: 3, build: '9.9.9', uploadedAt: daysAgo(0), active: false }),
    ], NOW);
    expect(result).toMatchObject({ build: '3.7.10.10', days: 3 });
  });

  it('never gives a negative age for a date slightly in the future', () => {
    expect(mappingAge([mapping({ uploadedAt: new Date(NOW.getTime() + 60_000).toISOString() })], NOW)).toMatchObject({ days: 0 });
  });
});

describe('keyActivity', () => {
  it('tells a never used key, an asleep one and a recent one', () => {
    const result = keyActivity([
      key({ id: 'a', label: 'Alice', lastSeenAt: daysAgo(1) }),
      key({ id: 'b', label: 'Bob', lastSeenAt: daysAgo(31) }),
      key({ id: 'c', label: 'Carole', lastSeenAt: null }),
    ], NOW);
    expect(result.map((entry) => [entry.label, entry.status])).toEqual([['Alice', 'recent'], ['Bob', 'dormant'], ['Carole', 'never']]);
    expect(result[1].text).toBe('endormie (aucun envoi depuis 31 jours)');
    expect(result[2].text).toBe('jamais utilisée');
  });

  it('is asleep only strictly after 30 days', () => {
    expect(keyActivity([key({ lastSeenAt: daysAgo(30) })], NOW)[0].status).toBe('recent');
    expect(keyActivity([key({ lastSeenAt: daysAgo(31) })], NOW)[0].status).toBe('dormant');
  });

  it('leaves revoked keys out', () => {
    expect(keyActivity([key({ revokedAt: daysAgo(5) }), key({ id: 'b' })], NOW).map((entry) => entry.id)).toEqual(['b']);
    expect(keyActivity([], NOW)).toEqual([]);
  });
});

const counter = (player: string, count: number, target = 'Dofus'): PlayerCounter => ({
  id: player, player, breedId: 1, sex: 'm', count, atLeast: false, unitOne: 'fois', unitMany: 'fois',
  target: { itemId: 1, name: target, icon: 'https://api.dofusdb.fr/img/items/1.png' }, createdAt: 'x', updatedAt: 'x',
});

describe('counterBars', () => {
  it('sorts the counters from the highest to the lowest, ties by label', () => {
    expect(counterBars([counter('Nicomoux', 5), counter('Zed', 120), counter('Abel', 5)])).toEqual([
      { label: 'Zed · Dofus', count: 120 },
      { label: 'Abel · Dofus', count: 5 },
      { label: 'Nicomoux · Dofus', count: 5 },
    ]);
  });

  it('is empty without counter', () => {
    expect(counterBars([])).toEqual([]);
  });
});

const banner = (endsAt: string | null): InfoMessage => ({ text: 'Bonjour', tone: 'info', endsAt, version: 'v' });

describe('bannerRemaining', () => {
  it('has nothing to say without a banner', () => {
    expect(bannerRemaining(null, NOW)).toEqual({ state: 'none' });
  });

  it('says a banner without an end date has none', () => {
    expect(bannerRemaining(banner(null), NOW)).toEqual({ state: 'open-ended', text: 'Sans fin programmée' });
  });

  it('counts days when a day or more is left', () => {
    expect(bannerRemaining(banner(new Date(NOW.getTime() + 5 * 86_400_000).toISOString()), NOW)).toMatchObject({ state: 'ok', text: 'Se termine dans 5 jours' });
    expect(bannerRemaining(banner(new Date(NOW.getTime() + 86_400_000).toISOString()), NOW)).toMatchObject({ text: 'Se termine dans 1 jour' });
    expect(bannerRemaining(banner(new Date(NOW.getTime() + 2.9 * 86_400_000).toISOString()), NOW)).toMatchObject({ text: 'Se termine dans 2 jours' });
  });

  it('counts hours, at least one, under a day', () => {
    expect(bannerRemaining(banner(new Date(NOW.getTime() + 3 * 3_600_000).toISOString()), NOW)).toMatchObject({ text: 'Se termine dans 3 heures' });
    expect(bannerRemaining(banner(new Date(NOW.getTime() + 10 * 60_000).toISOString()), NOW)).toMatchObject({ text: 'Se termine dans 1 heure' });
  });

  it('says an end date in the past is over, and treats an unreadable one the same way', () => {
    expect(bannerRemaining(banner(new Date(NOW.getTime() - 1000).toISOString()), NOW).state).toBe('expired');
    expect(bannerRemaining(banner(NOW.toISOString()), NOW).state).toBe('expired');
    expect(bannerRemaining(banner('pas une date'), NOW).state).toBe('expired');
  });
});
