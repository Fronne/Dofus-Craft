import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Resource, ResourcePrice } from '../../domain/types';
import { compare } from '../../domain/craft-comparison';
import { formatKamas, isValidKamas, parseKamas } from '../../domain/kamas';
import { ItemSearch } from '../catalogue/ItemSearch';
import { ItemResults } from '../catalogue/ItemResults';
import { ItemDetail } from '../catalogue/ItemDetail';
import { ResourcePriceInput } from '../comparison/ResourcePriceInput';
import { MarketPriceInput } from '../comparison/MarketPriceInput';
import { RecommendationBadge, SavingsNote, insufficientDataHint } from '../comparison/ComparisonResult';
import { useResourcePrices } from '../comparison/useResourcePrices';
import { useCommunityPrice } from '../comparison/useCommunityPrice';
import { useCatalogue } from '../catalogue/useCatalogue';
import { usePinnedItems } from '../catalogue/usePinnedItems';
import { useActiveServer } from '../../app/ServerContext';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { prices } from '../../persistence/indexeddb-resource-price-repository';
import { communityModePrices } from '../../persistence/indexeddb-community-mode-price-repository';
import type { PriceMode } from '../../domain/price-modes';

const SEARCH_CONTEXT_STORAGE_KEY = 'craftcheck-recherche-context';

// FR-001/FR-004/FR-006: in Mode communautaire, a resource with no entry yet in the community-mode
// carnet is pre-filled from the community median (once, guarded by `prefilled`) and immediately
// saved via `onPrefill` — after that, `hasCarnetEntry` becomes true and this never fires again for
// that resource, so a later refresh of `useCommunityPrice` can never overwrite it. `useCommunityPrice`
// is only ever mounted here (a dedicated key={resourceId} instance per ingredient), never in Mode
// personnel, so no community network call happens outside Mode communautaire (FR-015).
function CommunityResourcePriceRow({
  resource,
  quantity,
  serverId,
  value,
  hasCarnetEntry,
  updatedAt,
  onChange,
  onPrefill,
}: {
  resource: Resource;
  quantity: number;
  serverId: string;
  value: string;
  hasCarnetEntry: boolean;
  updatedAt?: string;
  onChange: (value: string) => void;
  onPrefill: (price: number) => void;
}) {
  const [communityState, commit] = useCommunityPrice(resource.id, serverId);
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || hasCarnetEntry || communityState.kind !== 'found') return;
    prefilled.current = true;
    onPrefill(communityState.price.medianAmountKamas);
  }, [communityState, hasCarnetEntry, onPrefill]);

  const communityMeta = communityState.kind === 'found'
    ? { sampleSize: communityState.price.sampleSize, stale: communityState.stale }
    : undefined;

  // FR-017/FR-018/FR-019: called on blur, only once the player has actually changed the value
  // (ResourcePriceInput's own onCommit guard) — submits it as a new contribution, then, on
  // success, overwrites the carnet with the recalculated median so the field durably reflects it
  // across remounts (research.md, révision 4, "Écrire la médiane recalculée dans le carnet").
  async function handleCommit(rawValue: string) {
    if (!isValidKamas(rawValue)) return;
    const refreshed = await commit(Number(rawValue));
    if (refreshed?.kind === 'found') onChange(String(refreshed.price.medianAmountKamas));
  }

  return (
    <ResourcePriceInput
      resource={resource}
      quantity={quantity}
      value={value}
      updatedAt={updatedAt}
      communityMeta={communityMeta}
      lockWhenFilled
      onChange={onChange}
      onCommit={handleCommit}
    />
  );
}

export function RecherchePage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId } = useActiveServer();
  const [searchParams, setSearchParams] = useSearchParams();
  const updateParams = (patch: Record<string, string | undefined>) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });
  };
  // Nav-link clicks land on the bare route (no query string), so a plain URL-only search
  // context would be lost every time the user leaves Recherche and comes back. Restore it
  // from sessionStorage in that case; an explicit deep link (e.g. ?item=X from Épinglés or
  // Prix) is left untouched since the URL already carries intentional state.
  useEffect(() => {
    if (searchParams.toString()) return;
    try {
      const stored = window.sessionStorage.getItem(SEARCH_CONTEXT_STORAGE_KEY);
      if (!stored) return;
      const restored = new URLSearchParams(stored);
      if ([...restored.keys()].length > 0) setSearchParams(restored, { replace: true });
    } catch {
      // sessionStorage unavailable (private browsing, etc.) — nothing to restore.
    }
  }, []);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(SEARCH_CONTEXT_STORAGE_KEY, searchParams.toString());
    } catch {
      // sessionStorage unavailable — the search context just won't survive navigation.
    }
  }, [searchParams]);
  const query = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const levelMin = searchParams.get('levelMin') ?? '';
  const levelMax = searchParams.get('levelMax') ?? '';
  const resultLimit = Number(searchParams.get('limit')) || 12;
  const selected = searchParams.get('item') ?? '';
  const setQuery = (value: string) => updateParams({ q: value });
  const setCategory = (value: string) => updateParams({ category: value });
  const setLevelMin = (value: string) => updateParams({ levelMin: value });
  const setLevelMax = (value: string) => updateParams({ levelMax: value });
  const setResultLimit = (value: number) => updateParams({ limit: String(value) });
  const setSelected = (id: string) => updateParams({ item: id });
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [market, setMarket] = useState('');
  const levelFilter = levelMin || levelMax ? `${levelMin}:${levelMax}` : '';
  const catalogue = useCatalogue(query, category, selected, levelFilter, resultLimit);
  const pinned = usePinnedItems();
  const resetFilters = () => {
    updateParams({ q: undefined, category: undefined, levelMin: undefined, levelMax: undefined });
  };
  const selectedItem = catalogue.items.find((item) => item.id === selected) ??
    pinned.pinnedItems.find((entry) => entry.item.id === selected)?.item;
  useEffect(() => {
    if (!selected && catalogue.items[0]) setSelected(catalogue.items[0].id);
    if (selected && catalogue.items.length > 0 && !selectedItem &&
      !pinned.pinnedItems.some((entry) => entry.item.id === selected)) {
      setSelected(catalogue.items[0].id);
    }
  }, [catalogue.items, selected, selectedItem, pinned.pinnedItems]);
  useEffect(() => {
    if (!serverId || !selected) {
      setMarket('');
      return;
    }
    let cancelled = false;
    pinnedItemPrices.get(serverId, selected).then((price) => {
      if (!cancelled) setMarket(price ? String(price.marketPriceKamas) : '');
    });
    return () => {
      cancelled = true;
    };
  }, [serverId, selected]);
  useEffect(() => {
    setInputs({});
  }, [serverId]);
  const detail = selectedItem && catalogue.detail
    ? { item: selectedItem, category: catalogue.categories.find((candidate) => candidate.id === selectedItem.categoryId), ...catalogue.detail }
    : selectedItem
      ? { item: selectedItem, category: catalogue.categories.find((candidate) => candidate.id === selectedItem.categoryId), resources: [] }
      : undefined;
  const ids = detail?.recipe?.ingredients.map((ingredient) => ingredient.resourceId) ?? [];
  // FR-005: the craft-cost comparison below MUST read exclusively from the carnet of the active
  // mode — the personal `prices` repository in Mode personnel (unchanged), the physically separate
  // `communityModePrices` repository in Mode communautaire — and MUST NOT fall back to or merge
  // with the other one. Switching `priceMode` swaps which repository `useResourcePrices` reads
  // and writes; `market` (HDV price, `pinnedItemPrices`) is item-level and untouched by this
  // revision (spec.md Assumptions), never drawn into this branching.
  const { data, save, error } = useResourcePrices(serverId, ids, priceMode === 'community' ? communityModePrices : prices);
  const merged: Record<string, ResourcePrice> = {};

  ids.forEach((id) => {
    const input = inputs[id];
    const price =
      input === undefined ? data[id]?.unitPriceKamas : parseKamas(input);
    if (price !== undefined && Number.isFinite(price)) {
      merged[id] = {
        resourceId: id,
        unitPriceKamas: price,
        updatedAt: data[id]?.updatedAt ?? '',
      };
    }
  });

  const result = detail?.recipe
    ? compare(detail.recipe, merged, parseKamas(market))
    : undefined;

  return (
    <>
      <section className="panel">
        <ItemSearch
          query={query}
          setQuery={setQuery}
          category={category}
          setCategory={setCategory}
          levelMin={levelMin}
          setLevelMin={setLevelMin}
          levelMax={levelMax}
          setLevelMax={setLevelMax}
          onReset={resetFilters}
          categories={catalogue.categories}
        />
        {catalogue.error && <p className="warning">{catalogue.error}</p>}
        <ItemResults
          items={catalogue.items}
          selected={selected}
          onSelect={setSelected}
          loading={catalogue.loading}
          total={catalogue.total}
          totalPending={!catalogue.catalogueWarm && !query.trim() && !category && !levelMin && !levelMax}
          resultLimit={resultLimit}
          setResultLimit={setResultLimit}
        />
      </section>
      {catalogue.detailLoading && <p className="empty">Chargement des détails…</p>}
      {catalogue.detailError && <p className="warning">{catalogue.detailError}</p>}
      {detail?.recipe && result && (
        <section className="panel market-price-panel">
          <label htmlFor="market-price-input" className="market-price-label">Prix HDV</label>
          <div className="market-price-row">
            <MarketPriceInput
              value={market}
              onChange={(value) => {
                setMarket(value);
                if (selectedItem && serverId) {
                  const parsed = parseKamas(value);
                  if (parsed !== undefined) void pinnedItemPrices.save(serverId, selectedItem.id, parsed);
                }
              }}
            />
            <div className="market-price-summary">
              <RecommendationBadge recommendation={result.recommendation} hint={insufficientDataHint(result)} />
              <p>
                Coût de craft : <strong>{formatKamas(result.knownCraftCostKamas)}</strong>
                {result.craftCostStatus === 'partial' && ' (partiel)'}
              </p>
              <SavingsNote result={result} />
            </div>
          </div>
        </section>
      )}
      <div className="grid">
        <ItemDetail
          detail={detail}
          isPinned={selected ? pinned.isPinned(selected) : false}
          onTogglePin={selectedItem
            ? () => {
              if (pinned.isPinned(selectedItem.id)) {
                pinned.unpin(selectedItem.id);
              } else {
                pinned.pin(selectedItem);
              }
            }
            : undefined}
        />
        {detail?.recipe && (
          <section className="card">
            <h2>Prix des ressources</h2>
            {detail.recipe.ingredients.map((ingredient) => {
              const resource = detail.resources.find((item) => item.id === ingredient.resourceId) ??
                { id: ingredient.resourceId, name: ingredient.resourceId };
              const value =
                inputs[ingredient.resourceId] ??
                data[ingredient.resourceId]?.unitPriceKamas?.toString() ??
                '';
              const onChange = (nextValue: string) => {
                setInputs((current) => ({ ...current, [ingredient.resourceId]: nextValue }));
                const price = parseKamas(nextValue);
                if (price !== undefined) void save(ingredient.resourceId, price);
              };
              if (priceMode === 'community' && serverId) {
                return (
                  <Fragment key={ingredient.resourceId}>
                    <CommunityResourcePriceRow
                      resource={resource}
                      quantity={ingredient.quantity}
                      serverId={serverId}
                      value={value}
                      hasCarnetEntry={data[ingredient.resourceId] !== undefined || inputs[ingredient.resourceId] !== undefined}
                      updatedAt={data[ingredient.resourceId]?.updatedAt}
                      onChange={onChange}
                      onPrefill={(price) => void save(ingredient.resourceId, price)}
                    />
                  </Fragment>
                );
              }
              return (
                <Fragment key={ingredient.resourceId}>
                  <ResourcePriceInput
                    resource={resource}
                    quantity={ingredient.quantity}
                    value={value}
                    updatedAt={data[ingredient.resourceId]?.updatedAt}
                    onChange={onChange}
                  />
                </Fragment>
              );
            })}
            {error && <p className="warning">{error}</p>}
          </section>
        )}
      </div>
    </>
  );
}
