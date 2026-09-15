import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ResourcePrice } from '../../domain/types';
import { compare } from '../../domain/craft-comparison';
import { parseKamas } from '../../domain/kamas';
import { ItemSearch } from '../catalogue/ItemSearch';
import { ItemResults } from '../catalogue/ItemResults';
import { ItemDetail } from '../catalogue/ItemDetail';
import { ResourcePriceInput } from '../comparison/ResourcePriceInput';
import { MarketPriceInput } from '../comparison/MarketPriceInput';
import { ComparisonResult } from '../comparison/ComparisonResult';
import { useResourcePrices } from '../comparison/useResourcePrices';
import { useCatalogue } from '../catalogue/useCatalogue';
import { PinnedItems } from '../catalogue/PinnedItems';
import { usePinnedItems } from '../catalogue/usePinnedItems';
import { useActiveServer } from '../../app/ServerContext';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { PriceModeNotice } from '../comparison/PriceModeNotice';
import type { PriceMode } from '../../domain/price-modes';

export function RecherchePage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId } = useActiveServer();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [levelMin, setLevelMin] = useState('');
  const [levelMax, setLevelMax] = useState('');
  const [resultLimit, setResultLimit] = useState(12);
  const [selected, setSelected] = useState(() => searchParams.get('item') ?? '');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [market, setMarket] = useState('');
  const levelFilter = levelMin || levelMax ? `${levelMin}:${levelMax}` : '';
  const catalogue = useCatalogue(query, category, selected, levelFilter, resultLimit);
  const pinned = usePinnedItems();
  const resetFilters = () => {
    setQuery('');
    setCategory('');
    setLevelMin('');
    setLevelMax('');
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
    if (!serverId || !selected || !pinned.isPinned(selected)) {
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
  }, [serverId, selected, pinned.pinnedItems]);
  useEffect(() => {
    setInputs({});
  }, [serverId]);
  const detail = selectedItem && catalogue.detail
    ? { item: selectedItem, category: catalogue.categories.find((candidate) => candidate.id === selectedItem.categoryId), ...catalogue.detail }
    : selectedItem
      ? { item: selectedItem, category: catalogue.categories.find((candidate) => candidate.id === selectedItem.categoryId), resources: [] }
      : undefined;
  const ids = detail?.recipe?.ingredients.map((ingredient) => ingredient.resourceId) ?? [];
  const { data, save, error } = useResourcePrices(serverId, ids);
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
      <header className="page-header">
        <h1>Recherche</h1>
        <p>Comparez vos recettes avec des prix clairs et réutilisables.</p>
      </header>
      <PriceModeNotice priceMode={priceMode} />
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
        <PinnedItems
          items={pinned.pinnedItems.map((entry) => entry.item)}
          onSelect={setSelected}
          onUnpin={pinned.unpin}
        />
        {catalogue.error && <p className="warning">{catalogue.error}</p>}
        <ItemResults
          items={catalogue.items}
          selected={selected}
          onSelect={setSelected}
          loading={catalogue.loading}
          total={catalogue.total}
          isInitial={!query.trim() && !category && !levelMin && !levelMax}
          resultLimit={resultLimit}
          setResultLimit={setResultLimit}
        />
      </section>
      {catalogue.detailLoading && <p className="empty">Chargement des détails…</p>}
      {catalogue.detailError && <p className="warning">{catalogue.detailError}</p>}
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
                const parsedMarket = parseKamas(market);
                if (serverId && parsedMarket !== undefined) {
                  void pinnedItemPrices.save(serverId, selectedItem.id, parsedMarket);
                }
              }
            }
            : undefined}
        />
        {detail?.recipe && (
          <section className="card">
            <h2>Analyse de rentabilité</h2>
            <ComparisonResult result={result} />
            <h3 className="detail-subheading">Ressources nécessaires</h3>
            {detail.recipe.ingredients.map((ingredient) => {
              const resource = detail.resources.find((item) => item.id === ingredient.resourceId);
              const value =
                inputs[ingredient.resourceId] ??
                data[ingredient.resourceId]?.unitPriceKamas?.toString() ??
                '';
              return (
                <ResourcePriceInput
                  key={ingredient.resourceId}
                  resource={resource ?? { id: ingredient.resourceId, name: ingredient.resourceId }}
                  quantity={ingredient.quantity}
                  value={value}
                  updatedAt={data[ingredient.resourceId]?.updatedAt}
                  onChange={(nextValue) => {
                    setInputs((current) => ({ ...current, [ingredient.resourceId]: nextValue }));
                    const price = parseKamas(nextValue);
                    if (price !== undefined) void save(ingredient.resourceId, price);
                  }}
                />
              );
            })}
            <MarketPriceInput
              value={market}
              onChange={(value) => {
                setMarket(value);
                if (selectedItem && serverId && pinned.isPinned(selectedItem.id)) {
                  const parsed = parseKamas(value);
                  if (parsed !== undefined) void pinnedItemPrices.save(serverId, selectedItem.id, parsed);
                }
              }}
            />
            {error && <p className="warning">{error}</p>}
          </section>
        )}
      </div>
    </>
  );
}
