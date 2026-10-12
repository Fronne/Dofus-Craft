import type { PriceMode } from './price-modes';

// specs/046-hdv-huzounet-load: the rules of the HDV page's « Charger depuis Huzounet » button — which
// servers can be loaded, how a tab is cut into requests, what the player reads. No React, no network.
// The numbers follow what POST /external-prices/refresh accepts (worker/src/huzounet.ts); the site
// and the Worker are built separately, so they are repeated here rather than shared.

/** The servers the API reads on Huzounet — `READ_SERVERS` in worker/src/huzounet.ts. */
export const HUZOUNET_SERVERS: readonly string[] = ['mikhal'];
/** `REFRESH_MAX_IDS` in the Worker. */
export const SLICE_SIZE = 90;
// The Worker wants 5 s between two requests *received* for a server; the site counts from one send
// to the next, so the margin covers a difference of latency between them.
export const SLICE_SPACING_MS = 5500;
export const TOO_SOON_RETRIES = 3;

const ID_PATTERN = /^\d{1,9}$/;
const LAST_SLICE_SECONDS = 3;

export type LoadAvailability = 'ready' | 'personal-mode' | 'server-not-read';

export type RefreshOutcome =
  // `requests`: how many times Huzounet was read for this request, when the API tells — 0 means every
  // item had been read in the last hour, so the next request need not wait.
  | { status: 'ok'; refreshed: number; requests?: number }
  // The tab was loaded to its end less than an hour ago, by this player or another.
  | { status: 'hourly-limit'; retryAt?: string }
  | { status: 'too-soon' | 'unavailable' | 'disabled' | 'unknown-server' | 'unreachable' };

export type LoadFailure = Exclude<RefreshOutcome['status'], 'ok'>;

export type LoadState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number; loaded: number }
  | { status: 'finished'; total: number; loaded: number }
  | { status: 'stopped'; done: number; total: number; loaded: number }
  | { status: 'failed'; done: number; total: number; loaded: number; cause: LoadFailure; retryAt?: string };

export function loadAvailability(priceMode: PriceMode, serverId: string | undefined): LoadAvailability {
  if (priceMode !== 'community') return 'personal-mode';
  return serverId !== undefined && HUZOUNET_SERVERS.includes(serverId) ? 'ready' : 'server-not-read';
}

/** The ids the API accepts, without duplicates. One refused id would get its whole request refused. */
export function loadableIds(ids: string[]): string[] {
  return [...new Set(ids)].filter((id) => ID_PATTERN.test(id));
}

export function sliceIds(ids: string[]): string[][] {
  const accepted = loadableIds(ids);
  const slices: string[][] = [];
  for (let start = 0; start < accepted.length; start += SLICE_SIZE) slices.push(accepted.slice(start, start + SLICE_SIZE));
  return slices;
}

/** How long loading `count` items takes, roughly; 0 when a single request is enough. */
export function estimatedSeconds(count: number): number {
  const slices = Math.ceil(count / SLICE_SIZE);
  return slices <= 1 ? 0 : Math.round((slices - 1) * SLICE_SPACING_MS / 1000 + LAST_SLICE_SECONDS);
}

export function durationLabel(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds < 60) return `environ ${Math.max(5, Math.round(seconds / 5) * 5)} s`;
  return `environ ${Math.ceil(seconds / 60)} min`;
}

function loadedSentence(loaded: number): string {
  return loaded === 1 ? '1 prix chargé.' : `${loaded} prix chargés.`;
}

/** « 15 h 05 », in the player's own time; nothing for a date that cannot be read. */
function retryTimeLabel(retryAt: string): string {
  const date = new Date(retryAt);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
}

const FAILURE_MESSAGES: Record<LoadFailure, string> = {
  'too-soon': 'Réessaie dans quelques secondes.',
  'hourly-limit': 'Cet onglet a déjà été chargé il y a moins d\'une heure.',
  unavailable: 'Huzounet ne répond pas pour le moment.',
  disabled: 'Le chargement depuis Huzounet est indisponible.',
  'unknown-server': 'Les prix de ce serveur ne sont pas relus.',
  unreachable: 'Chargement impossible : l\'API ne répond pas.',
};

/** What the player reads once a load is over; nothing before, or while it runs. */
export function loadMessage(state: LoadState): string {
  switch (state.status) {
    case 'finished':
      if (state.loaded === 0) return 'Les prix sont déjà à jour.';
      return state.loaded === 1 ? '1 prix chargé depuis Huzounet.' : `${state.loaded} prix chargés depuis Huzounet.`;
    case 'stopped':
      return state.loaded === 0 ? 'Chargement arrêté : aucun prix chargé.' : `Chargement arrêté : ${loadedSentence(state.loaded)}`;
    case 'failed':
      if (state.cause === 'hourly-limit') {
        const time = state.retryAt ? retryTimeLabel(state.retryAt) : '';
        return time ? `${FAILURE_MESSAGES[state.cause]} Prochain chargement possible à ${time}.` : FAILURE_MESSAGES[state.cause];
      }
      return state.loaded > 0 ? `${FAILURE_MESSAGES[state.cause]} ${loadedSentence(state.loaded)}` : FAILURE_MESSAGES[state.cause];
    default:
      return '';
  }
}

export const UNAVAILABLE_REASONS: Record<Exclude<LoadAvailability, 'ready'>, string> = {
  'personal-mode': 'Les prix Huzounet se chargent en Mode communautaire.',
  'server-not-read': FAILURE_MESSAGES['unknown-server'],
};

export type PriceFragility = 'stale' | 'provisional';

/** Same words as the Recherche page of the live site. */
export const FRAGILE_LABELS: Record<PriceFragility, string> = {
  provisional: 'peu de relevés',
  stale: 'relevé ancien',
};
