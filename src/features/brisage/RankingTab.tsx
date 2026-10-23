import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import runeItems from '../../data/rune-items.json';
import { getCategories } from '../../data/catalogue-repository';
import { Icon } from '../../components/Icon';
import { defaultBrisageSettings, MAX_COEFFICIENT } from '../../domain/brisage';
import { levelRangeError } from '../../domain/brisage-search';
import {
  ageInDays, bestExoFor, buildRanking, DEFAULT_RANKING_VIEW, filterRows, freshnessOf, sortRows,
  type RankingColumn, type RankingContext, type RankingExo, type RankingRow, type RankingView,
} from '../../domain/brisage-ranking';
import type { RuneItemsData } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import type { Category } from '../../domain/types';
import { Kamas } from '../prices/PricesPage';
import { useRankingData } from './useRankingData';

// specs/072-classement-brisage: the « Classement » tab of the Brisage page. The items whose HDV price is known, from the
// most to the least worth breaking, with the same figures as the item page (analyzeBrisage / analyzeFocusAdvice at the
// average roll of each line). Everything shown is an ESTIMATE from unofficial formulas (specs/060).

const RUNES = (runeItems as RuneItemsData).runes;
const SETTINGS = defaultBrisageSettings();
const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
/** The exos are worked out this many items at a time, after the first display, so the table is never blocked. */
const EXO_CHUNK = 40;
/** Rows drawn per group; « Afficher plus » adds as many again, so thousands of items stay quick to sort and filter (SC-003). */
const PAGE_SIZE = 100;

/** The exo already worked out for each item of a server and price mode, with what it was worked out from. */
const exoCache = new Map<string, Map<string, { key: string; exo: RankingExo | null }>>();
/** Forgets the exos kept (tests). */
export function forgetExoCache(): void {
  exoCache.clear();
}

/** Where the player was in the list when an item page was opened, taken back when the list comes back. */
type Place = { scope: string; limit: number; scrollY: number };
let lastPlace: Place | undefined;
/** Forgets the place kept (tests). */
export function forgetRankingPlace(): void {
  lastPlace = undefined;
}

export type RankingOpenItem = { id: string; name: string; level: number; imageUrl?: string };

const parseNumber = (text: string): number | undefined => {
  const value = Number(text.replace(/\s/g, '').replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : undefined;
};

const shortRune = (name: string | undefined) => (name ?? '').replace('Rune ', '').trim();

/** « il y a 3 j » with a mark when the date is stale (text and icon, not only a colour). */
function Age({ date, what }: { date: string | undefined; what: string }) {
  const level = freshnessOf(date);
  const days = ageInDays(date);
  const text = days === undefined ? 'date inconnue' : days === 0 ? "aujourd'hui" : `il y a ${days} j`;
  return (
    <span className={`ranking-age ranking-age--${level}`} title={`${what} : ${text}`}>
      {level === 'stale' && <Icon name="info" size={12} />}
      {text}{level === 'stale' ? ' (périmé)' : ''}
    </span>
  );
}

const COLUMNS: { column: RankingColumn | undefined; label: string; note?: string }[] = [
  { column: 'name', label: 'Objet' },
  { column: 'level', label: 'Niveau' },
  { column: 'price', label: 'Prix' },
  { column: undefined, label: 'Meilleur choix' },
  { column: 'gain', label: 'Gain' },
  { column: undefined, label: 'Coefficient' },
  { column: 'threshold', label: 'Seuil de coefficient' },
  { column: 'exoGain', label: 'Gain avec exo', note: 'une rune déduite' },
  { column: undefined, label: 'Prix des runes' },
];

function bestChoice(row: RankingRow) {
  if (row.status === 'no-price') return <span className="fm-note">Prix de l'objet inconnu</span>;
  if (row.status === 'no-breakable-line') return <span className="fm-note">Aucune ligne à briser</span>;
  if (row.status === 'missing-rune-price') return <span className="fm-note">Prix de rune manquant</span>;
  return row.best?.kind === 'focus' ? `Focus ${shortRune(row.best.focusRuneName)}` : 'Sans focus';
}

function gainCell(row: RankingRow) {
  if (row.status !== 'ok' || row.gainKamas === undefined) return <span className="fm-note">—</span>;
  const gain = Math.round(row.gainKamas);
  return <span className={gain < 0 ? 'brisage-total-loss' : gain > 0 ? 'brisage-total-gain' : undefined}><Kamas value={gain} signed /></span>;
}

function thresholdCell(row: RankingRow) {
  if (row.status !== 'ok') return <span className="fm-note">—</span>;
  if (row.unreachable) return <span className="fm-note">au-delà de {percent.format(MAX_COEFFICIENT)} %</span>;
  return row.thresholdCoefficient === undefined ? <span className="fm-note">—</span> : <>{percent.format(row.thresholdCoefficient)} %</>;
}

function exoCell(row: RankingRow, exo: RankingExo | undefined, pending: boolean) {
  if (row.status !== 'ok') return <span className="fm-note">—</span>;
  if (!exo) return <span className="fm-note">{pending ? 'calcul…' : '—'}</span>;
  if (row.group === 'unknown') return <><strong>{exo.statLabel}</strong> : {percent.format(exo.thresholdCoefficient!)} %</>;
  return (
    <>
      <strong>{exo.statLabel}</strong> : <Kamas value={Math.round(exo.gainKamas!)} signed />
      {' '}<span className="fm-note">(+<Kamas value={Math.round(exo.improvementKamas!)} />)</span>
    </>
  );
}

export function RankingTab({ serverId, priceMode, view, onView, onOpen }: {
  serverId: string | undefined;
  priceMode: PriceMode;
  view: RankingView;
  onView: (view: RankingView) => void;
  onOpen: (item: RankingOpenItem) => void;
}) {
  const data = useRankingData(serverId, priceMode);
  const [categories, setCategories] = useState<Category[]>([]);
  const [exos, setExos] = useState<{ key: object; byItem: Map<string, RankingExo | null>; done: boolean }>();
  const placeScope = `${serverId}:${priceMode}`;
  // The place is only for the arrival that follows an item page: it is used up here, so a later arrival starts at the top.
  const [place] = useState(() => (lastPlace?.scope === placeScope ? lastPlace : undefined));
  useEffect(() => { lastPlace = undefined; }, []);
  const [limit, setLimit] = useState(place?.limit ?? PAGE_SIZE);
  const scrollRestored = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // The categories only label the filter: without them the table still works.
    getCategories().then((list) => { if (!cancelled) setCategories(list.filter((category) => category.kind === 'Equipment')); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const context = useMemo<RankingContext>(() => ({
    runes: RUNES, settings: SETTINGS, runePrices: data.runePrices, runePriceDates: data.runePriceDates,
    itemPrices: data.itemPrices, coefficients: data.coefficients,
  }), [data.runePrices, data.runePriceDates, data.itemPrices, data.coefficients]);
  const rows = useMemo(() => (data.status === 'ready' ? buildRanking(data.items, context) : []), [data, context]);

  // The best exo of each item is worked out after the first display, a few items at a time (specs/072 T030).
  const exoKey = rows;
  useEffect(() => {
    if (rows.length === 0) return;
    let cancelled = false;
    const itemById = new Map(data.items.map((item) => [item.id, item]));
    // An exo only depends on the price of the item, its coefficient and the prices of the runes: one already worked out
    // for the same three is taken back as it is, so coming back to the tab (or a new coefficient) only costs what changed.
    const runeSignature = JSON.stringify(Object.entries(data.runePrices).sort(([a], [b]) => a.localeCompare(b)));
    const scope = `${serverId}:${priceMode}`;
    const kept = exoCache.get(scope) ?? new Map<string, { key: string; exo: RankingExo | null }>();
    exoCache.set(scope, kept);
    const keyOf = (row: RankingRow) => `${row.priceKamas}|${row.coefficient ?? ''}|${runeSignature}`;
    const byItem = new Map<string, RankingExo | null>();
    const todo: RankingRow[] = [];
    for (const row of rows) {
      if (row.status !== 'ok') continue;
      const hit = kept.get(row.itemId);
      if (hit && hit.key === keyOf(row)) byItem.set(row.itemId, hit.exo);
      else todo.push(row);
    }
    let position = 0;
    const step = () => {
      if (cancelled) return;
      for (const row of todo.slice(position, position + EXO_CHUNK)) {
        const item = itemById.get(row.itemId);
        const exo = item ? bestExoFor(item, row, context) ?? null : null;
        byItem.set(row.itemId, exo);
        kept.set(row.itemId, { key: keyOf(row), exo });
      }
      position += EXO_CHUNK;
      const done = position >= todo.length;
      setExos({ key: exoKey, byItem: new Map(byItem), done });
      if (!done) window.setTimeout(step, 0);
    };
    // Everything kept is shown at once; only the rest is worked out, a few items at a time.
    if (todo.length === 0) setExos({ key: exoKey, byItem, done: true });
    else window.setTimeout(step, 0);
    return () => { cancelled = true; };
  }, [rows, data.items, data.runePrices, context, exoKey, serverId, priceMode]);

  const exosPending = rows.some((row) => row.status === 'ok') && !(exos?.key === exoKey && exos.done);

  const withExos = useMemo(
    () => rows.map((row) => { const exo = exos?.key === exoKey ? exos.byItem.get(row.itemId) : undefined; return exo ? { ...row, exo } : row; }),
    [rows, exos, exoKey],
  );
  const shown = useMemo(() => filterRows(withExos, view), [withExos, view]);
  const known = useMemo(() => sortRows(shown.filter((row) => row.group === 'known'), view.sortColumn, view.sortDirection), [shown, view.sortColumn, view.sortDirection]);
  const unknown = useMemo(() => sortRows(shown.filter((row) => row.group === 'unknown'), view.sortColumn, view.sortDirection), [shown, view.sortColumn, view.sortDirection]);

  const update = (change: Partial<RankingView>) => onView({ ...view, ...change });
  const sortBy = (column: RankingColumn) => update(view.sortColumn === column
    ? { sortDirection: view.sortDirection === 'desc' ? 'asc' : 'desc' }
    : { sortColumn: column, sortDirection: column === 'name' || column === 'threshold' ? 'asc' : 'desc' });
  const rangeError = levelRangeError({ minLevel: view.minLevel, maxLevel: view.maxLevel });
  const sourceLabel = priceMode === 'community' ? 'communautaire' : 'personnel';

  // Coming back from an item page, the list is where it was left (same number of rows, same scroll) instead of at the top.
  const hasRows = shown.length > 0;
  useLayoutEffect(() => {
    if (scrollRestored.current || !hasRows) return;
    scrollRestored.current = true;
    if (place) window.scrollTo(0, place.scrollY);
  }, [hasRows, place]);

  const openRow = (row: RankingRow) => {
    lastPlace = { scope: placeScope, limit, scrollY: window.scrollY };
    onOpen({ id: row.itemId, name: row.name, level: row.level, imageUrl: row.imageUrl });
  };
  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, row: RankingRow) => {
    if (event.key === 'Enter' && event.target === event.currentTarget) openRow(row);
  };

  const renderRow = (row: RankingRow) => {
    const exo = row.exo;
    return (
      <tr key={row.itemId} className="ranking-row" tabIndex={0} onClick={() => openRow(row)} onKeyDown={(event) => onRowKey(event, row)}>
        <th scope="row" data-label="Objet">
          <span className="ranking-item">
            {row.imageUrl ? <img src={row.imageUrl} alt="" loading="lazy" width="32" height="32" /> : <span className="resource-image-fallback" aria-hidden="true">{row.name.slice(0, 1)}</span>}
            <button type="button" className="ranking-open">{row.name}</button>
          </span>
        </th>
        <td data-label="Niveau">{row.level}</td>
        <td data-label="Prix">
          {row.priceKamas !== undefined
            ? <><Kamas value={row.priceKamas} /><span className="fm-note"> ({sourceLabel}) </span><Age date={row.priceUpdatedAt} what="Prix de l'objet" /></>
            : <span className="fm-note">—</span>}
        </td>
        <td data-label="Meilleur choix">{bestChoice(row)}</td>
        <td data-label="Gain">{row.group === 'known' ? gainCell(row) : <span className="fm-note">—</span>}</td>
        <td data-label="Coefficient">
          {row.group === 'known'
            ? <>{percent.format(row.coefficient!)} % <Age date={row.coefficientAt} what="Coefficient" /></>
            : <span className="ranking-unknown">coefficient inconnu</span>}
        </td>
        <td data-label="Seuil de coefficient">{thresholdCell(row)}</td>
        <td data-label="Gain avec exo">{exoCell(row, exo, exosPending)}</td>
        <td data-label="Prix des runes">{row.status === 'ok' ? <Age date={row.oldestRunePriceAt} what="Prix de rune le plus ancien" /> : <span className="fm-note">—</span>}</td>
      </tr>
    );
  };

  const groupRows = (title: string, id: string, list: RankingRow[], hint: string) => (list.length === 0 ? null : (
    <tbody key={id} aria-label={title}>
      <tr className="ranking-group"><th scope="colgroup" colSpan={COLUMNS.length}>{title} <span className="fm-note">({list.length}) — {hint}</span></th></tr>
      {list.slice(0, limit).map(renderRow)}
    </tbody>
  ));
  const hasMore = known.length > limit || unknown.length > limit;

  const sortState = (column: RankingColumn | undefined) => (column !== undefined && view.sortColumn === column ? (view.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');

  return (
    <section className="panel ranking" aria-label="Classement des objets à briser">
      <h2 className="visually-hidden">Classement</h2>
      <p className="fm-note ranking-warning">
        Estimations d'après des formules non officielles : jet moyen de chaque ligne, prix de l'objet noté sur la page Recherche, prix des runes
        et dernier coefficient noté par les joueurs. Un objet sans coefficient connu est classé à part, selon le coefficient minimum requis.
      </p>
      {data.incomplete.length > 0 && (
        <p className="fm-error" role="status">Classement incomplet : {data.incomplete.join(', ')} indisponible(s).</p>
      )}

      <form className="ranking-filters" onSubmit={(event) => event.preventDefault()} aria-label="Filtres du classement">
        <label>Niveau minimum
          <input type="number" min={1} inputMode="numeric" value={view.minLevel ?? ''} onChange={(event) => update({ minLevel: parseNumber(event.target.value) })} />
        </label>
        <label>Niveau maximum
          <input type="number" min={1} inputMode="numeric" value={view.maxLevel ?? ''} onChange={(event) => update({ maxLevel: parseNumber(event.target.value) })} />
        </label>
        <label>Catégorie
          <select value={view.categoryId ?? ''} onChange={(event) => update({ categoryId: event.target.value || undefined })}>
            <option value="">Toutes</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </label>
        <label>Gain minimum (kamas)
          <input type="number" inputMode="numeric" value={view.minGainKamas ?? ''} onChange={(event) => update({ minGainKamas: parseNumber(event.target.value) })} />
        </label>
        <label className="ranking-check">
          <input type="checkbox" checked={view.hideWithoutPrice} onChange={(event) => update({ hideWithoutPrice: event.target.checked })} />
          Masquer les objets sans prix
        </label>
        <label className="ranking-check">
          <input type="checkbox" checked={view.hideWithoutCoefficient} onChange={(event) => update({ hideWithoutCoefficient: event.target.checked })} />
          Masquer les objets sans coefficient
        </label>
        <button type="button" className="btn btn-secondary" onClick={() => onView(DEFAULT_RANKING_VIEW)}>Réinitialiser les filtres</button>
      </form>
      {rangeError && <p className="fm-error" role="alert">{rangeError}</p>}

      {data.status === 'loading' && <p className="fm-note" role="status">Calcul du classement…</p>}
      {data.status === 'ready' && shown.length === 0 && (
        <p className="empty" role="status">
          {rows.every((row) => row.status === 'no-price')
            ? "Aucun prix d'objet connu sur ce serveur : notez des prix sur la page Recherche."
            : 'Aucun objet ne correspond à ces filtres.'}
          {' '}<button type="button" className="btn btn-secondary" onClick={() => onView(DEFAULT_RANKING_VIEW)}>Réinitialiser les filtres</button>
        </p>
      )}

      {shown.length > 0 && (
        <div className="brisage-table-wrap">
          <table className="brisage-table ranking-table" role="table">
            <caption className="visually-hidden">Objets à briser, classés par rentabilité estimée</caption>
            <thead>
              <tr role="row">
                {COLUMNS.map(({ column, label, note }) => (
                  <th key={label} scope="col" aria-sort={column ? sortState(column) : undefined}>
                    {column ? (
                      <button type="button" className="ranking-sort" onClick={() => sortBy(column)}>
                        {label}{view.sortColumn === column ? (view.sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    ) : label}
                    {note && <span className="fm-note ranking-column-note"> ({note} ; échecs et runes en plus non comptés)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            {groupRows('Coefficient connu', 'known', known, 'gain par objet, prix de l\'objet déduit')}
            {groupRows('Coefficient inconnu', 'unknown', unknown, 'classés par coefficient minimum requis')}
          </table>
        </div>
      )}
      {hasMore && (
        <button type="button" className="btn btn-secondary ranking-more" onClick={() => setLimit(limit + PAGE_SIZE)}>
          Afficher plus ({PAGE_SIZE} lignes de plus par groupe)
        </button>
      )}
    </section>
  );
}
