import { useEffect, useMemo, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import {
  countPriced,
  filterByPrice,
  filterHdvItems,
  HDV_TABS,
  isHdvId,
  itemsForHdv,
  typesInTab,
  type HdvId,
  type HdvPriceFilter,
} from '../../domain/hdv';
import type { PriceMode } from '../../domain/price-modes';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { useLoadMoreOnScroll } from '../../hooks/useLoadMoreOnScroll';
import { PriceEntryField } from '../comparison/PriceEntryField';
import { useResourcePrices } from '../comparison/useResourcePrices';
import { useHdvItems } from './useHdvItems';
import { useHdvPriceSummary } from './useHdvPriceSummary';

// specs/023-hdv-price-entry: record the prices of an in-game HDV in one pass, one tab per HDV, with
// the very same price field as the Recherche page (same carnet, same Mode personnel / communautaire
// rules — FR-006/FR-007).

const TAB_STORAGE_KEY = 'craftcheck-hdv-tab';

const PRICE_FILTERS: { id: HdvPriceFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'missing', label: 'Sans prix' },
  { id: 'old', label: 'Prix ancien' },
];

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
  const [priceFilter, setPriceFilter] = useState<HdvPriceFilter>('all');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  // Values typed for one server or mode never carry over to another (same as the Recherche page).
  useEffect(() => {
    setInputs({});
  }, [serverId, priceMode]);

  const data = hdvItems.status === 'ready' ? hdvItems.data : undefined;
  const tabItems = useMemo(() => (data ? itemsForHdv(data, tab) : []), [data, tab]);
  const tabTypes = useMemo(() => (data ? typesInTab(tabItems, data.types) : []), [data, tabItems]);
  const summary = useHdvPriceSummary(serverId, priceMode, tabItems.map((item) => item.id));
  const filtered = filterByPrice(filterHdvItems(tabItems, { query, typeId }), summary.prices, priceFilter);
  const { visible, endRef, loadingMore, reset } = useLoadMoreOnScroll(filtered);
  const { data: carnet, save, remove, loaded } = useResourcePrices(serverId, visible.map((item) => item.id), resourcePricesFor(priceMode));
  const { priced, total } = countPriced(tabItems, summary.prices);

  const serverName = servers.find((server) => server.id === serverId)?.name;
  const modeLabel = priceMode === 'community' ? 'Mode communautaire' : 'Mode personnel';
  const typeNames = data?.types ?? {};

  const chooseTab = (next: HdvId) => {
    setTab(next);
    storeTab(next);
    setTypeId('');
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
              aria-selected={entry.id === tab}
              className={`hdv-tab${entry.id === tab ? ' hdv-tab--active' : ''}`}
              onClick={() => chooseTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {!serverId ? (
          <EmptyState icon="server" title="Aucun serveur choisi" description="Choisissez un serveur pour saisir ses prix." />
        ) : hdvItems.status === 'loading' ? (
          <p className="empty" role="status">Chargement des objets…</p>
        ) : hdvItems.status === 'unavailable' ? (
          <EmptyState icon="info" title="Liste des objets indisponible" description="Les objets de cet HDV n'ont pas pu être chargés. Réessayez plus tard ; vos prix déjà saisis sont conservés." />
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
                  placeholder="Rechercher un objet..."
                  aria-label="Rechercher un objet"
                />
              </div>
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
              <div className="hdv-price-filters" role="group" aria-label="Filtrer par prix">
                {PRICE_FILTERS.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    aria-pressed={entry.id === priceFilter}
                    className={`hdv-price-filter${entry.id === priceFilter ? ' hdv-price-filter--active' : ''}`}
                    onClick={() => {
                      setPriceFilter(entry.id);
                      reset();
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="results-meta">
              <span role="status">
                {summary.loaded ? `${priced} ${priced > 1 ? 'objets' : 'objet'} sur ${total} ${priced > 1 ? 'ont' : 'a'} un prix` : 'Lecture des prix…'}
              </span>
            </div>

            {tab === 'animals' && (
              <p className="hdv-note">
                La page XP Familier ne recommande que les nourritures de son tableau d'XP : les autres croquettes
                peuvent avoir un prix ici, sans être proposées là-bas.
              </p>
            )}

            {filtered.length === 0 ? (
              <EmptyState icon="search" title="Aucun objet ne correspond à votre recherche" description="Essayez un autre nom, un autre type ou un autre filtre de prix." />
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
                        caption={<span className="hdv-item-type">{typeNames[String(item.typeId)]}</span>}
                        priceMode={priceMode}
                        serverId={serverId}
                        input={inputs[item.id]}
                        onInput={(value) => setInputs((current) => ({ ...current, [item.id]: value }))}
                        carnet={{ data: carnet, save, remove, loaded }}
                        onSaved={summary.refresh}
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
      </section>
    </>
  );
}
