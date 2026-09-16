import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityPriceLookup } from '../../src/services/community-price-api';

const getCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
}));

import { CommunityPriceDisplay } from '../../src/features/comparison/CommunityPriceDisplay';

describe('CommunityPriceDisplay', () => {
  beforeEach(() => {
    getCommunityPrice.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the median and sample size, distinct from any personal price, for a resource with no personal price entered', async () => {
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4 },
    });

    render(<CommunityPriceDisplay resourceId="r1" serverId="s1" />);

    const amount = await screen.findByText(/1 200/);
    expect(amount.closest('p')).toHaveTextContent('4 contributions');
  });

  it('shows an explicit "pas encore de données" state instead of a fabricated price', async () => {
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });

    render(<CommunityPriceDisplay resourceId="r1" serverId="s1" />);

    expect(await screen.findByText(/Aucun prix communautaire/)).toBeInTheDocument();
  });

  it('refetches the community price when the active server changes', async () => {
    getCommunityPrice.mockImplementation((_resourceId, serverId) => Promise.resolve({
      status: 'found',
      price: { resourceId: 'r1', serverId, medianAmountKamas: serverId === 's1' ? 1000 : 2000, sampleSize: 1 },
    }));

    const { rerender } = render(<CommunityPriceDisplay resourceId="r1" serverId="s1" />);
    expect(await screen.findByText(/1 000/)).toBeInTheDocument();

    rerender(<CommunityPriceDisplay resourceId="r1" serverId="s2" />);
    expect(await screen.findByText(/2 000/)).toBeInTheDocument();
    expect(getCommunityPrice).toHaveBeenLastCalledWith('r1', 's2');
  });

  it('automatically refetches every 5 minutes while the same resource stays displayed (FR-013)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'r1', serverId: 's1', medianAmountKamas: 1000, sampleSize: 1 },
    });

    render(<CommunityPriceDisplay resourceId="r1" serverId="s1" />);
    await waitFor(() => expect(getCommunityPrice).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await waitFor(() => expect(getCommunityPrice).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await waitFor(() => expect(getCommunityPrice).toHaveBeenCalledTimes(3));
  });
});
