import { useCallback, useEffect, useRef, useState } from 'react';
import { pickCommunityPrice } from '../../domain/community-price-choice';
import {
  loadAvailability,
  sliceIds,
  SLICE_SPACING_MS,
  TOO_SOON_RETRIES,
  type LoadState,
  type RefreshOutcome,
} from '../../domain/huzounet-load';
import type { PriceMode } from '../../domain/price-modes';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { getCommunityPrices, refreshExternalPrices } from '../../services/community-price-api';

// specs/046-hdv-huzounet-load: loads the prices of a whole HDV tab from Huzounet, one request of 90
// items after the other (FR-003). After each request the prices of its items are read again and
// written to the Mode communautaire carnet with the rule of every other page — the most recent
// wins, dated with its own date (specs/024) — so the list, the count and the price filters all see
// them (FR-005). Nothing is shared in the player's name, and the personal carnet is never touched
// (FR-014).

const IDLE: LoadState = { status: 'idle' };

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Writes to the carnet the latest prices of `ids` that are more recent than what it holds. */
async function writeLatestPrices(serverId: string, ids: string[]): Promise<boolean> {
  const lookup = await getCommunityPrices(ids, serverId);
  if (lookup.status === 'unavailable') return false;
  const repository = resourcePricesFor('community');
  const carnet = await repository.getMany(serverId, ids);
  await Promise.all(lookup.prices.map(async (shared) => {
    const choice = pickCommunityPrice(carnet[shared.resourceId], { amountKamas: shared.latestAmountKamas, contributedAt: shared.latestContributionAt });
    if (!choice.replacesCarnet) return;
    await repository.save(serverId, shared.resourceId, shared.latestAmountKamas, shared.latestContributionAt).catch(() => undefined);
  }));
  return true;
}

export function useHuzounetLoad({
  serverId,
  priceMode,
  tab,
  ids,
  onSliceLoaded,
  wait = defaultWait,
}: {
  serverId: string | undefined;
  priceMode: PriceMode;
  tab: string;
  /** Every item of the tab, whatever the filters. */
  ids: string[];
  /** Called once the prices of a request are in the carnet. */
  onSliceLoaded: () => void;
  wait?: (ms: number) => Promise<void>;
}) {
  const [state, setState] = useState<LoadState>(IDLE);
  // The load in progress, if any: stopping it is flipping its flag, checked before every request,
  // after every wait and after every answer (FR-007).
  const current = useRef<{ stopped: boolean } | undefined>(undefined);
  // What a load reads when it starts and after each request, whatever render started it.
  const latest = useRef({ ids, onSliceLoaded, wait });
  useEffect(() => {
    latest.current = { ids, onSliceLoaded, wait };
  });

  // Another tab, server or mode, or leaving the page: the load stops and its message goes with it.
  useEffect(() => {
    setState(IDLE);
    return () => {
      if (current.current) current.current.stopped = true;
      current.current = undefined;
    };
  }, [serverId, priceMode, tab]);

  const start = useCallback(async () => {
    // FR-010: one load at a time. FR-011: nothing is sent where the button is inactive.
    if (current.current || !serverId || loadAvailability(priceMode, serverId) !== 'ready') return;
    const slices = sliceIds(latest.current.ids);
    const total = slices.reduce((count, slice) => count + slice.length, 0);
    if (total === 0) return;
    const token = { stopped: false };
    current.current = token;
    let done = 0;
    let loaded = 0;
    let lastSentAt: number | undefined;
    setState({ status: 'running', done, total, loaded });
    const end = (next: LoadState) => {
      if (token.stopped) return;
      current.current = undefined;
      setState(next);
    };

    for (const [index, slice] of slices.entries()) {
      const hdv = { tab, last: index === slices.length - 1 };
      let outcome: RefreshOutcome = { status: 'too-soon' };
      for (let attempt = 0; attempt <= TOO_SOON_RETRIES && outcome.status === 'too-soon'; attempt += 1) {
        if (lastSentAt !== undefined) {
          await latest.current.wait(Math.max(0, SLICE_SPACING_MS - (Date.now() - lastSentAt)));
        }
        if (token.stopped) return;
        const sentAt = Date.now();
        outcome = await refreshExternalPrices(serverId, slice, hdv);
        if (token.stopped) return;
        // Nothing was read on Huzounet (all read within the hour): no pause is owed before the next one.
        if (!(outcome.status === 'ok' && outcome.requests === 0)) lastSentAt = sentAt;
      }
      if (outcome.status === 'hourly-limit') {
        // FR-017: the tab was loaded within the hour, maybe by another player. Nothing more is asked of
        // Huzounet, but the prices the API already holds are still brought to this device's carnet.
        for (const rest of slices.slice(index)) {
          const written = await writeLatestPrices(serverId, rest).catch(() => false);
          if (token.stopped) return;
          if (!written) break;
          done += rest.length;
          latest.current.onSliceLoaded();
          setState({ status: 'running', done, total, loaded });
        }
        end({ status: 'failed', done, total, loaded, cause: 'hourly-limit', retryAt: outcome.retryAt });
        return;
      }
      if (outcome.status !== 'ok') {
        end({ status: 'failed', done, total, loaded, cause: outcome.status });
        return;
      }
      const written = await writeLatestPrices(serverId, slice).catch(() => false);
      if (token.stopped) return;
      done += slice.length;
      loaded += outcome.refreshed;
      latest.current.onSliceLoaded();
      if (!written) {
        end({ status: 'failed', done, total, loaded, cause: 'unreachable' });
        return;
      }
      setState({ status: 'running', done, total, loaded });
    }
    end({ status: 'finished', total, loaded });
  }, [serverId, priceMode, tab]);

  const stop = useCallback(() => {
    const token = current.current;
    if (!token) return;
    token.stopped = true;
    current.current = undefined;
    setState((value) => (value.status === 'running' ? { status: 'stopped', done: value.done, total: value.total, loaded: value.loaded } : value));
  }, []);

  return { state, start, stop };
}
