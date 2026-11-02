import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { createFmWorker } from '../support/fm-worker';

// specs/082-auteur-prix-communautaires (US3, contracts/price-author-api.md): GET /fm/me/contributions.
beforeEach(() => clearReadCache());

const daysAgo = (days: number, seconds = 0) => new Date(Date.now() - days * 86_400_000 + seconds * 1000).toISOString();

function insert(fm: ReturnType<typeof createFmWorker>, id: string, author: string | null, createdAt: string, resource = 'res-1', kind = 'resource') {
  fm.sqlite.prepare(
    `INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, device_id, kind, origin, created_at, author_discord_user_id)
     VALUES (?, ?, 'mikhal', 1000, 'device', ?, 'manual', ?, ?)`,
  ).run(id, resource, kind, createdAt, author);
}

describe('GET /fm/me/contributions', () => {
  it('needs a session token', async () => {
    const fm = createFmWorker();
    expect((await fm.call('GET', '/fm/me/contributions')).status).toBe(401);
  });

  it('gives nothing to a player who entered no price', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    const response = await fm.call('GET', '/fm/me/contributions', { token });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ total: 0, recent: [] });
  });

  it('lists the player\'s own prices, the latest first, and leaves out the others\' and the anonymous ones', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    insert(fm, 'a', '42', daysAgo(3), 'res-1');
    insert(fm, 'b', '42', daysAgo(1), 'item-1', 'item');
    insert(fm, 'c', '43', daysAgo(1, 5));
    insert(fm, 'd', null, daysAgo(1, 6));
    const body = await (await fm.call('GET', '/fm/me/contributions', { token })).json() as { total: number; recent: { resourceId: string; kind: string; serverId: string }[] };
    expect(body.total).toBe(2);
    expect(body.recent.map((row) => [row.resourceId, row.kind, row.serverId])).toEqual([['item-1', 'item', 'mikhal'], ['res-1', 'resource', 'mikhal']]);
  });

  it('counts every price kept but lists the 20 latest', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    for (let index = 0; index < 25; index += 1) insert(fm, `p${index}`, '42', daysAgo(2, index), `res-${index}`);
    const body = await (await fm.call('GET', '/fm/me/contributions', { token })).json() as { total: number; recent: { resourceId: string }[] };
    expect(body.total).toBe(25);
    expect(body.recent).toHaveLength(20);
    expect(body.recent[0].resourceId).toBe('res-24');
  });

  it('leaves out the prices past the retention', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    insert(fm, 'old', '42', daysAgo(120));
    insert(fm, 'new', '42', daysAgo(1));
    expect(((await (await fm.call('GET', '/fm/me/contributions', { token })).json()) as { total: number }).total).toBe(1);
  });

  it('is open to a player who is not a member of the group\'s server, and to a private profile', async () => {
    const fm = createFmWorker();
    const token = await fm.login('43', { isMember: false, isPrivate: true });
    insert(fm, 'a', '43', daysAgo(1));
    const response = await fm.call('GET', '/fm/me/contributions', { token });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { total: number }).total).toBe(1);
  });
});
