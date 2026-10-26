import type { UsageMetric } from '../src/domain/cloudflare-usage';

// Distinct by dash pattern as well as by colour, so the usage charts never rely on colour alone.
export const USAGE_STYLE: Record<UsageMetric, { stroke: string; dash?: string }> = {
  workersRequests: { stroke: 'var(--accent-bright)' },
  d1RowsRead: { stroke: 'var(--warning)', dash: '6 3' },
  d1RowsWritten: { stroke: 'var(--danger)', dash: '2 3' },
};

// Short names for the pill at the end of each curve (the legend and the table keep the full ones).
export const USAGE_SHORT: Record<UsageMetric, string> = {
  workersRequests: 'Requêtes',
  d1RowsRead: 'Lectures',
  d1RowsWritten: 'Écritures',
};
