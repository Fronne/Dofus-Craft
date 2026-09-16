import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveServer } from '../../app/ServerContext';
import { ROUTES } from '../../app/router';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { prices } from '../../persistence/indexeddb-resource-price-repository';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { getResourceDetails } from '../../data/catalogue-repository';
import { normalizeSearchText } from '../../services/dofusdb-api';
import { formatKamas } from '../../domain/kamas';
import type { Resource } from '../../domain/types';

type PriceRow = { resource: Resource; unitPriceKamas: number };

const DISPLAY_LIMIT_OPTIONS = [10, 25, 50, 100];

export function PricesPage() {
  const { serverId } = useActiveServer();
  const navigate = useNavigate();
  const [itemRows, setItemRows] = useState<PriceRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemQuery, setItemQuery] = useState('');
  const [itemLimit, setItemLimit] = useState(DISPLAY_LIMIT_OPTIONS[0]);
  const [resourceRows, setResourceRows] = useState<PriceRow[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [resourceQuery, setResourceQuery] = useState('');
  const [resourceLimit, setResourceLimit] = useState(DISPLAY_LIMIT_OPTIONS[0]);

  useEffect(() => {
    if (!serverId) {
      setItemRows([]);
      setLoadingItems(false);
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    pinnedItemPrices.listAllForServer(serverId).then(async (entries) => {
      if (!entries.length) {
        if (!cancelled) {
          setItemRows([]);
          setLoadingItems(false);
        }
        return;
      }
      const items = await getResourceDetails(entries.map((entry) => entry.itemId));
      if (cancelled) return;
      const rows = entries
        .map((entry) => {
          const item = items.find((candidate) => candidate.id === entry.itemId);
          return item ? { resource: item, unitPriceKamas: entry.marketPriceKamas } : undefined;
        })
        .filter((row): row is PriceRow => row !== undefined)
        .sort((left, right) => left.resource.name.localeCompare(right.resource.name, 'fr'));
      setItemRows(rows);
      setLoadingItems(false);
    });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  useEffect(() => {
    if (!serverId) {
      setResourceRows([]);
      setLoadingResources(false);
      return;
    }
    let cancelled = false;
    setLoadingResources(true);
    prices.listAllForServer(serverId).then(async (entries) => {
      if (!entries.length) {
        if (!cancelled) {
          setResourceRows([]);
          setLoadingResources(false);
        }
        return;
      }
      const resources = await getResourceDetails(entries.map((entry) => entry.resourceId));
      if (cancelled) return;
      const rows = entries
        .map((entry) => {
          const resource = resources.find((candidate) => candidate.id === entry.resourceId);
          return resource ? { resource, unitPriceKamas: entry.unitPriceKamas } : undefined;
        })
        .filter((row): row is PriceRow => row !== undefined)
        .sort((left, right) => left.resource.name.localeCompare(right.resource.name, 'fr'));
      setResourceRows(rows);
      setLoadingResources(false);
    });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const normalizedItemQuery = normalizeSearchText(itemQuery);
  const filteredItems = normalizedItemQuery
    ? itemRows.filter((row) => normalizeSearchText(row.resource.name).includes(normalizedItemQuery))
    : itemRows;
  const visibleItems = filteredItems.slice(0, itemLimit);
  const normalizedResourceQuery = normalizeSearchText(resourceQuery);
  const filteredResourceRows = normalizedResourceQuery
    ? resourceRows.filter((row) => normalizeSearchText(row.resource.name).includes(normalizedResourceQuery))
    : resourceRows;
  const visibleResourceRows = filteredResourceRows.slice(0, resourceLimit);

  return (
    <>
      <header className="page-header">
        <h1>Prix</h1>
        <p>Retrouvez en un coup d'œil les prix personnels déjà enregistrés sur ce serveur.</p>
      </header>

      <div className="prices-grid">
        <section className="panel">
          <h2>Items</h2>
          <div className="search-input-wrap prices-search">
            <Icon name="search" size={18} className="search-input-icon" />
            <input
              type="search"
              value={itemQuery}
              onChange={(event) => setItemQuery(event.target.value)}
              placeholder="Rechercher un objet..."
              aria-label="Rechercher un objet"
            />
          </div>
          {loadingItems ? (
            <p className="empty">Chargement des prix…</p>
          ) : itemRows.length === 0 ? (
            <EmptyState
              icon="coins"
              title="Aucun prix HDV enregistré"
              description="Renseignez le prix HDV d'un objet depuis la page Recherche pour le voir apparaître ici."
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon="search"
              title="Aucun objet ne correspond à votre recherche"
              description="Essayez un autre nom d'objet."
            />
          ) : (
            <>
              <div className="results-meta">
                <span>{filteredItems.length} {filteredItems.length === 1 ? 'objet' : 'objets'}</span>
                <label>
                  Afficher :
                  <select value={itemLimit} onChange={(event) => setItemLimit(Number(event.target.value))}>
                    {DISPLAY_LIMIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <ul className="price-overview-list">
                {visibleItems.map((row) => (
                  <li key={row.resource.id} className="price-overview-row">
                    <button
                      type="button"
                      className="price-overview-main"
                      onClick={() => navigate(`${ROUTES.search}?item=${row.resource.id}`)}
                    >
                      <ResourceDisplay resource={row.resource} />
                    </button>
                    <b>{formatKamas(row.unitPriceKamas)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel">
          <h2>Ressources</h2>
          <div className="search-input-wrap prices-search">
            <Icon name="search" size={18} className="search-input-icon" />
            <input
              type="search"
              value={resourceQuery}
              onChange={(event) => setResourceQuery(event.target.value)}
              placeholder="Rechercher une ressource..."
              aria-label="Rechercher une ressource"
            />
          </div>
          {loadingResources ? (
            <p className="empty">Chargement des prix…</p>
          ) : resourceRows.length === 0 ? (
            <EmptyState
              icon="coins"
              title="Aucun prix de ressource enregistré"
              description="Saisissez le prix d'une ressource dans une recette pour le voir apparaître ici."
            />
          ) : filteredResourceRows.length === 0 ? (
            <EmptyState
              icon="search"
              title="Aucune ressource ne correspond à votre recherche"
              description="Essayez un autre nom de ressource."
            />
          ) : (
            <>
              <div className="results-meta">
                <span>{filteredResourceRows.length} {filteredResourceRows.length === 1 ? 'ressource' : 'ressources'}</span>
                <label>
                  Afficher :
                  <select value={resourceLimit} onChange={(event) => setResourceLimit(Number(event.target.value))}>
                    {DISPLAY_LIMIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <ul className="price-overview-list">
                {visibleResourceRows.map((row) => (
                  <li key={row.resource.id} className="price-overview-row">
                    <ResourceDisplay resource={row.resource} />
                    <b>{formatKamas(row.unitPriceKamas)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
