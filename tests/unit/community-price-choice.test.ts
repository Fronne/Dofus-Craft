import { describe, expect, it } from 'vitest';
import { pickCommunityPrice } from '../../src/domain/community-price-choice';

// specs/024-latest-community-price, data-model.md (table « Règle de choix »).
const kept = (unitPriceKamas: number, updatedAt: string) => ({ resourceId: '11929', unitPriceKamas, updatedAt });
const latest = (amountKamas: number, contributedAt: string) => ({ amountKamas, contributedAt });

describe('pickCommunityPrice', () => {
  it('gives no price when there is neither a kept nor a shared price', () => {
    expect(pickCommunityPrice(undefined, undefined)).toEqual({ price: undefined, replacesCarnet: false });
  });

  it('takes the latest shared price, with its own date, when nothing is kept', () => {
    expect(pickCommunityPrice(undefined, latest(1848, '2026-09-28T13:51:28.940Z'))).toEqual({
      price: { unitPriceKamas: 1848, updatedAt: '2026-09-28T13:51:28.940Z' },
      replacesCarnet: true,
    });
  });

  it('keeps the kept price when nothing was shared', () => {
    expect(pickCommunityPrice(kept(1437, '2026-09-22T14:39:01.772Z'), undefined)).toEqual({
      price: { unitPriceKamas: 1437, updatedAt: '2026-09-22T14:39:01.772Z' },
      replacesCarnet: false,
    });
  });

  it('replaces an older kept price by the latest shared one', () => {
    expect(pickCommunityPrice(kept(1437, '2026-09-22T14:39:01.772Z'), latest(1848, '2026-09-28T13:51:28.940Z'))).toEqual({
      price: { unitPriceKamas: 1848, updatedAt: '2026-09-28T13:51:28.940Z' },
      replacesCarnet: true,
    });
  });

  it('keeps a kept price more recent than the latest shared one', () => {
    expect(pickCommunityPrice(kept(1700, '2026-09-28T15:00:00.000Z'), latest(1848, '2026-09-28T13:51:28.940Z'))).toEqual({
      price: { unitPriceKamas: 1700, updatedAt: '2026-09-28T15:00:00.000Z' },
      replacesCarnet: false,
    });
  });

  it('keeps the kept price on an exact tie of dates', () => {
    expect(pickCommunityPrice(kept(1848, '2026-09-28T13:51:28.940Z'), latest(1900, '2026-09-28T13:51:28.940Z'))).toMatchObject({
      price: { unitPriceKamas: 1848 },
      replacesCarnet: false,
    });
  });
});
