import { useEffect, useState } from 'react';
import { ItemSearch } from '../catalogue/ItemSearch';
import { ItemResults } from '../catalogue/ItemResults';
import { ItemDetail } from '../catalogue/ItemDetail';
import { useCatalogue } from '../catalogue/useCatalogue';
import { usePinnedItems } from '../catalogue/usePinnedItems';
import { useActiveServer } from '../../app/ServerContext';
import type { PriceMode } from '../../domain/price-modes';
import { Icon } from '../../components/Icon';
import { GuidedTour } from '../onboarding/GuidedTour';
import { ItemVerdictPanel } from './ItemVerdictPanel';
import { ResourcePricesPanel } from './ResourcePricesPanel';
import { useRechercheUrlState } from './useRechercheUrlState';
import { useRechercheMarket } from './useRechercheMarket';
import { useRecherchePrices } from './useRecherchePrices';
import { useRechercheTour } from './useRechercheTour';
import { useRecipeRefresh } from './useRecipeRefresh';

export function RecherchePage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId } = useActiveServer();
  const {
    pendingParamsRef,
    query, setQuery,
    category, setCategory,
    levelMin, setLevelMin,
    levelMax, setLevelMax,
    resultLimit, setResultLimit,
    selected, setSelected,
    resetFilters,
  } = useRechercheUrlState();
  const community = priceMode === 'community';
  const levelFilter = levelMin || levelMax ? `${levelMin}:${levelMax}` : '';
  const catalogue = useCatalogue(query, category, selected, levelFilter, resultLimit);
  const pinned = usePinnedItems();
  const selectedItem = catalogue.items.find((item) => item.id === selected) ??
    pinned.pinnedItems.find((entry) => entry.item.id === selected)?.item;
  useEffect(() => {
    // A navigation already carrying an item is in flight (e.g. the search context restored when
    // coming back to this page): wait for it, or the first cached result would replace the item
    // the player was looking at — whichever navigation resolved last used to win.
    if (!selected && pendingParamsRef.current?.get('item')) return;
    if (!selected && catalogue.items[0]) setSelected(catalogue.items[0].id);
    if (selected && catalogue.resultsMatchQuery && catalogue.items.length > 0 && !selectedItem &&
      !pinned.pinnedItems.some((entry) => entry.item.id === selected)) {
      setSelected(catalogue.items[0].id);
    }
  }, [catalogue.items, catalogue.resultsMatchQuery, selected, selectedItem, pinned.pinnedItems]);
  // specs/047-recherche-refresh-prices: goes up each time the API has read prices again on request.
  const [reload, setReload] = useState(0);
  const {
    market, marketError, sharedItemPrice, marketOutlierDialog,
    commitMarketPrice, commitMarketPriceOnUnload, onMarketTypingChange, onMarketChange,
  } = useRechercheMarket({ serverId, selected, selectedItem, community, reload });
  const detail = selectedItem && catalogue.detail
    ? { item: selectedItem, category: catalogue.categories.find((candidate) => candidate.id === selectedItem.categoryId), ...catalogue.detail }
    : selectedItem
      ? { item: selectedItem, category: catalogue.categories.find((candidate) => candidate.id === selectedItem.categoryId), resources: [] }
      : undefined;
  const {
    inputs, setInputs, recipeTree, expandedPaths, setExpandedPaths, toggleExpanded, ids, carnet, error,
    ingredientChoices, setIngredientChoice, result, topCosts, firstCraftable, firstCraftablePath,
  } = useRecherchePrices({
    serverId, priceMode, selected, recipe: detail?.recipe, resources: detail?.resources ?? [], market, reload,
  });
  const { refresh, refreshPrices } = useRecipeRefresh({ serverId, selected, selectedItem, ids, setReload });
  const { tourOpen, openTour, tourSteps, helpButtonRef, onTourStepChange, onTourClose } = useRechercheTour({
    priceMode, firstCraftablePath, expandedPaths, setExpandedPaths,
  });

  return (
    <>
      <header className="page-header page-header--with-action">
        <div>
          <h1>Crafter ou acheter ?</h1>
          <p>Calculez en quelques secondes si un craft Dofus est rentable.</p>
        </div>
        <button
          ref={helpButtonRef}
          type="button"
          className="icon-button search-help-button"
          aria-label="Comment fonctionne cette page ?"
          title="Comment fonctionne cette page ?"
          onClick={openTour}
        >
          <Icon name="info" size={18} />
        </button>
      </header>
      <section className="search-panel">
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
        <ItemResults
          error={catalogue.error}
          onRetry={catalogue.retry}
          items={catalogue.items}
          selected={selected}
          onSelect={setSelected}
          loading={catalogue.loading}
          total={catalogue.total}
          totalPending={!catalogue.catalogueWarm && !query.trim() && !category && !levelMin && !levelMax}
          resultLimit={resultLimit}
          setResultLimit={setResultLimit}
          isRevalidating={catalogue.isRevalidating}
          offline={catalogue.offline}
          lastSyncedAt={catalogue.lastSyncedAt}
        />
      </section>
      {catalogue.detailLoading && <p className="empty" role="status">Chargement des détails…</p>}
      {catalogue.detailError && (
        <div className="inline-retry" role="alert">
          <p className="warning">{catalogue.detailError}</p>
          <button type="button" className="btn btn-secondary btn-small" onClick={catalogue.retry}>Réessayer</button>
        </div>
      )}
      {!detail && <ItemDetail />}
      {detail && (
        <ItemVerdictPanel
          detail={detail}
          selected={selected}
          selectedItem={selectedItem}
          isPinned={pinned.isPinned}
          onTogglePin={selectedItem
            ? () => {
              if (pinned.isPinned(selectedItem.id)) {
                pinned.unpin(selectedItem.id);
              } else {
                pinned.pin(selectedItem);
              }
            }
            : undefined}
          community={community}
          serverId={serverId}
          result={result}
          market={market}
          sharedItemPrice={sharedItemPrice}
          onMarketChange={onMarketChange}
          onMarketCommit={commitMarketPrice}
          onMarketUnloadCommit={commitMarketPriceOnUnload}
          onMarketTypingChange={onMarketTypingChange}
          marketError={marketError}
          marketOutlierDialog={marketOutlierDialog}
        />
      )}
      {/* The resource prices take the room; the item's effects sit beside them, or under on a narrow screen. */}
      <div className="detail-row">
        {detail?.recipe && (
          <ResourcePricesPanel
            recipe={detail.recipe}
            community={community}
            serverId={serverId}
            selectedItem={selectedItem}
            refresh={refresh}
            onRefresh={() => void refreshPrices()}
            reload={reload}
            priceMode={priceMode}
            inputs={inputs}
            setInputs={setInputs}
            carnet={carnet}
            topCosts={topCosts}
            firstCraftable={firstCraftable}
            result={result}
            recipeTree={recipeTree}
            expandedPaths={expandedPaths}
            onToggle={toggleExpanded}
            ingredientChoices={ingredientChoices}
            onChoose={setIngredientChoice}
            error={error}
          />
        )}
        <ItemDetail part="effects" detail={detail} pending={catalogue.detailLoading || Boolean(catalogue.detailError)} />
      </div>
      {tourOpen && (
        <GuidedTour
          steps={tourSteps}
          onStepChange={onTourStepChange}
          onClose={onTourClose}
        />
      )}
    </>
  );
}
