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
import { SITE_PAGES, enabledPageCount, type SiteSettings } from '../src/domain/site-settings';
import type { Activity, SnifferKeyJson, SnifferMappingJson } from './admin-api';

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
  const active = enabledPageCount(settings);
  return ok(`${plural(active, 'page active', 'pages actives')} sur ${SITE_PAGES.length}`);
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

// specs/070-admin-dashboard-graphiques: two cards with no section behind them, only to read (FR-015). They are not in
// SECTIONS, so an address anchored on them is still "unknown" and shows the dashboard.
export type ReadOnlyCardId = 'prix' | 'visites';

export const READ_ONLY_CARDS: { id: ReadOnlyCardId; title: string }[] = [
  { id: 'prix', title: 'Prix communautaires' },
  { id: 'visites', title: 'Visites' },
];

const group = new Intl.NumberFormat('fr-FR');

export function summarizePrices(activity: Activity): CardSummary {
  return activity.pricesTotal === 0
    ? ok('Aucun prix ajouté sur 30 jours')
    : ok(`${group.format(activity.pricesTotal)} ${activity.pricesTotal > 1 ? 'lignes' : 'ligne'} sur 30 jours`);
}

export function summarizeVisits(activity: Activity): CardSummary {
  return activity.visitorsToday === 0
    ? ok("Aucun visiteur aujourd'hui")
    : ok(`${plural(activity.visitorsToday, 'visiteur', 'visiteurs')} aujourd'hui`);
}

// specs/071-admin-dashboard-moderne (data-model.md « Chiffres clés »): the row of figures at the top of the dashboard.
// Each is built from what a card already read; the titles are not those of the section cards, so an accessible name
// never designates two links. A figure whose source failed is "Indisponible", never a made-up value.
export type KeyFigure = {
  id: 'pages' | 'lignes' | 'visiteurs' | 'limite';
  title: string;
  state: 'loading' | 'ok' | 'unavailable';
  value: string;
  detail: string;
  tone: CardTone;
  // The section the figure opens; none when no section holds it (the visitors).
  href?: SectionId;
};

const grouped = new Intl.NumberFormat('fr-FR');

export const figureLoading = (id: KeyFigure['id'], title: string, href?: SectionId): KeyFigure =>
  ({ id, title, state: 'loading', value: '…', detail: 'Chargement…', tone: 'neutral', href });
export const figureUnavailable = (id: KeyFigure['id'], title: string, href?: SectionId): KeyFigure =>
  ({ id, title, state: 'unavailable', value: 'Indisponible', detail: 'Lecture impossible', tone: 'neutral', href });

export function figurePages(settings: SiteSettings): KeyFigure {
  const active = enabledPageCount(settings);
  return {
    id: 'pages', title: 'Pages actives', state: 'ok', value: `${active} sur ${SITE_PAGES.length}`,
    detail: active === 0 ? 'Aucune page disponible' : 'pages affichées sur le site', tone: active === 0 ? 'over' : 'good', href: 'pages',
  };
}

export function figureLines(total: number): KeyFigure {
  return {
    id: 'lignes', title: 'Lignes ce mois-ci', state: 'ok', value: grouped.format(total),
    detail: total === 0 ? 'aucun prix ajouté ce mois-ci' : plural(total, 'ligne de prix ajoutée', 'lignes de prix ajoutées').replace(/^\d+ /, ''), tone: 'neutral', href: 'cles',
  };
}

export function figureVisitors(visitorsToday: number): KeyFigure {
  return {
    id: 'visiteurs', title: 'Visiteurs du jour', state: 'ok', value: grouped.format(visitorsToday),
    detail: visitorsToday === 0 ? "aucun visiteur aujourd'hui" : plural(visitorsToday, 'appareil unique', 'appareils uniques').replace(/^\d+ /, ''), tone: 'neutral',
  };
}

// The metric closest to its daily limit, with the level of the worst one written out (as the section card does).
export function figureLimit(usage: UsageResponse): KeyFigure {
  if (usage.state === 'not-configured') return { id: 'limite', title: 'Limite du jour', state: 'ok', value: '—', detail: 'Jeton non configuré', tone: 'neutral', href: 'cloudflare' };
  const today = usage.state === 'ok' ? usage.history[usage.history.length - 1] : undefined;
  if (!today) return figureUnavailable('limite', 'Limite du jour', 'cloudflare');
  let worst: UsageLevel = 'ok';
  let top: UsageMetric = USAGE_METRICS[0];
  for (const metric of USAGE_METRICS) {
    const level = usageLevel(today[metric], USAGE_LIMITS[metric]);
    if (LEVEL_RANK[level] > LEVEL_RANK[worst]) worst = level;
    if (today[metric] / USAGE_LIMITS[metric] > today[top] / USAGE_LIMITS[top]) top = metric;
  }
  return {
    id: 'limite', title: 'Limite du jour', state: 'ok', value: `${usagePercent(today[top], USAGE_LIMITS[top])} %`,
    detail: `${USAGE_LABELS[top]} · ${USAGE_LEVEL_TEXT[worst]}`, tone: LEVEL_TONE[worst], href: 'cloudflare',
  };
}
