import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { adminApi, type CleanupLogEntry, type CleanupOverview, type CleanupRow, type Duration } from './admin-api';
import { failureMessage } from './messages';

// specs/073-admin-nettoyage-donnees (contracts/admin-data-api.md « Interface »): lists the most recent rows of a
// few tables and deletes some of them, by selection or by duration. A deletion is final: it always goes through
// a confirmation that says how many rows it concerns.

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' });
const formatDate = (iso: string) => dateFormatter.format(new Date(iso));

const DURATION_LABELS: Record<Duration, string> = { '10m': '10 minutes', '1h': '1 heure', '24h': '24 heures' };
const ORIGIN_LABELS: Record<string, string> = { manual: 'Manuel', capture: 'Capture', bot: 'Bot Discord', sniffer: 'Outil HDV' };

const rows = (count: number) => `${count} ligne${count > 1 ? 's' : ''}`;

type Pending = { kind: 'keys'; count: number } | { kind: 'recent'; duration: Duration; count: number };
type Feedback = { text: string; error: boolean };
type Filters = { server: string; origin: string };

export function DataCleanupEditor() {
  const [overview, setOverview] = useState<CleanupOverview>();
  const [tableId, setTableId] = useState('');
  const [typedServer, setTypedServer] = useState('');
  const [filters, setFilters] = useState<Filters>({ server: '', origin: '' });
  const [list, setList] = useState<CleanupRow[]>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();

  const table = overview?.tables.find((entry) => entry.id === tableId);
  // Bumped whenever the table or a filter changes, so a late answer for the previous view is dropped.
  const view = useRef(0);

  const reloadOverview = useCallback(async () => {
    const result = await adminApi.getCleanup();
    if (result.status === 'ok') {
      setOverview(result.value);
      setTableId((current) => current || result.value.tables[0]?.id || '');
    } else {
      setFeedback({ text: failureMessage(result), error: true });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void adminApi.getCleanup().then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setOverview(result.value);
        setTableId((current) => current || result.value.tables[0]?.id || '');
      } else {
        setFeedback({ text: failureMessage(result), error: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    if (!tableId) return;
    let cancelled = false;
    void adminApi.listCleanupRows(tableId, { server: filters.server, origin: filters.origin }).then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setList(result.value);
        setSelected(new Set());
      } else {
        setList([]);
        setFeedback({ text: failureMessage(result), error: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tableId, filters, reloadCount]);

  function chooseTable(id: string) {
    view.current += 1;
    setTableId(id);
    setTypedServer('');
    setFilters({ server: '', origin: '' });
    setList(undefined);
    setPending(undefined);
    setFeedback(undefined);
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    view.current += 1;
    setFilters((current) => ({ ...current, server: typedServer.trim().toLowerCase() }));
    setList(undefined);
    setPending(undefined);
    setFeedback(undefined);
  }

  function chooseOrigin(origin: string) {
    view.current += 1;
    setFilters((current) => ({ ...current, origin }));
    setList(undefined);
    setPending(undefined);
    setFeedback(undefined);
  }

  function toggle(key: string) {
    setPending(undefined);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function preview(duration: Duration) {
    setFeedback(undefined);
    setPending(undefined);
    setBusy(true);
    const asked = view.current;
    const result = await adminApi.countCleanup(tableId, duration, { server: filters.server, origin: filters.origin });
    setBusy(false);
    // The table or a filter changed while counting: this answer is about something no longer on screen.
    if (asked !== view.current) return;
    if (result.status !== 'ok') {
      setFeedback({ text: failureMessage(result), error: true });
    } else if (result.value.count === 0) {
      setFeedback({ text: `Aucune ligne de moins de ${DURATION_LABELS[duration]}.`, error: false });
    } else if (result.value.count > result.value.limit) {
      setFeedback({
        text: `${rows(result.value.count)} concernées : une suppression porte sur ${result.value.limit} lignes au plus. Choisissez une durée plus courte ou un filtre.`,
        error: true,
      });
    } else {
      setPending({ kind: 'recent', duration, count: result.value.count });
    }
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    const result = await adminApi.deleteCleanup(
      tableId,
      pending.kind === 'keys'
        ? { keys: [...selected] }
        : { since: pending.duration, expectedCount: pending.count, server: filters.server || undefined, origin: filters.origin || undefined },
    );
    setBusy(false);
    setPending(undefined);
    if (result.status === 'ok') {
      const trace = result.value.logged || result.value.deleted === 0 ? '' : " (la trace n'a pas pu être enregistrée)";
      setFeedback({ text: `${rows(result.value.deleted)} supprimée${result.value.deleted > 1 ? 's' : ''}${trace}.`, error: false });
    } else {
      setFeedback({ text: failureMessage(result), error: true });
    }
    setReloadCount((count) => count + 1);
    void reloadOverview();
  }

  const labelOf = (id: string) => overview?.tables.find((entry) => entry.id === id)?.label ?? id;

  return (
    <section className="panel admin-section" aria-labelledby="admin-cleanup-title">
      <h2 id="admin-cleanup-title">Nettoyage des données</h2>
      <p className="settings-section-description">
        Les lignes les plus récentes d'une table. Une suppression est définitive : elle demande une confirmation avec le nombre de lignes.
      </p>

      {overview && (
        <div className="cleanup-controls">
          <label>
            Table
            <select value={tableId} onChange={(event) => chooseTable(event.target.value)}>
              {overview.tables.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
          {table?.filters.includes('origin') && (
            <label>
              Origine
              <select value={filters.origin} onChange={(event) => chooseOrigin(event.target.value)}>
                <option value="">Toutes</option>
                {Object.entries(ORIGIN_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          )}
          {table?.filters.includes('server') && (
            <form className="cleanup-server" onSubmit={applyFilters}>
              <label>
                Serveur
                <input value={typedServer} maxLength={40} placeholder="ex. mikhal" onChange={(event) => setTypedServer(event.target.value)} />
              </label>
              <button type="submit" className="btn btn-secondary btn-small">Filtrer</button>
            </form>
          )}
        </div>
      )}

      {feedback && (
        <p className={`admin-message${feedback.error ? ' admin-message--error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>
      )}
      {(overview === undefined || (tableId !== '' && list === undefined)) && !feedback && <p className="empty" role="status">Chargement…</p>}
      {list?.length === 0 && <p className="empty">Aucune ligne.</p>}

      {table && list && list.length > 0 && (
        <>
          <div className="cleanup-table-wrap">
            <table className="cleanup-table">
              <thead>
                <tr>
                  <th scope="col"><span className="visually-hidden">Sélection</span></th>
                  <th scope="col">Date</th>
                  {table.columns.map((column) => <th key={column.id} scope="col">{column.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.key} className={selected.has(row.key) ? 'cleanup-row--selected' : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(row.key)}
                        aria-label={`Sélectionner la ligne du ${formatDate(row.date)}`}
                        onChange={() => toggle(row.key)}
                      />
                    </td>
                    <td>{formatDate(row.date)}</td>
                    {table.columns.map((column) => <td key={column.id}>{row.cells[column.id] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cleanup-actions">
            <button
              type="button"
              className="btn btn-secondary btn-small admin-danger"
              disabled={busy || selected.size === 0}
              onClick={() => setPending({ kind: 'keys', count: selected.size })}
            >
              Supprimer la sélection
            </button>
            <span className="cleanup-recent" role="group" aria-label="Supprimer ce qui date de moins de">
              <span>Supprimer ce qui date de moins de :</span>
              {(Object.keys(DURATION_LABELS) as Duration[]).map((duration) => (
                <button key={duration} type="button" className="btn btn-secondary btn-small admin-danger" disabled={busy} onClick={() => void preview(duration)}>
                  {DURATION_LABELS[duration]}
                </button>
              ))}
            </span>
          </div>
        </>
      )}

      {pending && (
        <div className="cleanup-confirm" role="alertdialog" aria-label="Confirmer la suppression">
          <p>
            {pending.kind === 'keys'
              ? `Supprimer ${rows(pending.count)} ? Cette action est définitive.`
              : `Supprimer ${rows(pending.count)} de moins de ${DURATION_LABELS[pending.duration]} ? Cette action est définitive.`}
          </p>
          <div className="admin-counter-actions">
            <button type="button" className="btn btn-primary btn-small admin-danger" disabled={busy} onClick={() => void confirm()}>Confirmer</button>
            <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => setPending(undefined)}>Annuler</button>
          </div>
        </div>
      )}

      {overview && (
        <div className="cleanup-log">
          <h3>Dernières suppressions</h3>
          {overview.log.length === 0
            ? <p className="empty">Aucune suppression pour l'instant.</p>
            : (
              <ul className="admin-sniffer-list">
                {overview.log.map((entry: CleanupLogEntry) => (
                  <li key={entry.id} className="admin-sniffer-row">
                    <div>
                      <p className="admin-counter-player">{rows(entry.count)} · {labelOf(entry.table)}</p>
                      <p className="admin-counter-meta">
                        {formatDate(entry.deletedAt)} · {entry.mode === 'selection' ? 'sélection' : 'par durée'}
                        {entry.filter ? ` · ${entry.filter}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </section>
  );
}
