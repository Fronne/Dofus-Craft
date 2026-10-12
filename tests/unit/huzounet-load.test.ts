import { describe, expect, it } from 'vitest';
import {
  durationLabel,
  estimatedSeconds,
  HUZOUNET_SERVERS,
  loadAvailability,
  loadMessage,
  sliceIds,
  SLICE_SIZE,
  SLICE_SPACING_MS,
  TOO_SOON_RETRIES,
  type LoadFailure,
} from '../../src/domain/huzounet-load';

// specs/046-hdv-huzounet-load: the rules of the HDV page's « Charger depuis Huzounet » button.
const ids = (count: number) => Array.from({ length: count }, (_, index) => String(index + 1));

describe('Huzounet load rules (specs/046)', () => {
  it('follows what the API accepts: 90 items a request, more than 5 s apart, Mikhal only', () => {
    expect(SLICE_SIZE).toBe(90);
    expect(SLICE_SPACING_MS).toBeGreaterThan(5000);
    expect(TOO_SOON_RETRIES).toBe(3);
    expect(HUZOUNET_SERVERS).toEqual(['mikhal']);
  });

  describe('sliceIds', () => {
    it.each([[0, 0], [1, 1], [90, 1], [91, 2], [128, 2], [2537, 29]])('cuts %i items into %i requests', (count, slices) => {
      const result = sliceIds(ids(count));
      expect(result).toHaveLength(slices);
      expect(result.every((slice) => slice.length >= 1 && slice.length <= 90)).toBe(true);
      expect(result.flat()).toEqual(ids(count));
    });

    it('keeps the order, and puts the remainder in the last request', () => {
      expect(sliceIds(ids(128)).map((slice) => slice.length)).toEqual([90, 38]);
    });

    it('drops duplicates and ids the API would refuse', () => {
      expect(sliceIds(['12', '12', 'abc', '', '1234567890', '7'])).toEqual([['12', '7']]);
    });
  });

  describe('loadAvailability', () => {
    it('is ready in Mode communautaire on a server the API reads', () => {
      expect(loadAvailability('community', 'mikhal')).toBe('ready');
    });

    it('is not in Mode personnel, whatever the server', () => {
      expect(loadAvailability('personal', 'mikhal')).toBe('personal-mode');
      expect(loadAvailability('personal', undefined)).toBe('personal-mode');
    });

    it('is not on another server, or without one', () => {
      expect(loadAvailability('community', 'draconiros')).toBe('server-not-read');
      expect(loadAvailability('community', undefined)).toBe('server-not-read');
    });
  });

  describe('announced duration', () => {
    it('announces none when one request is enough', () => {
      expect(durationLabel(estimatedSeconds(35))).toBe('');
      expect(durationLabel(estimatedSeconds(90))).toBe('');
    });

    it('announces seconds for a small tab and minutes for Ressources', () => {
      expect(durationLabel(estimatedSeconds(128))).toBe('environ 10 s');
      expect(durationLabel(estimatedSeconds(105))).toBe('environ 10 s');
      expect(durationLabel(estimatedSeconds(2537))).toBe('environ 3 min');
    });

    it('keeps the whole Ressources tab under four minutes (SC-002)', () => {
      expect(estimatedSeconds(2537)).toBeLessThan(240);
    });
  });

  describe('loadMessage', () => {
    it('says nothing before a load, or while it runs', () => {
      expect(loadMessage({ status: 'idle' })).toBe('');
      expect(loadMessage({ status: 'running', done: 90, total: 128, loaded: 4 })).toBe('');
    });

    it('tells how many prices were loaded, or that they are up to date', () => {
      expect(loadMessage({ status: 'finished', total: 128, loaded: 12 })).toBe('12 prix chargés depuis Huzounet.');
      expect(loadMessage({ status: 'finished', total: 128, loaded: 1 })).toBe('1 prix chargé depuis Huzounet.');
      expect(loadMessage({ status: 'finished', total: 128, loaded: 0 })).toBe('Les prix sont déjà à jour.');
    });

    it('tells what was loaded before a stop', () => {
      expect(loadMessage({ status: 'stopped', done: 90, total: 128, loaded: 7 })).toBe('Chargement arrêté : 7 prix chargés.');
      expect(loadMessage({ status: 'stopped', done: 90, total: 128, loaded: 1 })).toBe('Chargement arrêté : 1 prix chargé.');
      expect(loadMessage({ status: 'stopped', done: 0, total: 128, loaded: 0 })).toBe('Chargement arrêté : aucun prix chargé.');
    });

    it('gives each failure its own message (SC-004)', () => {
      const failed = (cause: LoadFailure, loaded = 0) => loadMessage({ status: 'failed', done: 0, total: 128, loaded, cause });
      const messages = (['too-soon', 'unavailable', 'disabled', 'unknown-server', 'unreachable'] as const).map((cause) => failed(cause));
      expect(messages).toEqual([
        'Réessaie dans quelques secondes.',
        'Huzounet ne répond pas pour le moment.',
        'Le chargement depuis Huzounet est indisponible.',
        'Les prix de ce serveur ne sont pas relus.',
        'Chargement impossible : l\'API ne répond pas.',
      ]);
      expect(new Set(messages).size).toBe(5);
      expect(failed('hourly-limit')).toBe('Cet onglet a déjà été chargé il y a moins d\'une heure.');
      expect(failed('unavailable', 90)).toBe('Huzounet ne répond pas pour le moment. 90 prix chargés.');
      expect(failed('too-soon', 1)).toBe('Réessaie dans quelques secondes. 1 prix chargé.');
    });
  });

  it('tells when a tab loaded within the hour can be loaded again, in the player\'s own time', () => {
    const retryAt = new Date(2026, 9, 12, 15, 5).toISOString();
    expect(loadMessage({ status: 'failed', done: 0, total: 128, loaded: 0, cause: 'hourly-limit', retryAt }))
      .toBe('Cet onglet a déjà été chargé il y a moins d\'une heure. Prochain chargement possible à 15 h 05.');
    expect(loadMessage({ status: 'failed', done: 0, total: 128, loaded: 0, cause: 'hourly-limit', retryAt: 'soon' }))
      .toBe('Cet onglet a déjà été chargé il y a moins d\'une heure.');
  });
});
