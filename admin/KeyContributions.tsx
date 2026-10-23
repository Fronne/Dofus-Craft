import { useRef, useState } from 'react';
import { adminApi, type KeyContributions as KeyContributionsData } from './admin-api';
import { BarList } from './BarList';
import { DailyColumns } from './DailyColumns';
import type { KeyActivity } from './dashboard-insights';

const group = new Intl.NumberFormat('fr-FR');
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const monthLabel = (month: string) => monthName.format(new Date(`${month}-01T00:00:00Z`));

const plural = (count: number) => `${group.format(count)} ${count > 1 ? 'lignes ajoutées' : 'ligne ajoutée'}`;

// specs/070-admin-dashboard-graphiques (US2, US3): the price rows the friends' keys added over a month (UTC), key by key,
// under the key's label (the friend's name), then day by day; the month can be changed without leaving the dashboard.
// The count is also written in full beside each bar and in a table.
export function KeyContributions({ initial, activity = [] }: { initial: KeyContributionsData; activity?: KeyActivity[] }) {
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState(initial.month);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);

  async function choose(month: string) {
    setSelected(month);
    const request = ++latest.current;
    const result = await adminApi.getKeyContributions(month);
    if (request !== latest.current) return;
    if (result.status === 'ok') {
      setData(result.value);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }

  // The list of months always begins with the current one.
  const current = data.month === initial.months[0];
  const where = current ? 'ce mois-ci' : `en ${monthLabel(data.month)}`;
  return (
    <div className="key-contributions">
      {activity.length > 0 && (
        <ul className="chart-notes key-activity" aria-label="Dernier envoi de chaque clé">
          {activity.map((key) => (
            <li key={key.id} className={key.status === 'recent' ? undefined : 'dashboard-visual-warning'}>{key.label} : {key.text}</li>
          ))}
        </ul>
      )}
      <label className="dashboard-visual-controls">
        Mois
        <select value={selected} onChange={(event) => void choose(event.target.value)}>
          {initial.months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
        </select>
      </label>
      {failed ? (
        <p className="dashboard-visual-state">Indisponible</p>
      ) : (
        <>
          <p className="key-contributions-total">
            <strong>{data.total === 0 ? `0 ligne ${where}` : `${plural(data.total)} ${where}`}</strong>
            <span className="dashboard-visual-note"> · mois civil, jours UTC</span>
          </p>
          {data.keys.length === 0 ? (
            <p className="dashboard-visual-note">Aucune clé.</p>
          ) : (
            <BarList
              caption={`Lignes de prix ajoutées par clé, ${where}`}
              bars={data.keys.map((key) => ({ label: key.label, value: key.rows, note: key.revoked ? 'révoquée' : undefined }))}
            />
          )}
          {data.total > 0 && (
            <DailyColumns
              caption={`Lignes de prix ajoutées par jour, ${where}`}
              series={[{ id: 'rows', label: 'Lignes ajoutées' }]}
              columns={data.days.map((day) => ({ date: day.date, parts: { rows: day.rows } }))}
            />
          )}
        </>
      )}
    </div>
  );
}
