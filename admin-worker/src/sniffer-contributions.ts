import type { SnifferKeysDb } from './sniffer-keys';

// specs/070-admin-dashboard-graphiques (contracts/admin-dashboard-api.md « Lignes ajoutées par clé »): the price rows
// each friend's key added over a month, read in sniffer_daily_usage (specs/056, the count the batch route caps). Only
// the label, the state and the counts leave: never the key, its hash or anything of the friend beyond the label.
export type KeyMonthRow = { keyId: string; label: string; revoked: boolean; rows: number };
export type KeyContributions = {
  month: string;
  months: string[];
  total: number;
  keys: KeyMonthRow[];
  days: { date: string; rows: number }[];
};

export type MonthValidation = { ok: true; value: string } | { ok: false; error: string; field: 'month' };

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const thisMonth = (now: Date) => now.toISOString().slice(0, 7);

// No month asked is the current one (UTC); a month that has not begun is refused, there is nothing to show for it.
export function validateMonth(raw: string | null, now: Date): MonthValidation {
  const month = raw ?? thisMonth(now);
  if (!MONTH_PATTERN.test(month) || month > thisMonth(now)) {
    return { ok: false, error: 'Mois attendu sous la forme 2026-10.', field: 'month' };
  }
  return { ok: true, value: month };
}

// First day of the month after `month`, as YYYY-MM-DD: the exclusive end of the month's days.
function nextMonthStart(month: string): string {
  const [year, number] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, number, 1));
  return next.toISOString().slice(0, 10);
}

// The days shown: the whole month, or only up to today for the current one (the days to come are not drawn).
function monthDays(month: string, now: Date): string[] {
  const first = Date.parse(`${month}-01T00:00:00Z`);
  const end = Math.min(Date.parse(`${nextMonthStart(month)}T00:00:00Z`) - 86_400_000, Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`));
  const days: string[] = [];
  for (let time = first; time <= end; time += 86_400_000) days.push(new Date(time).toISOString().slice(0, 10));
  return days;
}

type KeyRow = { id: string; label: string; created_at: string; revoked_at: string | null; rows: number };

export async function readKeyContributions(db: SnifferKeysDb, month: string, now: Date = new Date()): Promise<KeyContributions> {
  const from = `${month}-01`;
  const to = nextMonthStart(month);
  const keyRows = await db.prepare(
    `SELECT k.id, k.label, k.created_at, k.revoked_at, COALESCE(SUM(u.rows_written), 0) AS rows
     FROM sniffer_keys k LEFT JOIN sniffer_daily_usage u ON u.key_id = k.id AND u.day >= ? AND u.day < ?
     GROUP BY k.id`,
  ).bind(from, to).all<KeyRow>();
  const dayRows = await db.prepare(
    'SELECT day, SUM(rows_written) AS rows FROM sniffer_daily_usage WHERE day >= ? AND day < ? GROUP BY day',
  ).bind(from, to).all<{ day: string; rows: number }>();
  const monthRows = await db.prepare('SELECT DISTINCT substr(day, 1, 7) AS month FROM sniffer_daily_usage').all<{ month: string }>();

  // Every active key that existed during the month (even at 0), and a revoked one only if it added rows then.
  const keys = keyRows.results
    .map((row): KeyMonthRow => ({ keyId: row.id, label: row.label, revoked: row.revoked_at !== null, rows: Number(row.rows) }))
    .filter((key, index) => key.rows > 0 || (!key.revoked && keyRows.results[index].created_at.slice(0, 10) < to))
    .sort((a, b) => b.rows - a.rows || a.label.localeCompare(b.label, 'fr'));

  const byDay = new Map(dayRows.results.map((row) => [row.day, Number(row.rows)]));
  const months = [...new Set([...monthRows.results.map((row) => row.month), thisMonth(now), month])].sort().reverse();

  return {
    month,
    months,
    total: keys.reduce((sum, key) => sum + key.rows, 0),
    keys,
    days: monthDays(month, now).map((date) => ({ date, rows: byDay.get(date) ?? 0 })),
  };
}
