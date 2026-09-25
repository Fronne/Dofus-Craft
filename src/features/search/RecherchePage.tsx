import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Resource, ResourcePrice } from '../../domain/types';
import { compare } from '../../domain/craft-comparison';
import { isValidKamas, parseKamas } from '../../domain/kamas';
import { ItemSearch } from '../catalogue/ItemSearch';
import { ItemResults, RESULTS_PAGE_SIZE } from '../catalogue/ItemResults';
import { ItemDetail } from '../catalogue/ItemDetail';
import { ResourcePriceInput } from '../comparison/ResourcePriceInput';
import { PriceHistoryButton } from '../comparison/PriceHistoryButton';
import { MarketPriceInput } from '../comparison/MarketPriceInput';
import { ComparisonVerdict } from '../comparison/ComparisonResult';
import { useResourcePrices } from '../comparison/useResourcePrices';
import { useCommunityPrice } from '../comparison/useCommunityPrice';
import { useOutlierConfirm } from '../comparison/OutlierConfirmDialog';
import { computeDeviationPercent, needsItemPriceConfirmation, OUTLIER_THRESHOLD_PERCENT } from '../../domain/outlier-threshold';
import { useCatalogue } from '../catalogue/useCatalogue';
import { usePinnedItems } from '../catalogue/usePinnedItems';
import { useActiveServer } from '../../app/ServerContext';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import type { PriceMode } from '../../domain/price-modes';
import { Icon } from '../../components/Icon';
import { GuidedTour } from '../onboarding/GuidedTour';
import { searchTourSteps, type TourStep } from '../onboarding/search-tour-steps';
import { hasSeenSearchTour, markSearchTourSeen } from '../../persistence/search-tour-preference';
import { effectiveIngredientPrices, retainedCost, treeResourceIds } from '../../domain/craft-tree';
import { useRecipeTree } from '../comparison/useRecipeTree';
import { useIngredientChoices } from '../comparison/useIngredientChoices';
import { useSharedItemPrice } from '../comparison/useSharedItemPrice';
import { fillCommunityGaps } from '../comparison/community-gap-fill';
import { IngredientRow, type PriceFieldProps } from './IngredientRow';

const SEARCH_CONTEXT_STORAGE_KEY = 'craftcheck-recherche-context';

// FR-001/FR-004/FR-006: in Mode communautaire, a resource with no entry yet in the community-mode
// carnet is pre-filled from the community median (once, guarded by `prefilled`) and immediately
// saved via `onPrefill` — after that, `hasCarnetEntry` becomes true and this never fires again for
// that resource, so a later refresh of `useCommunityPrice` can never overwrite it. `useCommunityPrice`
// is only ever mounted here (a dedicated key={resourceId} instance per ingredient), never in Mode
// personnel, so no community network call happens outside Mode communautaire (FR-015).
// specs/015: a displayed line owns its own prefill; RecherchePage's tree-wide gap fill only covers
// resources whose line isn't displayed, so the two never write the same median.
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
  retained,
  subtotalKamas,
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
  retained?: ReactNode;
  subtotalKamas?: number | null;
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
        retained={retained}
        subtotalKamas={subtotalKamas}
        history={<PriceHistoryButton key={serverId} kind="resource" id={resource.id} name={resource.name} serverId={serverId} />}
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
    updateParams({ q: value, limit: undefined });
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
        // Recorded as the intended params right away, so effects running in this same commit
        // (the auto-select below) see the restored item instead of the still-empty URL.
        pendingParamsRef.current = restored;
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
  const resultLimit = Number(searchParams.get('limit')) || RESULTS_PAGE_SIZE;
  const selected = searchParams.get('item') ?? '';
  // A new search starts back at one page of results rather than keeping however many « Afficher
  // plus » clicks the previous one had.
  const setCategory = (value: string) => updateParams({ category: value, limit: undefined });
  const setLevelMin = (value: string) => updateParams({ levelMin: value, limit: undefined });
  const setLevelMax = (value: string) => updateParams({ levelMax: value, limit: undefined });
  const setResultLimit = (value: number) => updateParams({ limit: String(value) });
  const setSelected = (id: string) => updateParams({ item: id });
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [market, setMarket] = useState('');
  const community = priceMode === 'community';
  const levelFilter = levelMin || levelMax ? `${levelMin}:${levelMax}` : '';
  const catalogue = useCatalogue(query, category, selected, levelFilter, resultLimit);
  const pinned = usePinnedItems();
  const resetFilters = () => {
    setQueryDraft('');
    updateParams({ q: undefined, category: undefined, levelMin: undefined, levelMax: undefined, limit: undefined });
  };
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
  useEffect(() => {
    // specs/016: in Mode communautaire the HDV price is the group's latest shared one (below), never
    // the device's own; Mode personnel reads the local price exactly as before (FR-010).
    if (community) return;
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
  }, [serverId, selected, community]);
  // specs/016-shared-item-prices: the latest HDV price shared by the group for this item and server.
  const [sharedItemPrice, commitSharedItemPrice] = useSharedItemPrice(community ? selected || undefined : undefined, serverId);
  // Another item or server: start from an empty field, never the previous item's price — its own
  // shared price (or the cached one) fills it in as soon as it's known.
  useEffect(() => {
    if (community) setMarket('');
  }, [community, selected, serverId]);
  useEffect(() => {
    if (!community) return;
    if (sharedItemPrice.kind === 'found') setMarket(String(sharedItemPrice.price.amountKamas));
    // Only "nothing shared" empties the field: an unreachable service must never wipe what's shown
    // or what the player just typed (FR-011).
    else if (sharedItemPrice.kind === 'not-found') setMarket('');
  }, [community, sharedItemPrice]);
  useEffect(() => {
    setInputs({});
  }, [serverId]);
  const detail = selectedItem && catalogue.detail
    ? { item: selectedItem, category: catalogue.categories.find((candidate) => candidate.id === selectedItem.categoryId), ...catalogue.detail }
    : selectedItem
      ? { item: selectedItem, category: catalogue.categories.find((candidate) => candidate.id === selectedItem.categoryId), resources: [] }
      : undefined;
  // specs/015: the whole craft chain below the item — its intermediate recipes load progressively,
  // and the carnet is read for every resource in it, not just the top-level ingredients.
  const recipeTree = useRecipeTree(detail?.recipe, detail?.resources ?? []);
  // specs/015 US2: unfolded lines, by path from the top-level ingredient ("16489>303"); folded
  // again whenever another item is selected.
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    setExpandedPaths(new Set());
  }, [selected]);
  const toggleExpanded = (path: string) => setExpandedPaths((current) => {
    const next = new Set(current);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });
  const ids = detail?.recipe ? treeResourceIds(detail.recipe, recipeTree) : [];
  // FR-005: the craft-cost comparison below MUST read exclusively from the carnet of the active
  // mode — the personal `prices` repository in Mode personnel (unchanged), the physically separate
  // `communityModePrices` repository in Mode communautaire — and MUST NOT fall back to or merge
  // with the other one. Switching `priceMode` swaps which repository `useResourcePrices` reads
  // and writes; `market` (HDV price, `pinnedItemPrices`) is item-level and untouched by this
  // revision (spec.md Assumptions), never drawn into this branching.
  const { data, save, remove, error, loaded: pricesLoaded } = useResourcePrices(serverId, ids, resourcePricesFor(priceMode));
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

  // specs/015 FR-004: each ingredient counts for its retained cost (cheaper of buying and crafting),
  // computed by the same function the Suivis page uses, so both show the same craft cost (FR-011).
  const { choices: ingredientChoices, setChoice: setIngredientChoice } = useIngredientChoices();
  const result = detail?.recipe
    ? compare(detail.recipe, effectiveIngredientPrices(detail.recipe, recipeTree, merged, ingredientChoices), parseKamas(market))
    : undefined;

  // specs/015 research.md §7 (Mode communautaire): every resource of the tree without a carnet entry
  // gets the community median, collapsed sub-resources included — the Suivis page fills the same
  // gaps, so both pages count the same prices. Displayed lines are left to their own prefill
  // (CommunityResourcePriceRow), so a median is never written twice. Only once the carnet read for the current ids has
  // settled (`pricesLoaded`), so "not loaded yet" is never mistaken for "no entry" (FR-006 of
  // specs/004), and each resource is asked for once per server.
  const gapFillRequested = useRef(new Set<string>());
  useEffect(() => {
    gapFillRequested.current = new Set();
  }, [serverId, priceMode]);
  // Lines on screen: the top-level ingredients plus the sub-resources of every unfolded line.
  const displayedIds = new Set<string>();
  for (const ingredient of detail?.recipe?.ingredients ?? []) displayedIds.add(ingredient.resourceId);
  for (const path of expandedPaths) {
    const recipe = recipeTree.recipes[path.split('>').at(-1) as string];
    recipe?.ingredients.forEach((ingredient) => displayedIds.add(ingredient.resourceId));
  }
  const idsKey = ids.join(',');
  useEffect(() => {
    if (priceMode !== 'community' || !serverId || !pricesLoaded) return;
    const missing = idsKey.split(',').filter((id) =>
      id && !data[id] && !displayedIds.has(id) && !gapFillRequested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => gapFillRequested.current.add(id));
    let cancelled = false;
    void fillCommunityGaps(serverId, missing, { ...data }, async (resourceId, median) => {
      await save(resourceId, median);
    }, () => cancelled);
    return () => {
      cancelled = true;
    };
    // `data`/`save` change with every carnet write; the gap fill only needs to re-run when the set
    // of resources or the settled state changes, and the Set above prevents asking twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMode, serverId, pricesLoaded, idsKey]);

  // specs/016 US2: shares a validated HDV price in Mode communautaire. The typed value stays shown
  // (and used by the comparison) even if the service can't be reached — for this visit (FR-011).
  // US3: beyond 50 % of the latest price shown, a confirmation first — canceling shares nothing and
  // puts the previous value back (FR-006 to FR-008).
  const [marketOutlierDialog, confirmMarketOutlier] = useOutlierConfirm();
  const commitMarketPrice = async (value: string): Promise<'accepted' | 'rejected' | void> => {
    const amount = parseKamas(value);
    if (amount === undefined) return;
    const latest = sharedItemPrice.kind === 'found' ? sharedItemPrice.price.amountKamas : undefined;
    if (latest !== undefined && needsItemPriceConfirmation(amount, latest)) {
      const confirmed = await confirmMarketOutlier({
        medianAmountKamas: latest,
        enteredAmountKamas: amount,
        deviationPercent: latest === 0 ? Number.POSITIVE_INFINITY : computeDeviationPercent(amount, latest),
        referenceLabel: 'Dernier prix',
      });
      if (!confirmed) return 'rejected';
    }
    await commitSharedItemPrice(amount);
    return 'accepted';
  };

  // Top-level lines' retained costs. The guided tour's "Ingrédients craftables" step points at the
  // first craftable one, and unfolds its recipe while the step is shown.
  const topCosts = detail?.recipe
    ? detail.recipe.ingredients.map((ingredient) =>
      retainedCost(ingredient.resourceId, recipeTree, merged, ingredientChoices, new Set([detail.recipe!.itemId])))
    : [];
  const firstCraftable = topCosts.findIndex((cost) => cost.children !== undefined);
  const firstCraftablePath = firstCraftable >= 0 ? topCosts[firstCraftable].resourceId : undefined;
  // The line the tour unfolded itself (never one the player had unfolded), folded back afterwards.
  const tourUnfoldedPath = useRef<string | undefined>(undefined);
  const foldTourUnfolded = () => {
    const path = tourUnfoldedPath.current;
    if (!path) return;
    tourUnfoldedPath.current = undefined;
    setExpandedPaths((current) => {
      const next = new Set(current);
      next.delete(path);
      return next;
    });
  };
  const onTourStepChange = (step: TourStep) => {
    if (step.id !== 'intermediate') {
      foldTourUnfolded();
      return;
    }
    if (!firstCraftablePath || expandedPaths.has(firstCraftablePath)) return;
    tourUnfoldedPath.current = firstCraftablePath;
    setExpandedPaths((current) => new Set(current).add(firstCraftablePath));
  };

  // One price field, whatever its depth in the craft chain (specs/015 FR-007): same carnet, same
  // Mode personnel / communautaire rules as a top-level ingredient.
  const renderPriceField = ({ resource, quantity, retained, subtotalKamas }: PriceFieldProps) => {
    const resourceId = resource.id;
    const value = inputs[resourceId] ?? data[resourceId]?.unitPriceKamas?.toString() ?? '';
    // Only updates the locally-typed value — persistence (and therefore "dernière mise à jour")
    // is deferred to `onBlur` below, so it doesn't move on every keystroke.
    const onChange = (nextValue: string) => {
      setInputs((current) => ({ ...current, [resourceId]: nextValue }));
    };
    // Writes the field to the carnet once the player is done typing, and only if the value
    // actually changed since what's persisted — a no-op blur (click in, click out) must not touch
    // `updatedAt` either.
    const onBlur = (finalValue: string) => {
      const price = parseKamas(finalValue);
      const persisted = data[resourceId]?.unitPriceKamas;
      if (price === persisted) return;
      if (price === undefined) {
        void remove(resourceId);
      } else {
        void save(resourceId, price);
      }
    };
    if (priceMode === 'community' && serverId) {
      return (
        <CommunityResourcePriceRow
          resource={resource}
          quantity={quantity}
          serverId={serverId}
          value={value}
          hasCarnetEntry={data[resourceId] !== undefined || inputs[resourceId] !== undefined}
          pricesLoaded={pricesLoaded}
          updatedAt={data[resourceId]?.updatedAt}
          onChange={onChange}
          onPersist={(price) => void save(resourceId, price)}
          onPrefill={(price) => void save(resourceId, price)}
          retained={retained}
          subtotalKamas={subtotalKamas}
        />
      );
    }
    return (
      <ResourcePriceInput
        resource={resource}
        quantity={quantity}
        value={value}
        updatedAt={data[resourceId]?.updatedAt}
        onChange={onChange}
        onBlur={onBlur}
        retained={retained}
        subtotalKamas={subtotalKamas}
      />
    );
  };

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
          isRevalidating={catalogue.isRevalidating}
          offline={catalogue.offline}
          lastSyncedAt={catalogue.lastSyncedAt}
        />
      </section>
      {catalogue.detailLoading && <p className="empty">Chargement des détails…</p>}
      {catalogue.detailError && <p className="warning">{catalogue.detailError}</p>}
      {detail?.recipe && result && (
        <section className="panel market-price-panel">
          <div className="market-price-summary" data-tour="recommendation">
            <ComparisonVerdict
              result={result}
              marketPriceField={(
                <div className="verdict-market-field">
                  <label htmlFor="market-price-input" className="market-price-label">Prix HDV</label>
                  <MarketPriceInput
                    value={market}
                    lockWhenFilled={community}
                    updatedAt={community && sharedItemPrice.kind === 'found' ? sharedItemPrice.price.contributedAt : undefined}
                    onCommit={community ? commitMarketPrice : undefined}
                    history={community && selectedItem && serverId
                      ? <PriceHistoryButton key={serverId} kind="item" id={selectedItem.id} name={selectedItem.name} serverId={serverId} />
                      : undefined}
                    onChange={(value) => {
                      setMarket(value);
                      // Mode communautaire shares on commit (above), never into the local price.
                      if (!community && selectedItem && serverId) {
                        const parsed = parseKamas(value);
                        if (parsed === undefined) {
                          void pinnedItemPrices.remove(serverId, selectedItem.id);
                        } else {
                          void pinnedItemPrices.save(serverId, selectedItem.id, parsed);
                        }
                      }
                    }}
                  />
                </div>
              )}
            />
          </div>
          {marketOutlierDialog}
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
            {detail.recipe.ingredients.map((ingredient, index) => {
              const path = ingredient.resourceId;
              return (
                <IngredientRow
                  key={path}
                  path={path}
                  quantity={ingredient.quantity}
                  cost={topCosts[index]}
                  tourTarget={index === firstCraftable ? 'craftable-ingredient' : undefined}
                  tree={recipeTree}
                  expandedPaths={expandedPaths}
                  onToggle={toggleExpanded}
                  renderPriceField={renderPriceField}
                  choices={ingredientChoices}
                  onChoose={setIngredientChoice}
                />
              );
            })}
            {error && <p className="warning">{error}</p>}
          </section>
        )}
      </div>
      {tourOpen && (
        <GuidedTour
          steps={tourSteps}
          onStepChange={onTourStepChange}
          onClose={() => {
            foldTourUnfolded();
            markSearchTourSeen();
            setTourOpen(false);
          }}
        />
      )}
    </>
  );
}
