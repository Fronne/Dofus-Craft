import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePinnedItems } from './usePinnedItems';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { ROUTES } from '../../app/router';
import { useActiveServer } from '../../app/ServerContext';
import { getItemDetail } from '../../data/catalogue-repository';
import { prices } from '../../persistence/indexeddb-resource-price-repository';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { compare } from '../../domain/craft-comparison';
import { formatKamas } from '../../domain/kamas';

type PinnedPriceSummary = {
  craftCostKamas?: number;
  marketPriceKamas?: number;
  recommendation?: 'craft' | 'buy' | 'equal';
};

function formatPriceValue(value: number | undefined, loading: boolean) {
  if (loading) return '…';
  return value !== undefined ? formatKamas(value) : 'Non renseigné';
}

function priceClass(value: number | undefined, recommendation: PinnedPriceSummary['recommendation'], side: 'craft' | 'buy') {
  if (value === undefined) return 'unset';
  if (recommendation === side) return 'cheaper';
  if (recommendation && recommendation !== 'equal') return 'pricier';
  return '';
}

export function EpinglesPage() {
  const { pinnedItems, unpin } = usePinnedItems();
  const navigate = useNavigate();
  const { serverId } = useActiveServer();
  const [summaries, setSummaries] = useState<Record<string, PinnedPriceSummary>>({});
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  const pinnedItemIds = pinnedItems.map((entry) => entry.item.id).join(',');

  useEffect(() => {
    if (!serverId || !pinnedItemIds) {
      setSummaries({});
      setLoadingSummaries(false);
      return;
    }
    let cancelled = false;
    setLoadingSummaries(true);
    const ids = pinnedItemIds.split(',');
    (async () => {
      const [details, marketPrices] = await Promise.all([
        Promise.all(ids.map((id) => getItemDetail(id))),
        pinnedItemPrices.getMany(serverId, ids),
      ]);
      const allResourceIds = [...new Set(
        details.flatMap((detail) => detail.recipe?.ingredients.map((ingredient) => ingredient.resourceId) ?? []),
      )];
      const resourcePrices = await prices.getMany(serverId, allResourceIds);
      if (cancelled) return;
      const next: Record<string, PinnedPriceSummary> = {};
      ids.forEach((id, index) => {
        const detail = details[index];
        const marketPriceKamas = marketPrices[id]?.marketPriceKamas;
        const result = detail.recipe ? compare(detail.recipe, resourcePrices, marketPriceKamas) : undefined;
        next[id] = {
          craftCostKamas: result?.craftCostStatus === 'complete' ? result.knownCraftCostKamas : undefined,
          marketPriceKamas,
          recommendation: result && result.recommendation !== 'insufficient-data' ? result.recommendation : undefined,
        };
      });
      setSummaries(next);
      setLoadingSummaries(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [serverId, pinnedItemIds]);

  return (
    <>
      <header className="page-header">
        <h1>Épinglés</h1>
        <p>Retrouvez rapidement vos objets suivis, sans refaire de recherche.</p>
      </header>
      {pinnedItems.length === 0 ? (
        <EmptyState
          icon="pin"
          title="Aucun objet épinglé"
          description="Épinglez un objet depuis la recherche pour le retrouver ici, quel que soit le serveur actif."
        />
      ) : (
        <div className="pinned-grid" aria-label="Objets épinglés">
          {pinnedItems.map((entry) => {
            const summary = summaries[entry.item.id];
            return (
            <div className="pinned-card" key={entry.item.id}>
              <button
                type="button"
                className="pinned-card-main"
                onClick={() => navigate(`${ROUTES.search}?item=${entry.item.id}`)}
              >
                {entry.item.imageUrl ? (
                  <img src={entry.item.imageUrl} alt="" width="40" height="40" />
                ) : (
                  <span className="pinned-card-fallback" aria-hidden="true">
                    {entry.item.name.slice(0, 1)}
                  </span>
                )}
                <span className="pinned-card-info">
                  <span className="pinned-card-name">{entry.item.name}</span>
                  {entry.item.level !== undefined && (
                    <span className="pinned-card-level">Niveau {entry.item.level}</span>
                  )}
                  <span className="pinned-card-prices">
                    <span className={`pinned-card-price ${priceClass(summary?.craftCostKamas, summary?.recommendation, 'craft')}`}>
                      Craft : {formatPriceValue(summary?.craftCostKamas, loadingSummaries)}
                    </span>
                    <span className={`pinned-card-price ${priceClass(summary?.marketPriceKamas, summary?.recommendation, 'buy')}`}>
                      HDV : {formatPriceValue(summary?.marketPriceKamas, loadingSummaries)}
                    </span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="icon-button pinned-card-remove"
                aria-label={`Désépingler ${entry.item.name}`}
                onClick={() => unpin(entry.item.id)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            );
          })}
        </div>
      )}
    </>
  );
}
