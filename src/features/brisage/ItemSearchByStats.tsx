import { useEffect, useMemo, useState } from 'react';
import { loadBrisageItemsIndex, type BrisageItemsIndex } from '../../data/brisage-items-repository';
import { brisageStat, runeForStat, type BrisageSettings } from '../../domain/brisage';
import { levelRangeError, searchResults, targetableStats, type SearchSort } from '../../domain/brisage-search';
import type { RuneItem } from '../../domain/forgemagie';
import { normalizeSearchText } from '../../services/dofusdb-api';
import type { PriceMode } from '../../domain/price-modes';
import { getSearchPrefs, setSearchPrefs, type SearchPrefs } from '../../persistence/brisage-search-prefs';
import { Kamas } from '../prices/PricesPage';
import { useRunePrices } from './useRunePrices';

// specs/064-recherche-objets-par-stats: pick the stats to get as runes, read which items to break. Every number
// here is an ESTIMATE: normal breaking at a reference coefficient of 100 %, from the average roll.

const PAGE_SIZE = 50;
const SORT_LABELS: Record<SearchSort, string> = {
  runes: 'Runes ciblées estimées',
  kamas: 'Valeur des runes (kamas)',
  maxRoll: 'Jet maximal',
};
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export type SearchPick = { id: string; name: string; level: number; imageUrl?: string };

type IndexState = { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; index: BrisageItemsIndex };

const parseLevel = (text: string): number | undefined => {
  const value = Number(text);
  return text.trim() !== '' && Number.isInteger(value) && value >= 1 ? value : undefined;
};

export function ItemSearchByStats({ runes, settings, serverId, priceMode, onPick }: {
  runes: RuneItem[];
  settings: BrisageSettings;
  serverId: string | undefined;
  priceMode: PriceMode;
  onPick: (item: SearchPick) => void;
}) {
  const [state, setState] = useState<IndexState>({ status: 'loading' });
  const [prefs, setPrefs] = useState<SearchPrefs>(getSearchPrefs);
  const [filter, setFilter] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    loadBrisageItemsIndex()
      .then((index) => { if (!cancelled) setState({ status: 'ready', index }); })
      .catch(() => { if (!cancelled) setState({ status: 'unavailable' }); });
    return () => { cancelled = true; };
  }, []);

  const update = (change: Partial<SearchPrefs>) => {
    const next = { ...prefs, ...change };
    setPrefs(next);
    setSearchPrefs(next);
    setVisible(PAGE_SIZE);
  };

  const stats = useMemo(() => targetableStats(runes, settings.runeSize), [runes, settings.runeSize]);
  // A remembered stat that can no longer be targeted is just ignored.
  const chosen = useMemo(() => prefs.effectIds.filter((id) => stats.some((stat) => stat.effectId === id)), [prefs.effectIds, stats]);
  const toggle = (effectId: number) => update({
    effectIds: chosen.includes(effectId) ? chosen.filter((id) => id !== effectId) : [...chosen, effectId],
  });
  const shown = stats.filter((stat) => normalizeSearchText(stat.label).includes(normalizeSearchText(filter)));

  const runeIds = useMemo(() => chosen
    .map((effectId) => runeForStat(runes, effectId, settings.runeSize)?.rune.id)
    .filter((id): id is string => id !== undefined)
    .sort(), [chosen, runes, settings.runeSize]);
  const fetched = useRunePrices(serverId, priceMode, runeIds);

  const { minLevel, maxLevel, sort } = prefs;
  const rangeError = levelRangeError({ minLevel, maxLevel });
  const index = state.status === 'ready' ? state.index : undefined;
  const results = useMemo(
    () => (index && chosen.length > 0 ? searchResults(index.items, chosen, { minLevel, maxLevel }, runes, settings, fetched.prices, sort) : []),
    [index, chosen, minLevel, maxLevel, sort, runes, settings, fetched.prices],
  );

  return (
    <div className="brisage-search">
      <div className="brisage-field">
        <span className="brisage-field-label" id="brisage-search-stats-label">Stats à obtenir en runes</span>
        {chosen.length > 0 && (
          <ul className="brisage-search-chosen" aria-label="Stats choisies">
            {chosen.map((effectId) => (
              <li key={effectId}>
                <button type="button" className="brisage-search-chip" onClick={() => toggle(effectId)} aria-label={`Retirer ${brisageStat(effectId)?.label ?? effectId}`}>
                  {brisageStat(effectId)?.label ?? effectId} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          className="brisage-search-filter"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filtrer les stats…"
          aria-label="Filtrer les stats"
        />
        <ul className="brisage-search-stats" aria-labelledby="brisage-search-stats-label">
          {shown.map((stat) => (
            <li key={stat.effectId}>
              <button
                type="button"
                className={chosen.includes(stat.effectId) ? 'brisage-search-stat is-selected' : 'brisage-search-stat'}
                aria-pressed={chosen.includes(stat.effectId)}
                onClick={() => toggle(stat.effectId)}
              >
                {stat.label}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="fm-note">Aucune stat ne correspond.</li>}
        </ul>
      </div>

      <div className="brisage-search-options">
        <div className="brisage-field">
          <label className="brisage-field-label" htmlFor="brisage-search-sort">Trier par</label>
          <select id="brisage-search-sort" value={prefs.sort} onChange={(event) => update({ sort: event.target.value as SearchSort })}>
            {(Object.keys(SORT_LABELS) as SearchSort[]).map((sort) => <option key={sort} value={sort}>{SORT_LABELS[sort]}</option>)}
          </select>
        </div>
        <div className="brisage-field">
          <label className="brisage-field-label" htmlFor="brisage-search-min">Niveau minimum</label>
          <input id="brisage-search-min" type="number" inputMode="numeric" min={1} value={prefs.minLevel ?? ''} onChange={(event) => update({ minLevel: parseLevel(event.target.value) })} />
        </div>
        <div className="brisage-field">
          <label className="brisage-field-label" htmlFor="brisage-search-max">Niveau maximum</label>
          <input id="brisage-search-max" type="number" inputMode="numeric" min={1} value={prefs.maxLevel ?? ''} onChange={(event) => update({ maxLevel: parseLevel(event.target.value) })} />
        </div>
      </div>
      {rangeError && <p className="fm-error" role="alert">{rangeError}</p>}

      {state.status === 'loading' && <p className="fm-note" role="status">Chargement des objets…</p>}
      {state.status === 'unavailable' && <p className="fm-error" role="alert">La liste des objets est indisponible pour le moment. Réessayez plus tard.</p>}
      {index && chosen.length === 0 && <p className="fm-note">Choisissez au moins une stat pour voir les objets qui la portent.</p>}
      {index && chosen.length > 0 && !rangeError && (
        <>
          <p className="fm-note" role="status">
            {results.length === 0
              ? (chosen.length > 1 ? 'Aucun objet ne porte toutes ces stats. Retirez une stat ou élargissez les niveaux.' : 'Aucun objet ne porte cette stat dans ces niveaux.')
              : `${results.length} objet${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''} · estimation à 100 % de coefficient, jet moyen`}
          </p>
          {results.length > 0 && (
            <ul className="brisage-search-results">
              {results.slice(0, visible).map((result) => (
                <li key={result.item.id}>
                  <button type="button" className="brisage-search-result" onClick={() => onPick({ id: result.item.id, name: result.item.name, level: result.item.level, imageUrl: result.item.imageUrl })}>
                    {result.item.imageUrl ? <img src={result.item.imageUrl} alt="" width={40} height={40} loading="lazy" /> : <span className="brisage-search-noimage" aria-hidden="true" />}
                    <span className="brisage-search-name">
                      <strong>{result.item.name}</strong>
                      <span className="fm-note">Niv. {result.item.level}</span>
                    </span>
                    <span className="brisage-search-stats-detail">
                      {result.perStat.map((stat) => (
                        <span key={stat.effectId}>
                          {brisageStat(stat.effectId)?.label} : {stat.from === stat.to ? stat.from : `${stat.from} à ${stat.to}`} → ~{stat.runes} rune{stat.runes > 1 ? 's' : ''}
                        </span>
                      ))}
                    </span>
                    <span className="brisage-search-total">
                      {result.perStat.length > 1 && <span>~{result.totalRunes} runes</span>}
                      {prefs.sort === 'kamas' && (result.valueKamas === undefined ? <span className="fm-note">Valeur : —</span> : <Kamas value={result.valueKamas} />)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {results.length > visible && (
            <button type="button" className="brisage-search-more" onClick={() => setVisible(visible + PAGE_SIZE)}>
              Afficher plus ({results.length - visible} restants)
            </button>
          )}
        </>
      )}
      {index && <p className="fm-note brisage-search-source">Objets relevés sur DofusDB le {dateFormat.format(new Date(index.retrievedAt))}.</p>}
    </div>
  );
}
