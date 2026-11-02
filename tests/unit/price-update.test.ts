import { describe, expect, it } from 'vitest';
import { formatPriceUpdate } from '../../src/domain/price-update';

// specs/082-auteur-prix-communautaires: « par Pseudo · il y a 2 h ».
const now = new Date('2026-11-02T12:00:00.000Z');
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

describe('formatPriceUpdate', () => {
  it('tells the author and the age', () => {
    expect(formatPriceUpdate(ago(2 * 3600), 'Cyril', now)).toBe('par Cyril · il y a 2 heures');
  });

  it('tells only the age without an author', () => {
    expect(formatPriceUpdate(ago(2 * 3600), undefined, now)).toBe('il y a 2 heures');
  });

  it('says « quelques instants » under a minute', () => {
    expect(formatPriceUpdate(ago(20), 'Cyril', now)).toBe('par Cyril · il y a quelques instants');
    expect(formatPriceUpdate(ago(20), undefined, now)).toBe('il y a quelques instants');
  });

  it('counts minutes and days from a minute on', () => {
    expect(formatPriceUpdate(ago(5 * 60), 'Cyril', now)).toBe('par Cyril · il y a 5 minutes');
    expect(formatPriceUpdate(ago(3 * 86_400), undefined, now)).toBe('il y a 3 jours');
  });
});
