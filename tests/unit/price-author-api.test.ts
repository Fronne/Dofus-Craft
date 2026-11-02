import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { createFmWorker } from '../support/fm-worker';

// specs/082-auteur-prix-communautaires (contracts/price-author-api.md): who entered a community price, shown
// as a pseudonym when the author's profile is public, never as an id.
beforeEach(() => clearReadCache());
afterEach(() => vi.unstubAllGlobals());

// The Worker's entry needs the Workers types, which the app's own type check doesn't load: it is loaded
// here by a path that check doesn't follow, and typed by what the test uses of it.
type Env = { DB: unknown; COMMUNITY_API_KEY: string };
type Worker = { fetch(request: Request, env: Env): Promise<Response> };
const entry = '../../worker/src/index';
const loadWorker = async () => ((await import(/* @vite-ignore */ entry)) as { default: Worker }).default;

const SERVER = 'mikhal';

function setup() {
  const fm = createFmWorker();
  const env: Env = { DB: fm.d1, COMMUNITY_API_KEY: 'app-key' };
  const api = async (method: string, path: string, options: { body?: unknown; session?: string; env?: Env } = {}) => {
    const headers: Record<string, string> = { Authorization: 'Bearer app-key', 'Content-Type': 'application/json' };
    if (options.session) headers['X-Fm-Session'] = options.session;
    return (await loadWorker()).fetch(new Request(`https://api.test${path}`, {
      method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }), options.env ?? env);
  };
  const submit = (resourceId: string, amountKamas: number, options: { session?: string; kind?: 'item'; env?: Env } = {}) => api('POST', '/community-price', {
    body: { resourceId, serverId: SERVER, amountKamas, deviceId: 'device-1', ...(options.kind ? { kind: options.kind } : {}) },
    session: options.session,
    env: options.env,
  });
  const read = async (path: string) => (await api('GET', path)).json() as Promise<Record<string, unknown>>;
  const authors = () => fm.query<{ author_discord_user_id: string | null }>('SELECT author_discord_user_id FROM community_price_contributions ORDER BY rowid').map((row) => row.author_discord_user_id);
  return { ...fm, env, api, submit, read, authors };
}

describe('entering a price', () => {
  it('signs it with the player of a valid session', async () => {
    const t = setup();
    const token = await t.login('42', { displayName: 'Cyril' });
    expect((await t.submit('res-1', 1200, { session: token })).status).toBe(201);
    expect(t.authors()).toEqual(['42']);
  });

  it('is anonymous without a session header, with an unknown token or an expired one — and still entered', async () => {
    const t = setup();
    const token = await t.login('42');
    t.sqlite.prepare("UPDATE fm_auth_sessions SET expires_at = '2020-01-01T00:00:00.000Z'").run();
    expect((await t.submit('res-1', 1000)).status).toBe(201);
    expect((await t.submit('res-1', 1100, { session: 'unknown-token' })).status).toBe(201);
    expect((await t.submit('res-1', 1200, { session: token })).status).toBe(201);
    expect(t.authors()).toEqual([null, null, null]);
  });

  it('is entered anonymously, not refused, when the database fails to read the session', async () => {
    const t = setup();
    const token = await t.login('42');
    const failing = {
      prepare(sql: string) {
        if (sql.includes('fm_auth_sessions')) throw new Error('database unavailable');
        return t.d1.prepare(sql);
      },
      batch: t.d1.batch.bind(t.d1),
    };
    expect((await t.submit('res-1', 1200, { session: token, env: { ...t.env, DB: failing } })).status).toBe(201);
    expect(t.authors()).toEqual([null]);
  });

  it('lets a player who is not a member of the group\'s server sign their prices', async () => {
    const t = setup();
    const token = await t.login('43', { isMember: false });
    await t.submit('res-1', 1200, { session: token });
    expect(t.authors()).toEqual(['43']);
  });

  it('does not take an author from the request body', async () => {
    const t = setup();
    await t.api('POST', '/community-price', { body: { resourceId: 'res-1', serverId: SERVER, amountKamas: 900, deviceId: 'd', authorDiscordUserId: '99' } });
    expect(t.authors()).toEqual([null]);
  });
});

describe('reading the price of a resource', () => {
  it('gives the pseudonym of the author of the latest price, from /community-price and /community-prices', async () => {
    const t = setup();
    const token = await t.login('42', { displayName: 'Cyril' });
    await t.submit('res-1', 1200, { session: token });
    expect(await t.read(`/community-price?resourceId=res-1&serverId=${SERVER}`)).toMatchObject({ latestAmountKamas: 1200, latestAuthor: 'Cyril' });
    const batch = await t.read(`/community-prices?serverId=${SERVER}&resourceIds=res-1`) as { prices: Record<string, unknown>[] };
    expect(batch.prices[0]).toMatchObject({ resourceId: 'res-1', latestAuthor: 'Cyril' });
  });

  it('gives no author when the latest price is anonymous, even if an older one was signed', async () => {
    const t = setup();
    const token = await t.login('42', { displayName: 'Cyril' });
    await t.submit('res-1', 1200, { session: token });
    t.sqlite.prepare("UPDATE community_price_contributions SET created_at = '2026-11-01T10:00:00.000Z'").run();
    await t.submit('res-1', 1300);
    const body = await t.read(`/community-price?resourceId=res-1&serverId=${SERVER}&fresh=1`);
    expect(body.latestAmountKamas).toBe(1300);
    expect(body.latestAuthor).toBeUndefined();
  });

  it('hides the name of a private profile, for prices entered before and after the change, and shows it again once public', async () => {
    const t = setup();
    const token = await t.login('42', { displayName: 'Cyril' });
    await t.submit('res-1', 1200, { session: token });
    const path = `/community-price?resourceId=res-1&serverId=${SERVER}`;
    expect((await t.read(path)).latestAuthor).toBe('Cyril');

    expect((await t.call('PATCH', '/fm/me', { token, body: { isPrivate: true } })).status).toBe(200);
    expect((await t.read(path)).latestAuthor).toBeUndefined();
    await t.submit('res-1', 1250, { session: token });
    expect((await t.read(`${path}&fresh=1`)).latestAuthor).toBeUndefined();

    await t.call('PATCH', '/fm/me', { token, body: { isPrivate: false } });
    expect((await t.read(path)).latestAuthor).toBe('Cyril');
  });

  it('never exposes the Discord id of the author', async () => {
    const t = setup();
    const token = await t.login('4242424242', { displayName: 'Cyril' });
    await t.submit('res-1', 1200, { session: token });
    await t.submit('item-1', 5000, { session: token, kind: 'item' });
    for (const path of [
      `/community-price?resourceId=res-1&serverId=${SERVER}`,
      `/community-prices?serverId=${SERVER}&resourceIds=res-1`,
      `/latest-price?itemId=item-1&serverId=${SERVER}`,
      `/item-prices?serverId=${SERVER}`,
    ]) {
      expect(JSON.stringify(await t.read(path))).not.toContain('4242424242');
    }
  });

  it('changes neither the median nor the sample, with or without an author', async () => {
    const signed = setup();
    const anonymous = setup();
    const token = await signed.login('42');
    for (const amount of [1000, 1100, 1200]) {
      await signed.api('POST', '/community-price', { session: token, body: { resourceId: 'res-1', serverId: SERVER, amountKamas: amount, deviceId: `d${amount}` } });
      await anonymous.api('POST', '/community-price', { body: { resourceId: 'res-1', serverId: SERVER, amountKamas: amount, deviceId: `d${amount}` } });
    }
    const path = `/community-price?resourceId=res-1&serverId=${SERVER}`;
    const a = await signed.read(path);
    const b = await anonymous.read(path);
    for (const key of ['medianAmountKamas', 'sampleSize', 'latestAmountKamas']) expect(a[key]).toEqual(b[key]);
  });
});

describe('reading the price of an item', () => {
  it('gives the author of the latest HDV price, from /latest-price and /item-prices', async () => {
    const t = setup();
    const token = await t.login('42', { displayName: 'Cyril' });
    await t.submit('item-1', 5000, { session: token, kind: 'item' });
    expect(await t.read(`/latest-price?itemId=item-1&serverId=${SERVER}`)).toMatchObject({ amountKamas: 5000, author: 'Cyril' });
    const list = await t.read(`/item-prices?serverId=${SERVER}`) as { items: Record<string, unknown>[] };
    expect(list.items[0]).toMatchObject({ itemId: 'item-1', author: 'Cyril' });
  });

  it('gives no author for an anonymous price or a private profile', async () => {
    const t = setup();
    const token = await t.login('42', { displayName: 'Cyril', isPrivate: true });
    await t.submit('item-1', 5000, { session: token, kind: 'item' });
    await t.submit('item-2', 7000, { kind: 'item' });
    expect((await t.read(`/latest-price?itemId=item-1&serverId=${SERVER}`)).author).toBeUndefined();
    expect((await t.read(`/latest-price?itemId=item-2&serverId=${SERVER}`)).author).toBeUndefined();
    const list = await t.read(`/item-prices?serverId=${SERVER}`) as { items: Record<string, unknown>[] };
    expect(list.items.every((item) => item.author === undefined)).toBe(true);
  });
});

describe('the profile deleted', () => {
  it('keeps the prices, anonymous, and does not link them again to the same account', async () => {
    const t = setup();
    const token = await t.login('42', { displayName: 'Cyril' });
    const other = await t.login('43', { displayName: 'Autre' });
    await t.submit('res-1', 1200, { session: token });
    await t.submit('res-2', 800, { session: other });
    expect((await t.call('DELETE', '/fm/me', { token })).status).toBe(204);

    expect(t.authors()).toEqual([null, '43']);
    expect((await t.read(`/community-price?resourceId=res-1&serverId=${SERVER}`)).latestAmountKamas).toBe(1200);
    expect((await t.read(`/community-price?resourceId=res-1&serverId=${SERVER}&fresh=1`)).latestAuthor).toBeUndefined();

    const again = await t.login('42', { displayName: 'Cyril' });
    expect((await (await t.call('GET', '/fm/me/contributions', { token: again })).json())).toEqual({ total: 0, recent: [] });
  });
});

describe('the prices of a capture', () => {
  const doAir = { itemName: 'Rune Do Air', itemId: '11663', quantity: 10, totalKamas: 15868 };

  it('are signed with the player when imported on the site', async () => {
    const t = setup();
    const token = await t.login('42', { displayName: 'Cyril' });
    expect((await t.call('POST', '/fm/imports', { token, body: { sharePrices: true, lines: [doAir] } })).status).toBe(201);
    expect(t.query('SELECT origin, author_discord_user_id FROM community_price_contributions')).toEqual([{ origin: 'capture', author_discord_user_id: '42' }]);
  });

  it('stay without an author when the Discord bot sends them', async () => {
    const t = setup();
    await t.login('42', { displayName: 'Cyril' });
    await t.startSession('42');
    await t.capture('42', 15868, [{ name: 'Rune Do Air', qty: 10, price: 15868 }]);
    const rows = t.query<{ origin: string; author_discord_user_id: string | null }>('SELECT origin, author_discord_user_id FROM community_price_contributions');
    expect(rows.every((row) => row.origin !== 'bot' || row.author_discord_user_id === null)).toBe(true);
  });
});
