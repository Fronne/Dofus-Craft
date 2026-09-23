import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Resource, ResourcePrice } from '../../domain/types';
import { compare } from '../../domain/craft-comparison';
import { formatKamas, isValidKamas, parseKamas } from '../../domain/kamas';
import { ItemSearch } from '../catalogue/ItemSearch';
import { ItemResults } from '../catalogue/ItemResults';
import { SyncStatusIndicator } from '../../components/SyncStatusIndicator';
import { ItemDetail } from '../catalogue/ItemDetail';
import { ResourcePriceInput } from '../comparison/ResourcePriceInput';
import { MarketPriceInput } from '../comparison/MarketPriceInput';
import { RecommendationBadge, SavingsNote, insufficientDataHint } from '../comparison/ComparisonResult';
import { useResourcePrices } from '../comparison/useResourcePrices';
import { useCommunityPrice } from '../comparison/useCommunityPrice';
import { useOutlierConfirm } from '../comparison/OutlierConfirmDialog';
import { computeDeviationPercent, OUTLIER_THRESHOLD_PERCENT } from '../../domain/outlier-threshold';
import { useCatalogue } from '../catalogue/useCatalogue';
import { usePinnedItems } from '../catalogue/usePinnedItems';
import { useActiveServer } from '../../app/ServerContext';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { prices } from '../../persistence/indexeddb-resource-price-repository';
import { communityModePrices } from '../../persistence/indexeddb-community-mode-price-repository';
import type { PriceMode } from '../../domain/price-modes';
import { Icon } from '../../components/Icon';
import { GuidedTour } from '../onboarding/GuidedTour';
import { searchTourSteps } from '../onboarding/search-tour-steps';
import { hasSeenSearchTour, markSearchTourSeen } from '../../persistence/search-tour-preference';

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
  pricesLoaded,
  updatedAt,
  onChange,
  onPersist,
  onPrefill,
}: {
  resource: Resource;
  quantity: number;
  serverId: string;
  value: string;
  hasCarnetEntry: boolean;
  // specs/010-search-instant-cache, FR-006 (specs/004): true once the carnet's own read for the
  // current server/ids has actually settled. Gates the prefill below so "no entry yet" (still
  // loading) can never be mistaken for "confirmed empty" — without this, a remount race could let
  // a cache-first community median win against the carnet's own (still in-flight) load and
  // overwrite an already-persisted price.
  pricesLoaded: boolean;
  updatedAt?: string;
  onChange: (value: string) => void;
  // Writes the confirmed value to the local carnet (updating "dernière mise à jour" /
  // contribution count) — called from `handleCommit` below, once the outlier confirmation (if
  // any) has actually been accepted, never on a plain blur. Unlike Mode personnel, blur alone
  // isn't a safe trigger here: it fires before the player has answered the confirmation dialog,
  // so persisting there would update the date even when the player goes on to click "Annuler".
  onPersist: (price: number) => void;
  onPrefill: (price: number) => void;
}) {
  const [communityState, commit] = useCommunityPrice(resource.id, serverId);
  const [outlierDialog, confirmOutlier] = useOutlierConfirm();
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !pricesLoaded || hasCarnetEntry || communityState.kind !== 'found') return;
    prefilled.current = true;
    onPrefill(communityState.price.medianAmountKamas);
  }, [communityState, hasCarnetEntry, pricesLoaded, onPrefill]);

  const communityMeta = communityState.kind === 'found'
    ? { sampleSize: communityState.price.sampleSize, stale: communityState.stale }
    : undefined;

  // FR-017/FR-019: called on blur, only once the player has actually changed the value
  // (ResourcePriceInput's own onCommit guard) — submits it as a new contribution. Since specs/004
  // FR-018 (amendée révision 6) / specs/007 FR-012, a successful commit no longer overwrites the
  // field: the carnet keeps exactly the value the player just typed (written via `onPersist` right
  // below, not on every keystroke). `commit(amount)`'s return value is only used to refresh the
  // community metadata (sample size) already displayed, never to rewrite the input.
  // specs/007-outlier-confirmation, FR-001/FR-003/FR-004: when a community median is already known
  // and the entered value deviates from it by more than the threshold, a blocking confirmation is
  // required before this proceeds to `commit` at all (FR-008: no median known yet — e.g. this
  // resource's very first contribution — skips the comparison entirely, unchanged behavior).
  // FR-007 (specs/007): canceling that confirmation must leave "dernière mise à jour" and the
  // contribution count untouched — so `onPersist` only runs once the confirmation (if any) has
  // actually been accepted, never merely because the field was blurred.
  async function handleCommit(rawValue: string): Promise<'accepted' | 'rejected' | void> {
    if (!isValidKamas(rawValue)) return;
    const amount = Number(rawValue);
    if (communityState.kind === 'found') {
      const deviationPercent = computeDeviationPercent(amount, communityState.price.medianAmountKamas);
      if (deviationPercent > OUTLIER_THRESHOLD_PERCENT) {
        const confirmed = await confirmOutlier({
          medianAmountKamas: communityState.price.medianAmountKamas,
          enteredAmountKamas: amount,
          deviationPercent,
        });
        if (!confirmed) return 'rejected';
      }
    }
    onPersist(amount);
    await commit(amount);
  }

  return (
    <Fragment>
      <ResourcePriceInput
        resource={resource}
        quantity={quantity}
        value={value}
        updatedAt={communityState.kind === 'found' && communityState.price.lastContributionAt ? communityState.price.lastContributionAt : updatedAt}
        communityMeta={communityMeta}
        lockWhenFilled
        onChange={onChange}
        onCommit={handleCommit}
      />
      {outlierDialog}
    </Fragment>
  );
}

export function RecherchePage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId } = useActiveServer();
  const [searchParams, setSearchParams] = useSearchParams();
  // specs/011-search-onboarding: the guided tour starts on its own until it has been finished or
  // dismissed once on this device (FR-001), and the help button reopens it at step 1 (FR-007).
  // Leaving the page mid-tour unmounts it without marking it seen (research.md §5).
  const [tourOpen, setTourOpen] = useState(() => !hasSeenSearchTour());
  const tourSteps = useMemo(() => searchTourSteps(priceMode), [priceMode]);
  // react-router-dom's `navigate()` (which `setSearchParams` calls under the hood) is async — it
  // goes through the data router's own navigation queue, so `window.location.search` isn't
  // guaranteed to reflect a call's effect by the time a *second* call happens right after it.
  // Combined with `setSearchParams`'s functional updater also not being a true functional update
  // (it calls back with `searchParams` captured in a `useCallback` closure from the last render,
  // not the latest pending value), two `updateParams` calls issued close together — e.g. a
  // keystroke's own `setQuery` and RecherchePage's "auto-select the first result" effect calling
  // `setSelected` right after a catalogue update — can each build on a stale base, and whichever
  // navigation lands last silently overwrites the other's change (a dropped character while
  // typing, per user report — specs/010-search-instant-cache made a catalogue update land during
  // typing more often, by fetching search results twice per query, cache then network, instead of
  // once). `pendingParamsRef` tracks the latest *intended* params synchronously across calls, so
  // each one always builds on top of every prior call's patch, regardless of when the
  // corresponding navigation actually resolves. Multiple in-flight navigations aren't guaranteed
  // to resolve in the order they were issued, either — so this is only ever cleared once
  // `searchParams` (the router's committed value) actually matches what we last intended, never
  // just because it changed (an out-of-order resolution of an older, already-superseded call would
  // otherwise clear it prematurely, right back into the same race).
  const pendingParamsRef = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    if (pendingParamsRef.current && searchParams.toString() === pendingParamsRef.current.toString()) {
      pendingParamsRef.current = null;
    }
  }, [searchParams]);
  const updateParams = (patch: Record<string, string | undefined>) => {
    const base = pendingParamsRef.current ?? searchParams;
    const next = new URLSearchParams(base);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    pendingParamsRef.current = next;
    setSearchParams(next, { replace: true });
  };
  // The search text field is typed fast enough that a fully URL-controlled value can get reset to
  // a stale snapshot mid-typing: react-router-dom's navigate() is async and doesn't guarantee that
  // two in-flight navigations (this field's own update and, e.g., RecherchePage's "auto-select the
  // first result" effect calling setSelected right after a catalogue update) resolve in the order
  // they were issued. `query` is local state instead — always the latest typed value immediately,
  // never rewound by an unrelated navigation resolving late (confirmed by live-browser reproduction
  // of dropped characters while typing, and by `pendingParamsRef` above alone not being enough to
  // fix it). It's still pushed to the URL below for deep-linking / the sessionStorage restore, just
  // never read back from there except at the two explicit, imperative points that legitimately
  // want to replace it outright: the session-restore effect and `resetFilters`.
  const [query, setQueryDraft] = useState(() => searchParams.get('q') ?? '');
  const setQuery = (value: string) => {
    setQueryDraft(value);
    updateParams({ q: value });
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
      if ([...restored.keys()].length > 0) {
        setSearchParams(restored, { replace: true });
        setQueryDraft(restored.get('q') ?? '');
      }
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
  const category = searchParams.get('category') ?? '';
  const levelMin = searchParams.get('levelMin') ?? '';
  const levelMax = searchParams.get('levelMax') ?? '';
  const resultLimit = Number(searchParams.get('limit')) || 12;
  const selected = searchParams.get('item') ?? '';
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
    setQueryDraft('');
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
  const { data, save, remove, error, loaded: pricesLoaded } = useResourcePrices(serverId, ids, priceMode === 'community' ? communityModePrices : prices);
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
      <section className="panel search-panel">
        <button
          type="button"
          className="icon-button search-help-button"
          aria-label="Comment fonctionne cette page ?"
          title="Comment fonctionne cette page ?"
          onClick={() => setTourOpen(true)}
        >
          <Icon name="info" size={18} />
        </button>
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
        <SyncStatusIndicator
          isRevalidating={catalogue.isRevalidating}
          offline={catalogue.offline}
          lastSyncedAt={catalogue.lastSyncedAt}
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
                  if (parsed === undefined) {
                    void pinnedItemPrices.remove(serverId, selectedItem.id);
                  } else {
                    void pinnedItemPrices.save(serverId, selectedItem.id, parsed);
                  }
                }
              }}
            />
            <div className="market-price-summary" data-tour="recommendation">
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
          <section className="card" data-tour="resource-prices">
            <h2>Prix des ressources</h2>
            {detail.recipe.ingredients.map((ingredient) => {
              const resource = detail.resources.find((item) => item.id === ingredient.resourceId) ??
                { id: ingredient.resourceId, name: ingredient.resourceId };
              const value =
                inputs[ingredient.resourceId] ??
                data[ingredient.resourceId]?.unitPriceKamas?.toString() ??
                '';
              // Only updates the locally-typed value — persistence (and therefore "dernière mise
              // à jour") is deferred to `onBlur` below, so it doesn't move on every keystroke.
              const onChange = (nextValue: string) => {
                setInputs((current) => ({ ...current, [ingredient.resourceId]: nextValue }));
              };
              // Writes the field to the carnet once the player is done typing, and only if the
              // value actually changed since what's persisted — a no-op blur (click in, click
              // out) must not touch `updatedAt` either.
              const onBlur = (finalValue: string) => {
                const price = parseKamas(finalValue);
                const persisted = data[ingredient.resourceId]?.unitPriceKamas;
                if (price === persisted) return;
                if (price === undefined) {
                  void remove(ingredient.resourceId);
                } else {
                  void save(ingredient.resourceId, price);
                }
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
                      pricesLoaded={pricesLoaded}
                      updatedAt={data[ingredient.resourceId]?.updatedAt}
                      onChange={onChange}
                      onPersist={(price) => void save(ingredient.resourceId, price)}
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
                    onBlur={onBlur}
                  />
                </Fragment>
              );
            })}
            {error && <p className="warning">{error}</p>}
          </section>
        )}
      </div>
      {tourOpen && (
        <GuidedTour
          steps={tourSteps}
          onClose={() => {
            markSearchTourSeen();
            setTourOpen(false);
          }}
        />
      )}
    </>
  );
}
