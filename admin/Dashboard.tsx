import { useEffect, useState } from 'react';
import { adminApi, type AdminResult } from './admin-api';
import {
  LOADING,
  SECTIONS,
  UNAVAILABLE,
  summarizeBanner,
  summarizeCounters,
  summarizeKeys,
  summarizeMappings,
  summarizePages,
  summarizeUsage,
  type CardSummary,
  type SectionId,
} from './dashboard-summary';

type Summaries = Record<SectionId, CardSummary>;

const INITIAL: Summaries = {
  pages: LOADING,
  bandeau: LOADING,
  compteurs: LOADING,
  cles: LOADING,
  correspondances: LOADING,
  cloudflare: LOADING,
};

// specs/068-admin-dashboard (contracts/admin-dashboard-ui.md): one card per section, each filled by its own
// read so one failing read only makes its own card "Indisponible".
export function Dashboard() {
  const [summaries, setSummaries] = useState<Summaries>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    function fill<T>(id: SectionId, read: Promise<AdminResult<T>>, summarize: (value: T) => CardSummary) {
      void read.then((result) => {
        if (cancelled) return;
        const summary = result.status === 'ok' ? summarize(result.value) : UNAVAILABLE;
        setSummaries((current) => ({ ...current, [id]: summary }));
      });
    }
    fill('pages', adminApi.getSettings(), summarizePages);
    fill('bandeau', adminApi.getMessage(), summarizeBanner);
    fill('compteurs', adminApi.list(), summarizeCounters);
    fill('cles', adminApi.listSnifferKeys(), summarizeKeys);
    fill('correspondances', adminApi.listSnifferMappings(), summarizeMappings);
    fill('cloudflare', adminApi.getUsage(7), summarizeUsage);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ul className="dashboard-grid">
      {SECTIONS.map(({ id, title }) => {
        const summary = summaries[id];
        return (
          <li key={id}>
            <a href={`#${id}`} className={`dashboard-card dashboard-card--${summary.tone}`}>
              <h2>{title}</h2>
              <p className="dashboard-card-summary">{summary.text}</p>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
