import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupLatestItemPrice, useSharedItemPrice, type SharedItemPriceState } from '../../src/features/comparison/useSharedItemPrice';

const getLatestItemPrice = vi.fn();
const submitCommunityPrice = vi.fn();
vi.mock('../../src/services/community-price-api', () => ({
  getLatestItemPrice: (...args: unknown[]) => getLatestItemPrice(...args),
  submitCommunityPrice: (...args: unknown[]) => submitCommunityPrice(...args),
}));

type Commit = (amount: number) => Promise<SharedItemPriceState | undefined>;
function Harness({ onState, onCommit }: { onState: (state: SharedItemPriceState) => void; onCommit?: (commit: Commit) => void }) {
  const [state, commit] = useSharedItemPrice('208', 'mikhal');
  onCommit?.(commit);
  onState(state);
  return null;
}

const KEY = 'craftcheck-latest-item-price:mikhal:208';
const found = (amountKamas: number, contributedAt = '2026-09-24T10:00:00.000Z') =>
  ({ status: 'found', price: { itemId: '208', serverId: 'mikhal', amountKamas, contributedAt } });

async function flush() {
  await act(async () => {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  });
}

describe('useSharedItemPrice (specs/016)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getLatestItemPrice.mockReset();
    submitCommunityPrice.mockReset();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the cached price at once, then the fresh one from the network (and caches it)', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ amountKamas: 5000, contributedAt: '2026-09-20T10:00:00.000Z' }));
    getLatestItemPrice.mockResolvedValue(found(6000));
    const states: SharedItemPriceState[] = [];
    render(<Harness onState={(state) => states.push(state)} />);
    await flush();
    expect(states.find((state) => state.kind === 'found' && state.stale)).toMatchObject({ price: { amountKamas: 5000 } });
    expect(states.at(-1)).toEqual({ kind: 'found', price: { amountKamas: 6000, contributedAt: '2026-09-24T10:00:00.000Z' }, stale: false });
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ amountKamas: 6000, contributedAt: '2026-09-24T10:00:00.000Z' });
  });

  it('reports not-found when nothing was shared', async () => {
    getLatestItemPrice.mockResolvedValue({ status: 'not-found' });
    const states: SharedItemPriceState[] = [];
    render(<Harness onState={(state) => states.push(state)} />);
    await flush();
    expect(states.at(-1)).toEqual({ kind: 'not-found' });
  });

  it('falls back to the cached price when the service is unreachable, or to unavailable without one', async () => {
    getLatestItemPrice.mockResolvedValue({ status: 'unavailable' });
    const states: SharedItemPriceState[] = [];
    const { unmount } = render(<Harness onState={(state) => states.push(state)} />);
    await flush();
    expect(states.at(-1)).toEqual({ kind: 'unavailable' });
    unmount();

    window.localStorage.setItem(KEY, JSON.stringify({ amountKamas: 5000, contributedAt: '2026-09-20T10:00:00.000Z' }));
    await expect(lookupLatestItemPrice('208', 'mikhal')).resolves.toEqual({ amountKamas: 5000, contributedAt: '2026-09-20T10:00:00.000Z' });
  });

  it('shares a committed price as an item, then reloads the latest one', async () => {
    getLatestItemPrice.mockResolvedValueOnce({ status: 'not-found' }).mockResolvedValue(found(7000, '2026-09-25T12:00:00.000Z'));
    submitCommunityPrice.mockResolvedValue({ id: 'c1' });
    const states: SharedItemPriceState[] = [];
    let commit: Commit | undefined;
    render(<Harness onState={(state) => states.push(state)} onCommit={(next) => { commit = next; }} />);
    await flush();
    await act(async () => {
      await commit!(7000);
    });
    expect(submitCommunityPrice).toHaveBeenCalledWith('208', 'mikhal', 7000, 'item');
    expect(states.at(-1)).toMatchObject({ kind: 'found', price: { amountKamas: 7000 } });
  });
});
