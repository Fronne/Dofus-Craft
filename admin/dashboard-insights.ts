import type { InfoMessage } from '../src/domain/info-message';
import type { PlayerCounter } from '../src/domain/player-counter';
import type { SnifferKeyJson, SnifferMappingJson } from './admin-api';

// specs/070-admin-dashboard-graphiques (data-model.md « Visuels côté navigateur »): what the dashboard says about the
// cards that already hold their data, as pure rules taking `now` so they are tested without a clock.
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
// After this many days without news, a mapping is late and a key is asleep.
export const STALE_AFTER_DAYS = 30;

const wholeDays = (from: string, now: Date) => Math.max(0, Math.floor((now.getTime() - Date.parse(from)) / DAY_MS));
const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

export type MappingAge =
  | { state: 'none' }
  | { state: 'ok'; build: string; uploadedAt: string; days: number; stale: boolean; text: string };

// The active mapping (the most recently uploaded when several builds have one), how old it is, and whether that is
// strictly more than 30 days: the game's client may then have changed under it.
export function mappingAge(mappings: SnifferMappingJson[], now: Date): MappingAge {
  const active = mappings.filter((mapping) => mapping.active).sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))[0];
  if (!active) return { state: 'none' };
  const days = wholeDays(active.uploadedAt, now);
  const when = days === 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} jours`;
  const stale = days > STALE_AFTER_DAYS;
  return { state: 'ok', build: active.build, uploadedAt: active.uploadedAt, days, stale, text: `Publiée ${when}${stale ? ` · en retard (plus de ${STALE_AFTER_DAYS} jours)` : ''}` };
}

export type KeyStatus = 'recent' | 'dormant' | 'never';
export type KeyActivity = { id: string; label: string; status: KeyStatus; text: string };

// Revoked keys are left out: they are not expected to send anything. `lastSeenAt` is the key's last call.
export function keyActivity(keys: SnifferKeyJson[], now: Date): KeyActivity[] {
  return keys
    .filter((key) => key.revokedAt === null)
    .map((key): KeyActivity => {
      if (key.lastSeenAt === null) return { id: key.id, label: key.label, status: 'never', text: 'jamais utilisée' };
      const days = wholeDays(key.lastSeenAt, now);
      return days > STALE_AFTER_DAYS
        ? { id: key.id, label: key.label, status: 'dormant', text: `endormie (aucun envoi depuis ${days} jours)` }
        : { id: key.id, label: key.label, status: 'recent', text: 'active récemment' };
    });
}

export type CounterBar = { label: string; count: number };

export function counterBars(counters: PlayerCounter[]): CounterBar[] {
  return counters
    .map((counter) => ({ label: `${counter.player} · ${counter.target.name}`, count: counter.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'));
}

export type BannerRemaining =
  | { state: 'none' }
  | { state: 'open-ended'; text: string }
  | { state: 'expired'; text: string }
  | { state: 'ok'; ms: number; text: string };

// Days when there is a day or more left, otherwise hours (at least one).
export function bannerRemaining(message: InfoMessage | null, now: Date): BannerRemaining {
  if (message === null) return { state: 'none' };
  if (message.endsAt === null) return { state: 'open-ended', text: 'Sans fin programmée' };
  const ms = Date.parse(message.endsAt) - now.getTime();
  if (Number.isNaN(ms) || ms <= 0) return { state: 'expired', text: 'Fin programmée dépassée : le bandeau n\'est plus affiché' };
  const text = ms >= DAY_MS
    ? `Se termine dans ${plural(Math.floor(ms / DAY_MS), 'jour', 'jours')}`
    : `Se termine dans ${plural(Math.max(1, Math.ceil(ms / HOUR_MS)), 'heure', 'heures')}`;
  return { state: 'ok', ms, text };
}
