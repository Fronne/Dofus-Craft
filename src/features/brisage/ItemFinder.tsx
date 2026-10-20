import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { getCategories } from '../../data/catalogue-repository';
import { loadBrisageItemsIndex, type BrisageItemsIndex } from '../../data/brisage-items-repository';
import { runeForStat, type BrisageSettings } from '../../domain/brisage';
import { browseItems, levelRangeError, targetableStats, type SearchSort } from '../../domain/brisage-search';
import type { RuneItem } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import type { Category } from '../../domain/types';
import { getStoredCoefficient } from '../../persistence/brisage-coefficients';
import { getSearchPrefs, setSearchPrefs, type SearchPrefs } from '../../persistence/brisage-search-prefs';
import { ItemCard } from './ItemCard';
import { ItemFilters, statChipLabel } from './ItemFilters';
import { useRunePrices } from './useRunePrices';

// specs/065-refonte-page-brisage: the first thing on the Brisage page. A field for the name of the item, a button
// unfolding the filters (category, level, stats), then a few cards to pick the item from. The list is read from the
// local index of equipment, so name, category, level and stats combine at once, offline. Every rune number it shows
// is an ESTIMATE (specs/064): normal breaking at a reference coefficient of 100 %, from the average roll.

const PAGE_SIZE = 6;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export type FoundItem = { id: string; name: string; level: number; imageUrl?: string };

type IndexState = { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; index: BrisageItemsIndex };

const parseLevel = (text: string): number | undefined => {
  const value = Number(text);
  return text.trim() !== '' && Number.isInteger(value) && value >= 1 ? value : undefined;
};

export function ItemFinder({ runes, settings, serverId, priceMode, selectedId, onPick }: {
  runes: RuneItem[];
  settings: BrisageSettings;
  serverId: string | undefined;
  priceMode: PriceMode;
  selectedId: string | undefined;
  onPick: (item: FoundItem) => void;
}) {
  const [state, setState] = useState<IndexState>({ status: 'loading' });
  const [categories, setCategories] = useState<Category[]>([]);
  const [prefs, setPrefs] = useState<SearchPrefs>(getSearchPrefs);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    loadBrisageItemsIndex()
      .then((index) => { if (!cancelled) setState({ status: 'ready', index }); })
      .catch(() => { if (!cancelled) setState({ status: 'unavailable' }); });
    // The categories only label the filter: without them the list still works.
    getCategories().then((list) => { if (!cancelled) setCategories(list); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // The level slider commits its min then its max in the same tick: each change builds on the latest prefs, not on the
  // ones of the render it was created in.
  const prefsRef = useRef(prefs);
  const update = (change: Partial<SearchPrefs>) => {
    const next = { ...prefsRef.current, ...change };
    prefsRef.current = next;
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
  const categoryList = useMemo(() => categories.filter((category) => category.kind === 'Equipment'), [categories]);
  const categoryId = prefs.categoryId && categoryList.some((category) => category.id === prefs.categoryId) ? prefs.categoryId : '';
  const categoryName = categoryId ? categoryList.find((category) => category.id === categoryId)?.label ?? 'Catégorie' : '';

  const runeIds = useMemo(() => chosen
    .map((effectId) => runeForStat(runes, effectId, settings.runeSize)?.rune.id)
    .filter((id): id is string => id !== undefined)
    .sort(), [chosen, runes, settings.runeSize]);
  const fetched = useRunePrices(serverId, priceMode, runeIds);

  const { minLevel, maxLevel, sort } = prefs;
  const rangeError = levelRangeError({ minLevel, maxLevel });
  const index = state.status === 'ready' ? state.index : undefined;
  const results = useMemo(
    () => (index
      ? browseItems(index.items, { query, categoryId: categoryId || undefined, effectIds: chosen, minLevel, maxLevel, sort: sort as SearchSort }, runes, settings, fetched.prices)
      : []),
    [index, query, categoryId, chosen, minLevel, maxLevel, sort, runes, settings, fetched.prices],
  );

  const levelLabel = minLevel !== undefined && maxLevel !== undefined ? `Niveau ${minLevel} – ${maxLevel}`
    : minLevel !== undefined ? `Niveau ${minLevel} et plus`
      : maxLevel !== undefined ? `Niveau ${maxLevel} et moins` : '';
  const activeCount = (categoryId ? 1 : 0) + (levelLabel ? 1 : 0) + chosen.length;
  const reset = () => update({ effectIds: [], categoryId: undefined, minLevel: undefined, maxLevel: undefined });
  const searching = query.trim().length > 0 || activeCount > 0;

  return (
    <div className="brisage-finder">
      <div className="search-row">
        <div className="search-primary">
          <span className="search-input-wrap">
            <Icon name="search" size={22} className="search-input-icon" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_SIZE); }}
              placeholder="Taper le nom de l'objet à briser…"
              aria-label="Chercher un objet"
            />
          </span>
        </div>
        <button type="button" className="filters-toggle" aria-expanded={prefs.panelOpen} aria-controls="brisage-filters-panel" onClick={() => update({ panelOpen: !prefs.panelOpen })}>
          <Icon name="filter" size={18} />
          <span>Filtres</span>
          {activeCount > 0 && <span className="filters-toggle-count" aria-label={`${activeCount} actif${activeCount > 1 ? 's' : ''}`}>{activeCount}</span>}
          <Icon name="chevron-down" size={16} className="filters-toggle-chevron" />
        </button>
      </div>

      <ItemFilters
        id="brisage-filters-panel"
        hidden={!prefs.panelOpen}
        categories={categoryList}
        categoryId={categoryId}
        onCategory={(id) => update({ categoryId: id || undefined })}
        levelMin={minLevel === undefined ? '' : String(minLevel)}
        levelMax={maxLevel === undefined ? '' : String(maxLevel)}
        onLevelMin={(value) => update({ minLevel: parseLevel(value) })}
        onLevelMax={(value) => update({ maxLevel: parseLevel(value) })}
        levelError={rangeError}
        stats={stats}
        chosen={chosen}
        onToggleStat={toggle}
        sort={sort}
        onSort={(next) => update({ sort: next })}
      />

      {activeCount > 0 && (
        <div className="filters-bar">
          {categoryName && <FilterChip label={categoryName} onRemove={() => update({ categoryId: undefined })} />}
          {levelLabel && <FilterChip label={levelLabel} onRemove={() => update({ minLevel: undefined, maxLevel: undefined })} />}
          {chosen.map((effectId) => <FilterChip key={effectId} label={statChipLabel(effectId)} onRemove={() => toggle(effectId)} />)}
          <button type="button" className="reset-filters" onClick={reset}>Réinitialiser les filtres</button>
        </div>
      )}

      {state.status === 'loading' && <p className="fm-note" role="status">Chargement des objets…</p>}
      {state.status === 'unavailable' && <p className="fm-error" role="alert">La liste des objets est indisponible pour le moment. Réessayez plus tard.</p>}
      {index && !rangeError && (
        <>
          <p className="fm-note brisage-found" role="status">
            {results.length === 0
              ? (chosen.length > 1 ? 'Aucun objet ne porte toutes ces stats. Retirez une stat ou élargissez les filtres.' : searching ? 'Aucun objet ne correspond à ces filtres.' : 'Aucun objet à afficher.')
              : `${results.length} objet${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}${chosen.length > 0 ? ' · estimation à 100 % de coefficient, jet moyen' : ''}`}
          </p>
          {results.length > 0 && (
            <ul className="brisage-cards">
              {results.slice(0, visible).map((result) => (
                <li key={result.item.id}>
                  <ItemCard
                    item={result.item}
                    selected={result.item.id === selectedId}
                    stored={serverId ? getStoredCoefficient(serverId, result.item.id) : undefined}
                    onPick={() => onPick({ id: result.item.id, name: result.item.name, level: result.item.level, imageUrl: result.item.imageUrl })}
                  />
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

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="filter-chip" aria-label={`Retirer le filtre ${label}`} onClick={onRemove}>
      <span className="filter-chip-body">
        <span>{label}</span>
        <Icon name="close" size={14} />
      </span>
    </button>
  );
}
