import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityPriceLookup } from '../../src/services/community-price-api';

const getCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
}));

import { CommunityPriceDisplay } from '../../src/features/comparison/CommunityPriceDisplay';

describe('CommunityPriceDisplay resilience when the community service is unavailable (US5)', () => {
  beforeEach(() => {
    getCommunityPrice.mockReset();
    window.sessionStorage.clear();
  });

  it('shows an explicit unavailability message when nothing was ever fetched this session', async () => {
    getCommunityPrice.mockResolvedValue({ status: 'unavailable' });

    render(<CommunityPriceDisplay resourceId="r1" serverId="s1" />);

    expect(await screen.findByText(/indisponible/)).toBeInTheDocument();
  });

  it('shows the last value fetched this session, marked as potentially stale, once a later fetch fails', async () => {
    getCommunityPrice.mockResolvedValueOnce({
      status: 'found',
      price: { resourceId: 'r1', serverId: 's1', medianAmountKamas: 1500, sampleSize: 3 },
    });
    const { rerender } = render(<CommunityPriceDisplay resourceId="r1" serverId="s1" />);
    await screen.findByText(/1 500/);

    // Force a refetch (server switch and back) once the backend has turned unavailable.
    getCommunityPrice.mockResolvedValue({ status: 'unavailable' });
    rerender(<CommunityPriceDisplay resourceId="r1" serverId="s2" />);
    await waitFor(() => expect(getCommunityPrice).toHaveBeenCalledWith('r1', 's2'));
    rerender(<CommunityPriceDisplay resourceId="r1" serverId="s1" />);

    const amount = await screen.findByText(/1 500/);
    expect(amount.closest('p')).toHaveTextContent('peut-être daté');
  });

  // CommunityPriceDisplay never reads or writes personal-price state (useResourcePrices,
  // MarketPriceInput) — it only calls getCommunityPrice and renders its own local state — so an
  // unavailable community backend structurally cannot affect the personal-price calculation that
  // lives entirely outside this component (guaranteed by T023's integration boundary, not
  // retested here).
});
