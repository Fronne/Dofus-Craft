import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCurrentMedian } from '../../worker/src/contribution';
import { sha256Hex } from '../../worker/src/fm/http';
import { clearReadCache } from '../../worker/src/read-cache';
import { createFmWorker, doAirLine } from '../support/fm-worker';

// specs/025-rune-purchase-import (US4, FR-019, research R8): the prices the bot's purchases create.
beforeEach(() => clearReadCache());

type Contribution = { resource_id: string; server_id: string; amount_kamas: number; device_id: string; kind: string; origin: string };
type Line = { item_id: string | null; price_status: string; contribution_id: string | null };

const statuses = async (response: Response) => ((await response.json()) as { lines: { priceStatus: string }[] }).lines.map((line) => line.priceStatus);
const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

describe('prices created by the bot', () => {
  it('records a recognized rune on the player\'s server, as a bot price under a pseudonym', async () => {
    const fm = createFmWorker();
    await fm.login('42', { serverId: 'mikhal' });
    expect(await statuses(await fm.capture('42', 15868, [doAirLine]))).toEqual(['recorded']);

    const [contribution] = fm.query<Contribution>('SELECT resource_id, server_id, amount_kamas, device_id, kind, origin FROM community_price_contributions');
    expect(contribution).toEqual({
      resource_id: '11663', server_id: 'mikhal', amount_kamas: 1587, kind: 'resource', origin: 'bot',
      device_id: `fm:${(await sha256Hex('42')).slice(0, 16)}`,
    });
    const [line] = fm.query<Line>('SELECT item_id, price_status, contribution_id FROM fm_purchase_lines');
    expect(line).toMatchObject({ item_id: '11663', price_status: 'recorded' });
    expect(line.contribution_id).not.toBeNull();
  });

  it('also prices a resource that is not a rune, never an equipment', async () => {
    const fm = createFmWorker();
    await fm.login('42');
    const answer = await statuses(await fm.capture('42', 3000, [
      { name: 'Bois de Frêne', qty: 10, price: 2400 },
      { name: 'Coiffe du Bouftou', qty: 1, price: 600 },
    ]));
    expect(answer).toEqual(['recorded', 'unknown-item']);
    expect(fm.query('SELECT resource_id FROM community_price_contributions')).toEqual([{ resource_id: '303' }]);
  });

  it('creates no price for an unknown name or a player without a server, but keeps the spending', async () => {
    const fm = createFmWorker();
    await fm.login('7', { serverId: null });
    expect(await statuses(await fm.capture('7', 15868, [doAirLine, { name: 'Rune Do Alr', qty: 10, price: 15868 }]))).toEqual(['no-server', 'unknown-item']);
    expect(fm.query('SELECT COUNT(*) AS n FROM community_price_contributions')).toEqual([{ n: 0 }]);
    expect(fm.query('SELECT spent_kamas FROM fm_captures')).toEqual([{ spent_kamas: 15868 }]);
  });

  it('leaves out a price more than 25 % away from the group\'s median, but keeps the spending', async () => {
    const fm = createFmWorker();
    await fm.login('42');
    fm.insert({ resourceId: '11663', amountKamas: 1000, createdAt: recent(1), deviceId: 'a' });

    expect(await statuses(await fm.capture('42', 12600, [{ name: 'Rune Do Air', qty: 10, price: 12600 }]))).toEqual(['outlier']);
    expect(await statuses(await fm.capture('42', 12500, [{ name: 'Rune Do Air', qty: 10, price: 12500 }]))).toEqual(['recorded']);
    expect(fm.query('SELECT SUM(spent_kamas) AS total FROM fm_captures')).toEqual([{ total: 25100 }]);
  });

  it('records the price when the group has no median yet', async () => {
    const fm = createFmWorker();
    await fm.login('42');
    expect(await statuses(await fm.capture('42', 999999, [{ name: 'Rune Fo', qty: 1, price: 999999 }]))).toEqual(['recorded']);
  });

  it('counts a player\'s repeated purchases once in the median', async () => {
    const fm = createFmWorker();
    await fm.login('42');
    await fm.capture('42', 15000, [{ name: 'Rune Do Air', qty: 10, price: 15000 }]);
    await fm.capture('42', 16000, [{ name: 'Rune Do Air', qty: 10, price: 16000 }]);
    expect(await fetchCurrentMedian(fm.d1, '11663', 'mikhal')).toMatchObject({ sampleSize: 1, latestAmountKamas: 1600, latestOrigin: 'bot' });
  });
});
