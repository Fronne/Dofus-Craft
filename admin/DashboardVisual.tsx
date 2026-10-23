import type { ReactNode } from 'react';

export type VisualState = 'loading' | 'ok' | 'empty' | 'unavailable';

const TEXT: Record<Exclude<VisualState, 'ok'>, string> = {
  loading: 'Chargement…',
  empty: 'Aucune donnée',
  unavailable: 'Indisponible',
};

// specs/070-admin-dashboard-graphiques (contracts/admin-dashboard-ui.md): the visual of a dashboard card. Until its
// own read is done, or when it failed or has nothing to show, a word says so instead of a chart: never a made-up value.
export function DashboardVisual({ state, children }: { state: VisualState; children?: ReactNode }) {
  return (
    <div className="dashboard-visual">
      {state === 'ok' ? children : <p className="dashboard-visual-state">{TEXT[state]}</p>}
    </div>
  );
}
