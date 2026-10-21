import {
  USAGE_LABELS,
  USAGE_LEVEL_TEXT,
  USAGE_LIMITS,
  USAGE_METRICS,
  usageLevel,
  usagePercent,
  type UsageLevel,
  type UsageMetric,
  type UsageResponse,
} from '../src/domain/cloudflare-usage';
import type { InfoMessage } from '../src/domain/info-message';
import type { PlayerCounter } from '../src/domain/player-counter';
import type { SiteSettings } from '../src/domain/site-settings';
import type { SnifferKeyJson, SnifferMappingJson } from './admin-api';

// specs/068-admin-dashboard (data-model.md): the dashboard's cards and the pure rules that turn what the
// administration already reads into a one-line summary.
export type SectionId = 'pages' | 'bandeau' | 'compteurs' | 'cles' | 'correspondances' | 'cloudflare';

export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'pages', title: 'Pages du site' },
  { id: 'bandeau', title: "Bandeau d'information" },
  { id: 'compteurs', title: 'Compteurs' },
  { id: 'cles', title: 'Clés sniffer' },
  { id: 'correspondances', title: 'Mapping' },
  { id: 'cloudflare', title: 'Utilisation Cloudflare' },
];

export type CardTone = 'neutral' | 'good' | 'warning' | 'over';
export type CardSummary = { state: 'loading' | 'ok' | 'unavailable'; text: string; tone: CardTone };

export const LOADING: CardSummary = { state: 'loading', text: 'Chargement…', tone: 'neutral' };
export const UNAVAILABLE: CardSummary = { state: 'unavailable', text: 'Indisponible', tone: 'neutral' };

const ok = (text: string, tone: CardTone = 'neutral'): CardSummary => ({ state: 'ok', text, tone });

// `#compteurs` or `compteurs` is a section; anything else (empty, unknown) is the dashboard.
export function parseSection(hash: string): SectionId | undefined {
  const id = hash.replace(/^#/, '');
  return SECTIONS.find((section) => section.id === id)?.id;
}

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

export function summarizePages(settings: SiteSettings): CardSummary {
  const active = [settings.forgemagiePage, settings.hdvPage].filter(Boolean).length;
  return ok(`${plural(active, 'page active', 'pages actives')} sur 2`);
}

export function summarizeBanner(message: InfoMessage | null): CardSummary {
  return message === null ? ok('Aucun bandeau') : ok('Bandeau affiché', 'good');
}

export function summarizeCounters(counters: PlayerCounter[]): CardSummary {
  return counters.length === 0 ? ok('Aucun compteur') : ok(plural(counters.length, 'compteur', 'compteurs'));
}

export function summarizeKeys(keys: SnifferKeyJson[]): CardSummary {
  const active = keys.filter((key) => key.revokedAt === null).length;
  return active === 0 ? ok('Aucune clé active') : ok(plural(active, 'clé active', 'clés actives'), 'good');
}

export function summarizeMappings(mappings: SnifferMappingJson[]): CardSummary {
  const active = mappings.find((mapping) => mapping.active);
  if (!active) return ok('Aucune correspondance active');
  return ok(`${plural(mappings.length, 'correspondance', 'correspondances')} · active : ${active.build}`, 'good');
}

const LEVEL_TONE: Record<UsageLevel, CardTone> = { ok: 'good', warning: 'warning', over: 'over' };
const LEVEL_RANK: Record<UsageLevel, number> = { ok: 0, warning: 1, over: 2 };

// The worst level of the three limits; the text names the metric closest to its limit.
export function summarizeUsage(usage: UsageResponse): CardSummary {
  if (usage.state === 'not-configured') return ok('Jeton non configuré');
  if (usage.state !== 'ok') return UNAVAILABLE;
  const today = usage.history[usage.history.length - 1];
  if (!today) return UNAVAILABLE;
  let worst: UsageLevel = 'ok';
  let top: UsageMetric = USAGE_METRICS[0];
  for (const metric of USAGE_METRICS) {
    const level = usageLevel(today[metric], USAGE_LIMITS[metric]);
    if (LEVEL_RANK[level] > LEVEL_RANK[worst]) worst = level;
    if (today[metric] / USAGE_LIMITS[metric] > today[top] / USAGE_LIMITS[top]) top = metric;
  }
  const percent = usagePercent(today[top], USAGE_LIMITS[top]);
  return ok(`${USAGE_LABELS[top]} : ${percent} % · ${USAGE_LEVEL_TEXT[worst]}`, LEVEL_TONE[worst]);
}
