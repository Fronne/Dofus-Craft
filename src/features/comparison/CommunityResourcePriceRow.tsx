import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import type { Resource } from '../../domain/types';
import { isValidKamas } from '../../domain/kamas';
import { computeDeviationPercent, OUTLIER_THRESHOLD_PERCENT } from '../../domain/outlier-threshold';
import { ResourcePriceInput } from './ResourcePriceInput';
import { PriceHistoryButton } from './PriceHistoryButton';
import { useCommunityPrice } from './useCommunityPrice';
import { useOutlierConfirm } from './OutlierConfirmDialog';

// FR-001/FR-004/FR-006: in Mode communautaire, a resource with no entry yet in the community-mode
// carnet is pre-filled from the community median (once, guarded by `prefilled`) and immediately
// saved via `onPrefill` — after that, `hasCarnetEntry` becomes true and this never fires again for
// that resource, so a later refresh of `useCommunityPrice` can never overwrite it. `useCommunityPrice`
// is only ever mounted here (a dedicated key={resourceId} instance per ingredient), never in Mode
// personnel, so no community network call happens outside Mode communautaire (FR-015).
// specs/015: a displayed line owns its own prefill; RecherchePage's tree-wide gap fill only covers
// resources whose line isn't displayed, so the two never write the same median.
export function CommunityResourcePriceRow({
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
  caption,
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
  caption?: ReactNode;
}) {
  const [communityState, commit] = useCommunityPrice(resource.id, serverId);
  const [outlierDialog, confirmOutlier] = useOutlierConfirm();
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !pricesLoaded || hasCarnetEntry || communityState.kind !== 'found') return;
    prefilled.current = true;
    onPrefill(communityState.price.medianAmountKamas);
  }, [communityState, hasCarnetEntry, pricesLoaded, onPrefill]);

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
        lockWhenFilled
        onChange={onChange}
        onCommit={handleCommit}
        retained={retained}
        subtotalKamas={subtotalKamas}
        caption={caption}
        history={<PriceHistoryButton key={serverId} kind="resource" id={resource.id} name={resource.name} serverId={serverId} />}
      />
      {outlierDialog}
    </Fragment>
  );
}
