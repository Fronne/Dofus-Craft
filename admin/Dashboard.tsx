import { useEffect, useState, type ReactNode } from 'react';
import { cumulativeHours } from '../src/domain/cloudflare-usage';
import type { InfoMessage } from '../src/domain/info-message';
import type { PlayerCounter } from '../src/domain/player-counter';
import type { SiteSettings } from '../src/domain/site-settings';
import type { UsageResponse } from '../src/domain/cloudflare-usage';
import { adminApi, type Activity, type AdminResult, type SnifferKeyJson, type SnifferMappingJson } from './admin-api';
import { BarList } from './BarList';
import { DailyColumns } from './DailyColumns';
import { bannerRemaining, counterBars, keyActivity, mappingAge } from './dashboard-insights';
import {
  LOADING,
  READ_ONLY_CARDS,
  figureLimit,
  figureLines,
  figureLoading,
  figurePages,
  figureUnavailable,
  figureVisitors,
  SECTIONS,
  UNAVAILABLE,
  summarizeBanner,
  summarizeCounters,
  summarizeKeys,
  summarizeMappings,
  summarizePages,
  summarizePrices,
  summarizeUsage,
  summarizeVisits,
  type CardSummary,
  type KeyFigure,
  type ReadOnlyCardId,
  type SectionId,
} from './dashboard-summary';
import { DashboardVisual, type VisualState } from './DashboardVisual';
import { DayUsageChart } from './DayUsageChart';
import { KeyContributions } from './KeyContributions';
import { KeyFigures } from './KeyFigures';

type Summaries = Record<SectionId, CardSummary>;

const INITIAL: Summaries = {
  pages: LOADING,
  bandeau: LOADING,
  compteurs: LOADING,
  cles: LOADING,
  correspondances: LOADING,
  cloudflare: LOADING,
};

// What the cards' own reads brought back, kept so a visual can use it too without reading it a second time.
type Raw = {
  settings?: SiteSettings;
  usage?: UsageResponse;
  message?: InfoMessage | null;
  counters?: PlayerCounter[];
  keys?: SnifferKeyJson[];
  mappings?: SnifferMappingJson[];
};

// A card's visual is read on its own, so a slow or failing read never holds the other cards back.
type Read<T> = { state: 'loading' | 'unavailable' } | { state: 'ok'; value: T };

function useRead<T>(read: () => Promise<AdminResult<T>>): Read<T> {
  const [result, setResult] = useState<Read<T>>({ state: 'loading' });
  useEffect(() => {
    let cancelled = false;
    void read().then((answer) => {
      if (!cancelled) setResult(answer.status === 'ok' ? { state: 'ok', value: answer.value } : { state: 'unavailable' });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return result;
}

const group = new Intl.NumberFormat('fr-FR');

// The state of a visual that is drawn from a card's own read: its summary says whether that read is done or failed.
const sourceState = (summary: CardSummary, empty = false): VisualState =>
  summary.state === 'ok' ? (empty ? 'empty' : 'ok') : summary.state;

const PRICE_SERIES = [
  { id: 'manual', label: 'Saisie manuelle' },
  { id: 'capture', label: 'Capture' },
  { id: 'bot', label: 'Bot Discord' },
  { id: 'sniffer', label: 'Outil des amis' },
];

function activitySummary(read: Read<Activity>, summarize: (activity: Activity) => CardSummary): CardSummary {
  if (read.state === 'loading') return LOADING;
  return read.state === 'ok' ? summarize(read.value) : UNAVAILABLE;
}

// specs/068-admin-dashboard (contracts/admin-dashboard-ui.md): one card per section, each filled by its own
// read so one failing read only makes its own card "Indisponible". specs/070-admin-dashboard-graphiques: a card is
// the link (title and summary) followed by its visual, a sibling of the link and not inside it, so a chart's
// controls and value table are never nested in a link.
export function Dashboard() {
  const [summaries, setSummaries] = useState<Summaries>(INITIAL);
  const [raw, setRaw] = useState<Raw>({});
  const today = useRead(() => adminApi.getTodayUsage());
  const contributions = useRead(() => adminApi.getKeyContributions());
  const activity = useRead(() => adminApi.getActivity());
  const now = new Date();

  useEffect(() => {
    let cancelled = false;
    function fill<T>(id: SectionId, read: Promise<AdminResult<T>>, summarize: (value: T) => CardSummary, keep?: (value: T) => Raw) {
      void read.then((result) => {
        if (cancelled) return;
        const summary = result.status === 'ok' ? summarize(result.value) : UNAVAILABLE;
        setSummaries((current) => ({ ...current, [id]: summary }));
        if (result.status === 'ok' && keep) setRaw((current) => ({ ...current, ...keep(result.value) }));
      });
    }
    fill('pages', adminApi.getSettings(), summarizePages, (settings) => ({ settings }));
    fill('bandeau', adminApi.getMessage(), summarizeBanner, (message) => ({ message }));
    fill('compteurs', adminApi.list(), summarizeCounters, (counters) => ({ counters }));
    fill('cles', adminApi.listSnifferKeys(), summarizeKeys, (keys) => ({ keys }));
    fill('correspondances', adminApi.listSnifferMappings(), summarizeMappings, (mappings) => ({ mappings }));
    fill('cloudflare', adminApi.getUsage(7), summarizeUsage, (usage) => ({ usage }));
    return () => {
      cancelled = true;
    };
  }, []);

  // specs/071-admin-dashboard-moderne: the row of key figures, each from a read the cards make anyway.
  function figureFor<T>(read: Read<T>, id: KeyFigure['id'], title: string, href: KeyFigure['href'], make: (value: T) => KeyFigure): KeyFigure {
    if (read.state === 'ok') return make(read.value);
    return read.state === 'unavailable' ? figureUnavailable(id, title, href) : figureLoading(id, title, href);
  }
  const sourceFigure = (summary: CardSummary, id: KeyFigure['id'], title: string, href: KeyFigure['href'], make: () => KeyFigure | undefined) =>
    make() ?? (summary.state === 'unavailable' ? figureUnavailable(id, title, href) : figureLoading(id, title, href));
  const figures: KeyFigure[] = [
    sourceFigure(summaries.pages, 'pages', 'Pages actives', 'pages', () => (raw.settings ? figurePages(raw.settings) : undefined)),
    figureFor(contributions, 'lignes', 'Lignes ce mois-ci', 'cles', (value) => figureLines(value.total)),
    figureFor(activity, 'visiteurs', 'Visiteurs du jour', undefined, (value) => figureVisitors(value.visitorsToday)),
    sourceFigure(summaries.cloudflare, 'limite', 'Limite du jour', 'cloudflare', () => (raw.usage ? figureLimit(raw.usage) : undefined)),
  ];

  const visuals: Partial<Record<SectionId, ReactNode>> = {};

  // Only an 'ok' answer has hours to draw: not configured, refused or failing all read as unavailable.
  const hourly = today.state === 'ok' && today.value.state === 'ok' ? today.value : undefined;
  visuals.cloudflare = (
    <DashboardVisual state={today.state === 'ok' ? (hourly ? 'ok' : 'unavailable') : today.state}>
      {hourly && <DayUsageChart hours={cumulativeHours(hourly.hours)} readAt={hourly.readAt} />}
    </DashboardVisual>
  );

  visuals.cles = (
    <DashboardVisual state={contributions.state}>
      {contributions.state === 'ok' && (
        <KeyContributions initial={contributions.value} activity={raw.keys ? keyActivity(raw.keys, now) : undefined} />
      )}
    </DashboardVisual>
  );

  const age = raw.mappings ? mappingAge(raw.mappings, now) : undefined;
  visuals.correspondances = (
    <DashboardVisual state={sourceState(summaries.correspondances, age?.state === 'none')}>
      {age?.state === 'ok' && (
        <>
          <p className={age.stale ? 'dashboard-visual-warning' : undefined}>{age.text}</p>
          <p className="dashboard-visual-note">Version du jeu : {age.build}</p>
        </>
      )}
    </DashboardVisual>
  );

  const bars = raw.counters ? counterBars(raw.counters) : [];
  visuals.compteurs = (
    <DashboardVisual state={sourceState(summaries.compteurs, raw.counters?.length === 0)}>
      <BarList caption="Valeur de chaque compteur" bars={bars.map((bar) => ({ label: bar.label, value: bar.count }))} />
    </DashboardVisual>
  );

  // A banner without an end date, or an expired one, still says so; no banner at all has nothing to show.
  const remaining = raw.message === undefined ? undefined : bannerRemaining(raw.message, now);
  if (summaries.bandeau.state !== 'ok' || (remaining && remaining.state !== 'none')) {
    visuals.bandeau = (
      <DashboardVisual state={sourceState(summaries.bandeau)}>
        {remaining && remaining.state !== 'none' && <p>{remaining.text}</p>}
      </DashboardVisual>
    );
  }

  const readOnly: Record<ReadOnlyCardId, { summary: CardSummary; visual: ReactNode }> = {
    prix: {
      summary: activitySummary(activity, summarizePrices),
      visual: (
        <DashboardVisual state={activity.state === 'ok' && activity.value.pricesTotal === 0 ? 'empty' : activity.state}>
          {activity.state === 'ok' && (
            <DailyColumns
              caption="Lignes de prix ajoutées par jour, 30 derniers jours (UTC)"
              series={PRICE_SERIES}
              columns={activity.value.days.map((day) => ({ date: day.date, parts: day.prices }))}
            />
          )}
        </DashboardVisual>
      ),
    },
    visites: {
      summary: activitySummary(activity, summarizeVisits),
      visual: (
        <DashboardVisual state={activity.state === 'ok' && activity.value.days.every((day) => day.visitors === 0) ? 'empty' : activity.state}>
          {activity.state === 'ok' && (
            <>
              <DailyColumns
                caption="Visiteurs par jour, 30 derniers jours (UTC)"
                series={[{ id: 'visitors', label: 'Visiteurs' }]}
                columns={activity.value.days.map((day) => ({ date: day.date, parts: { visitors: day.visitors } }))}
              />
              <p className="dashboard-visual-note">{group.format(activity.value.visitorsToday)} visiteur(s) aujourd'hui · un appareil compte une fois par jour</p>
            </>
          )}
        </DashboardVisual>
      ),
    },
  };

  const sectionCard = (id: SectionId) => {
    const { title } = SECTIONS.find((section) => section.id === id)!;
    const summary = summaries[id];
    const visual = visuals[id];
    return (
      <li key={id} className={`dashboard-item${visual ? ' dashboard-item--visual' : ''}`}>
        <a href={`#${id}`} className={`dashboard-card dashboard-card--${summary.tone}`}>
          <h2>{title}</h2>
          <p className="dashboard-card-summary">{summary.text}</p>
        </a>
        {visual}
      </li>
    );
  };
  const readOnlyCard = (id: ReadOnlyCardId) => {
    const { title } = READ_ONLY_CARDS.find((card) => card.id === id)!;
    return (
      <li key={id} className="dashboard-item dashboard-item--visual">
        <div className={`dashboard-card dashboard-card--${readOnly[id].summary.tone} dashboard-card--static`}>
          <h2>{title}</h2>
          <p className="dashboard-card-summary">{readOnly[id].summary.text}</p>
        </div>
        {readOnly[id].visual}
      </li>
    );
  };

  // Three tiers (contracts/admin-dashboard-ui.md): the key figures, the big chart cards, then the smaller cards.
  return (
    <div className="dashboard">
      <KeyFigures figures={figures} />
      <ul className="dashboard-grid dashboard-grid--charts">
        {sectionCard('cloudflare')}
        {sectionCard('cles')}
        {readOnlyCard('prix')}
        {readOnlyCard('visites')}
      </ul>
      <ul className="dashboard-grid dashboard-grid--small">
        {sectionCard('pages')}
        {sectionCard('bandeau')}
        {sectionCard('compteurs')}
        {sectionCard('correspondances')}
      </ul>
    </div>
  );
}
