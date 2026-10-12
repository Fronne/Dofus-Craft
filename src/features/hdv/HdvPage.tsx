import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { CharacteristicIcon } from '../../components/CharacteristicIcon';
import { EmptyState } from '../../components/EmptyState';
import { Icon, type IconName } from '../../components/Icon';
import runeItems from '../../data/rune-items.json';
import { CHARACTERISTIC_ASSET_BY_ID } from '../../domain/characteristic-icons';
import { filterRunes, PRICE_ORIGIN_LABELS, runeStatLabels, type RuneItem, type RuneItemsData } from '../../domain/forgemagie';
import {
  countPriced,
  filterHdvItems,
  HDV_SORTS,
  HDV_TABS,
  isHdvId,
  isHdvSort,
  itemsForHdv,
  sortHdvLines,
  typesInTab,
  type HdvId,
  type HdvSort,
} from '../../domain/hdv';
import { FRAGILE_LABELS, loadableIds, loadAvailability, shownOrigin, type LatestMention } from '../../domain/huzounet-load';
import type { PriceMode } from '../../domain/price-modes';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { useLoadMoreOnScroll } from '../../hooks/useLoadMoreOnScroll';
import { PriceEntryField } from '../comparison/PriceEntryField';
import { useResourcePrices } from '../comparison/useResourcePrices';
import { HuzounetLoadButton } from './HuzounetLoadButton';
import { useHdvItems } from './useHdvItems';
import { useHdvPriceSummary } from './useHdvPriceSummary';
import { useHuzounetLoad } from './useHuzounetLoad';
import { useLatestOrigins } from './useLatestOrigins';
import { tabOnKey } from '../../components/tab-keys';

// specs/023-hdv-price-entry: record the prices of an in-game HDV in one pass, one tab per HDV, with
// the very same price field as the Recherche page (same carnet, same Mode personnel / communautaire
// rules — FR-006/FR-007).

const TAB_STORAGE_KEY = 'craftcheck-hdv-tab';

// specs/026-hdv-rune-prices: the Runes tab lists the runes of the Forgemagie data, not HDV items.
const RUNES = (runeItems as RuneItemsData).runes;
const RUNE_STATS = runeStatLabels(RUNES);

/** What one line of any tab needs: the item, and the caption under its name. */
type HdvLine = { id: string; name: string; imageUrl?: string; rune?: RuneItem; typeId?: number };

// specs/046-hdv-huzounet-load (FR-013): where the price shown comes from — « Huzounet », with what its
// source says of it when that price is a provisional or an old one.
function originLabel(mention: LatestMention): string {
  const label = PRICE_ORIGIN_LABELS[mention.origin];
  return mention.fragile ? `${label} · ${FRAGILE_LABELS[mention.fragile]}` : label;
}

function RuneCaption({ rune, mention }: { rune: RuneItem; mention?: LatestMention }) {
  const asset = rune.characteristicId === null ? undefined : CHARACTERISTIC_ASSET_BY_ID[rune.characteristicId];
  return (
    <span className="hdv-item-type fm-rune-caption">
      {asset && <CharacteristicIcon asset={asset} size={16} />}
      {rune.statLabel}
      {mention && <span className="fm-origin">{originLabel(mention)}</span>}
    </span>
  );
}

// specs/048-hdv-sort: what each tab shows before its name.
const TAB_ICONS: Record<HdvId, IconName> = { resources: 'package', consumables: 'potion', animals: 'paw', runes: 'rune' };

function readStoredTab(): HdvId {
  try {
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    return isHdvId(stored) ? stored : 'resources';
  } catch {
    return 'resources';
  }
}

function storeTab(tab: HdvId) {
  try {
    window.localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Remembering the tab is a convenience only.
  }
}

export function HdvPage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId, servers } = useActiveServer();
  const hdvItems = useHdvItems();
  const [tab, setTab] = useState<HdvId>(readStoredTab);
  const [query, setQuery] = useState('');
  const [typeId, setTypeId] = useState<number | ''>('');
  const [stat, setStat] = useState('');
  const [originsVersion, setOriginsVersion] = useState(0);
  // specs/048-hdv-sort: kept from one tab to the next, not from one visit to the next.
  const [sort, setSort] = useState<HdvSort>('default');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  // Values typed for one server or mode never carry over to another (same as the Recherche page).
  useEffect(() => {
    setInputs({});
  }, [serverId, priceMode]);

  const isRunes = tab === 'runes';
  const data = hdvItems.status === 'ready' ? hdvItems.data : undefined;
  const tabItems = useMemo(() => (data && !isRunes ? itemsForHdv(data, tab) : []), [data, tab, isRunes]);
  const tabTypes = useMemo(() => (data ? typesInTab(tabItems, data.types) : []), [data, tabItems]);
  // One list for every tab, so filters, counter and price fields behave the same (specs/026 FR-004/FR-005).
  const tabLines: HdvLine[] = useMemo(
    () => (isRunes ? RUNES.map((rune) => ({ id: rune.id, name: rune.name, imageUrl: rune.imageUrl, rune })) : tabItems),
    [isRunes, tabItems],
  );
  const summary = useHdvPriceSummary(serverId, priceMode, tabLines.map((item) => item.id));
  const byCategory: HdvLine[] = isRunes
    ? filterRunes(RUNES, { query, stat }).map((rune) => ({ id: rune.id, name: rune.name, imageUrl: rune.imageUrl, rune }))
    : filterHdvItems(tabItems, { query, typeId });
  const filtered = sortHdvLines(byCategory, summary.prices, sort);
  const { visible, endRef, loadingMore, reset } = useLoadMoreOnScroll(filtered);
  const { data: carnet, save, remove, loaded, reload, error: carnetError } = useResourcePrices(serverId, visible.map((item) => item.id), resourcePricesFor(priceMode));
  const { priced, total } = countPriced(tabLines, summary.prices);
  const origins = useLatestOrigins(serverId, priceMode, visible.map((item) => item.id), originsVersion);
  const refreshSummary = summary.refresh;
  const onSaved = () => {
    refreshSummary();
    setOriginsVersion((value) => value + 1);
  };
  // specs/046-hdv-huzounet-load: the button covers every item of the tab, whatever the filters (FR-001).
  const tabIds = useMemo(() => loadableIds(tabLines.map((item) => item.id)), [tabLines]);
  // The prices of a request are in the carnet: the count, the displayed lines and their origin follow
  // (FR-005). A value being typed lives in `inputs`, which none of these touch (FR-015).
  const onSliceLoaded = useCallback(() => {
    refreshSummary();
    reload();
    setOriginsVersion((value) => value + 1);
  }, [refreshSummary, reload]);
  const huzounet = useHuzounetLoad({ serverId, priceMode, tab, ids: tabIds, onSliceLoaded });
  // « Huzounet » is told for the price shown only: not for another one kept on the device, nor while
  // the player types one. The origin of a shared price stays as it was (specs/026).
  const mentionOf = (id: string) => {
    const mention = origins[id];
    if (mention?.origin !== 'external') return mention;
    return inputs[id] === undefined ? shownOrigin(carnet[id], mention) : undefined;
  };

  const serverName = servers.find((server) => server.id === serverId)?.name;
  const modeLabel = priceMode === 'community' ? 'Mode communautaire' : 'Mode personnel';
  const typeNames = data?.types ?? {};

  const chooseTab = (next: HdvId) => {
    setTab(next);
    storeTab(next);
    setTypeId('');
    setStat('');
    reset();
  };

  return (
    <>
      <header className="page-header">
        <h1>HDV</h1>
        <p>
          Relevez les prix d'un hôtel des ventes en un seul passage
          {serverName ? `, serveur ${serverName}` : ''}, {modeLabel}. Prix à l'unité.
        </p>
      </header>

      <section className="panel hdv-panel">
        <div className="hdv-tabs" role="tablist" aria-label="Hôtels des ventes">
          {HDV_TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`hdv-tab-${entry.id}`}
              aria-selected={entry.id === tab}
              aria-controls="hdv-tabpanel"
              tabIndex={entry.id === tab ? 0 : -1}
              className={`hdv-tab hdv-tab--icon${entry.id === tab ? ' hdv-tab--active' : ''}`}
              onClick={() => chooseTab(entry.id)}
              onKeyDown={(event) => {
                const next = tabOnKey(event, HDV_TABS.map((candidate) => candidate.id), entry.id);
                if (next) chooseTab(next);
              }}
            >
              <Icon name={TAB_ICONS[entry.id]} size={16} />
              <span>{entry.label}</span>
            </button>
          ))}
        </div>

        <div className="tab-panel" role="tabpanel" id="hdv-tabpanel" aria-labelledby={`hdv-tab-${tab}`} key={tab}>
        {!serverId ? (
          <EmptyState icon="server" title="Aucun serveur choisi" description="Choisissez un serveur pour saisir ses prix." />
        ) : !isRunes && hdvItems.status === 'loading' ? (
          <p className="empty" role="status">Chargement des objets…</p>
        ) : !isRunes && hdvItems.status === 'unavailable' ? (
          <div role="alert">
            <EmptyState icon="info" title="Liste des objets indisponible" description="Les objets de cet HDV n'ont pas pu être chargés. Vos prix déjà saisis sont conservés.">
              <button type="button" className="btn btn-primary" onClick={hdvItems.retry}>Réessayer</button>
              {/* After a new version of the site went online, only a reload finds the list again. */}
              <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Recharger la page</button>
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="profit-toolbar hdv-toolbar">
              <div className="search-input-wrap prices-search">
                <Icon name="search" size={18} className="search-input-icon" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    reset();
                  }}
                  placeholder={isRunes ? 'Rechercher une rune...' : 'Rechercher un objet...'}
                  aria-label={isRunes ? 'Rechercher une rune' : 'Rechercher un objet'}
                />
              </div>
              {isRunes ? (
                <select
                  className="hdv-type-filter"
                  aria-label="Stat"
                  value={stat}
                  onChange={(event) => {
                    setStat(event.target.value);
                    reset();
                  }}
                >
                  <option value="">Toutes les stats</option>
                  {RUNE_STATS.map((label) => <option key={label} value={label}>{label}</option>)}
                </select>
              ) : (
                <select
                  className="hdv-type-filter"
                  aria-label="Type d'objet"
                  value={typeId}
                  onChange={(event) => {
                    setTypeId(event.target.value === '' ? '' : Number(event.target.value));
                    reset();
                  }}
                >
                  <option value="">Tous les types</option>
                  {tabTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              )}
              <select
                className="hdv-type-filter"
                aria-label="Trier"
                value={sort}
                onChange={(event) => {
                  setSort(isHdvSort(event.target.value) ? event.target.value : 'default');
                  reset();
                }}
              >
                <option value="default">{isRunes ? 'Tri par stat' : 'Tri par nom'}</option>
                {HDV_SORTS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </select>
            </div>

            <div className="results-meta">
              <span role="status" className="hdv-count">
                {!summary.loaded ? 'Lecture des prix…' : summary.failed ? 'Lecture des prix impossible' : `${priced} ${isRunes ? (priced > 1 ? 'runes' : 'rune') : (priced > 1 ? 'objets' : 'objet')} sur ${total} ${priced > 1 ? 'ont' : 'a'} un prix`}
              </span>
              {tabIds.length > 0 && (
                <HuzounetLoadButton
                  availability={loadAvailability(priceMode, serverId)}
                  count={tabIds.length}
                  state={huzounet.state}
                  onStart={() => void huzounet.start()}
                  onStop={huzounet.stop}
                />
              )}
            </div>

            {tab === 'animals' && (
              <p className="hdv-note">
                La page XP Familier ne recommande que les nourritures de son tableau d'XP : les autres croquettes
                peuvent avoir un prix ici, sans être proposées là-bas.
              </p>
            )}

            {carnetError && <p className="warning" role="alert">{carnetError}</p>}

            {filtered.length === 0 ? (
              <EmptyState
                icon="search"
                title={isRunes ? 'Aucune rune ne correspond à votre recherche' : 'Aucun objet ne correspond à votre recherche'}
                description={`Essayez un autre nom, ${isRunes ? 'une autre stat' : 'un autre type'} ou un autre filtre de prix.`}
              />
            ) : (
              <>
                <ul className="hdv-list">
                  {visible.map((item) => (
                    <li key={item.id} className="hdv-row">
                      <PriceEntryField
                        resource={{ id: item.id, name: item.name, imageUrl: item.imageUrl }}
                        quantity={1}
                        // A unit price only: no « × 1 » subtotal repeating it.
                        subtotalKamas={null}
                        caption={item.rune
                          ? <RuneCaption rune={item.rune} mention={mentionOf(item.id)} />
                          : (
                            <span className="hdv-item-type hdv-item-caption">
                              {typeNames[String(item.typeId)]}
                              {mentionOf(item.id)?.origin === 'external' && <span className="fm-origin">{originLabel(mentionOf(item.id)!)}</span>}
                            </span>
                          )}
                        priceMode={priceMode}
                        serverId={serverId}
                        input={inputs[item.id]}
                        onInput={(value) => setInputs((current) => ({ ...current, [item.id]: value }))}
                        carnet={{ data: carnet, save, remove, loaded }}
                        onSaved={onSaved}
                      />
                    </li>
                  ))}
                </ul>
                {visible.length < filtered.length && (
                  <div ref={endRef} className="profit-list-end" role="status">
                    {loadingMore && 'Chargement…'}
                  </div>
                )}
              </>
            )}
          </>
        )}
        </div>
      </section>
    </>
  );
}
