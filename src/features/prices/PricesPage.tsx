import { useEffect, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { EmptyState } from '../../components/EmptyState';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { usePinnedItems } from '../catalogue/usePinnedItems';
import { prices } from '../../persistence/indexeddb-resource-price-repository';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { getResourceDetails } from '../../data/catalogue-repository';
import { formatKamas } from '../../domain/kamas';
import type { Resource } from '../../domain/types';

export function PricesPage() {
  const { serverId } = useActiveServer();
  const { pinnedItems } = usePinnedItems();
  const [pinnedPrices, setPinnedPrices] = useState<Record<string, number>>({});
  const [resourceRows, setResourceRows] = useState<{ resource: Resource; unitPriceKamas: number }[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);

  useEffect(() => {
    if (!serverId || pinnedItems.length === 0) {
      setPinnedPrices({});
      return;
    }
    let cancelled = false;
    pinnedItemPrices.getMany(serverId, pinnedItems.map((entry) => entry.item.id)).then((result) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const [itemId, price] of Object.entries(result)) next[itemId] = price.marketPriceKamas;
      setPinnedPrices(next);
    });
    return () => {
      cancelled = true;
    };
  }, [serverId, pinnedItems]);

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
        .filter((row): row is { resource: Resource; unitPriceKamas: number } => row !== undefined)
        .sort((left, right) => left.resource.name.localeCompare(right.resource.name, 'fr'));
      setResourceRows(rows);
      setLoadingResources(false);
    });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const pinnedWithPrice = pinnedItems.filter((entry) => pinnedPrices[entry.item.id] !== undefined);

  return (
    <>
      <header className="page-header">
        <h1>Prix</h1>
        <p>Retrouvez en un coup d'œil les prix personnels déjà enregistrés sur ce serveur.</p>
      </header>

      <section className="panel prices-section">
        <h2>Objets épinglés</h2>
        {pinnedWithPrice.length === 0 ? (
          <EmptyState
            icon="coins"
            title="Aucun prix HDV enregistré"
            description="Saisissez le prix HDV d'un objet épinglé pour le voir apparaître ici."
          />
        ) : (
          <ul className="price-overview-list">
            {pinnedWithPrice.map((entry) => (
              <li key={entry.item.id} className="price-overview-row">
                <span className="resource-display">
                  {entry.item.imageUrl ? (
                    <img src={entry.item.imageUrl} alt="" width="32" height="32" />
                  ) : (
                    <span className="resource-image-fallback" aria-hidden="true">
                      {entry.item.name.slice(0, 1)}
                    </span>
                  )}
                  <span>{entry.item.name}</span>
                </span>
                <b>{formatKamas(pinnedPrices[entry.item.id])}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel prices-section">
        <h2>Ressources</h2>
        {loadingResources ? (
          <p className="empty">Chargement des prix…</p>
        ) : resourceRows.length === 0 ? (
          <EmptyState
            icon="coins"
            title="Aucun prix de ressource enregistré"
            description="Saisissez le prix d'une ressource dans une recette pour le voir apparaître ici."
          />
        ) : (
          <ul className="price-overview-list">
            {resourceRows.map((row) => (
              <li key={row.resource.id} className="price-overview-row">
                <ResourceDisplay resource={row.resource} />
                <b>{formatKamas(row.unitPriceKamas)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
