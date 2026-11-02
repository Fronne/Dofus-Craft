import type { FmIgnoredLine, FmMe, FmProfileSession, FmSeanceState } from './api-types';

export const SEANCE_STATE_LABELS: Record<FmSeanceState, string> = {
  running: 'En cours',
  paused: 'En pause',
  archived: 'Archivée',
};

export function fmItemDisplayName(item: { label: string | null; itemName: string }): string {
  return item.label ?? item.itemName;
}

const foldForSearch = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** specs/031 FR-009: an item in FM whose name or equipment contains the query, ignoring case and accents. */
export function matchesItemQuery(item: { label: string | null; itemName: string }, query: string): boolean {
  const folded = foldForSearch(query);
  if (folded === '') return false;
  return [item.label ?? '', item.itemName].some((name) => foldForSearch(name).includes(folded));
}

/** specs/049: the name of the players' tab — the group's Discord server, when it is known. */
export function groupTabLabel(me: Pick<FmMe, 'guildName'>): string {
  return me.guildName?.trim() || 'Joueurs';
}

/** specs/049: the lines of a capture that do not count, one per item — bought twice, listed once. */
export function mergeIgnoredLines(lines: FmIgnoredLine[]): FmIgnoredLine[] {
  const byName = new Map<string, FmIgnoredLine>();
  for (const line of lines) {
    const known = byName.get(line.itemName);
    byName.set(line.itemName, known
      ? { ...known, quantity: known.quantity + line.quantity, totalKamas: known.totalKamas + line.totalKamas }
      : { ...line });
  }
  return [...byName.values()];
}

export type FmSeanceSpending = { key: string; seanceId: string | undefined; name: string; lastOpenedAt: string; spentKamas: number };

/**
 * specs/049: a profile's spending, one line per séance — its sessions added up, dated by the latest,
 * the most recent séance first. `seanceId` only when the séance can be opened by the viewer.
 */
export function spendingBySeance(sessions: FmProfileSession[]): FmSeanceSpending[] {
  const bySeance = new Map<string, FmSeanceSpending>();
  for (const session of sessions) {
    const key = session.channelId ?? session.sessionId;
    const known = bySeance.get(key);
    bySeance.set(key, {
      key,
      seanceId: session.canOpen ? session.channelId ?? undefined : known?.seanceId,
      name: known?.name ?? session.channelName,
      lastOpenedAt: known && known.lastOpenedAt > session.openedAt ? known.lastOpenedAt : session.openedAt,
      spentKamas: (known?.spentKamas ?? 0) + session.spentKamas,
    });
  }
  return [...bySeance.values()].sort((a, b) => (a.lastOpenedAt < b.lastOpenedAt ? 1 : -1));
}

const sessionDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
});

/** « 30 sept. 2026, 18:02 », in the game's time zone. */
export function formatFmDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : sessionDateFormatter.format(date);
}
