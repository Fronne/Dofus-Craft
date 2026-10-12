import { describe, expect, it, vi } from 'vitest';
import { purgeStaleExternalPrices, refreshHuzounetPrices, syncHuzounetPrices } from '../../worker/src/huzounet';
import { createTestD1 } from '../support/sqlite-d1';

// specs/045-restore-production-worker (US2): the reading of Huzounet's prices, with Huzounet simulated.
const TUESDAY = '2026-10-06T02:00:00.000Z';
const MONDAY = '2026-10-05T02:00:00.000Z';

type Price = { price: { numerator: number; denominator: number } | null; receivedAt?: string; support?: number; contested?: boolean; excluded?: boolean; provisional?: boolean; stale?: boolean };
const priced = (kamas: number, fields: Partial<Price> = {}): Price => ({ price: { numerator: kamas, denominator: 1 }, receivedAt: '2026-10-05T20:00:00.000Z', support: 4, ...fields });

function setup(at = TUESDAY) {
  const test = createTestD1();
  // The server is read only once someone uses it.
  test.insert({ resourceId: '9999', amountKamas: 10, createdAt: '2026-10-01T10:00:00.000Z' });
  let clock = new Date(at).getTime();
  const answers = new Map<string, Price>();
  const fetcher = vi.fn(async (url: string, init: { headers: Record<string, string> }): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }> => {
    expect(init.headers.Accept).toBe('application/json');
    const ids = new URL(url).searchParams.get('items')!.split(',');
    return { ok: true, status: 200, json: async () => ({ prices: Object.fromEntries(ids.flatMap((id) => (answers.has(id) ? [[id, answers.get(id)]] : []))) }) };
  });
  const wait = vi.fn(async (ms: number) => {
    clock += ms;
  });
  const options = { fetch: fetcher, wait, now: () => new Date(clock) };
  const keep = (resourceId: string, fetchedAt = '2026-10-05T02:00:00.000Z', price = 10) => test.sqlite.prepare(
    `INSERT INTO external_prices (source, resource_id, server_id, unit_price_kamas, observed_at, fetched_at) VALUES ('huzounet', ?, 'mikhal', ?, ?, ?)`,
  ).run(resourceId, price, fetchedAt, fetchedAt);
  const kept = () => test.sqlite.prepare("SELECT resource_id, unit_price_kamas, support, provisional, stale, is_item FROM external_prices WHERE server_id = 'mikhal' ORDER BY CAST(resource_id AS INTEGER)")
    .all() as { resource_id: string; unit_price_kamas: number; support: number; provisional: number; stale: number; is_item: number }[];
  const state = (source = 'huzounet') => test.sqlite.prepare('SELECT run_date, cursor, completed_at, last_error FROM external_price_sync WHERE source = ?').get(source) as
    { run_date: string; cursor: number; completed_at: string | null; last_error: string | null } | undefined;
  const asked = () => fetcher.mock.calls.map(([url]) => new URL(url).searchParams.get('items')!.split(','));
  return { ...test, answers, fetcher, wait, options, keep, kept, state, asked, advance: (ms: number) => { clock += ms; } };
}

const ids = (from: number, count: number) => Array.from({ length: count }, (_, index) => String(from + index));

describe('syncHuzounetPrices', () => {
  it('asks Huzounet for the prices already kept, 50 at a time, a second apart, and says who it is', async () => {
    const { d1, options, keep, fetcher, wait, asked, answers, kept, state } = setup();
    for (const id of ids(100, 120)) keep(id);
    answers.set('100', priced(250, { support: 7, provisional: true }));

    const result = await syncHuzounetPrices(d1, options);

    expect(result).toMatchObject({ requests: 3, written: 1, removed: 0, servers: ['mikhal'] });
    expect(asked().map((batch) => batch.length)).toEqual([50, 50, 20]);
    expect(wait.mock.calls).toEqual([[1000], [1000]]);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toMatch(/^https:\/\/huzounet\.fr\/api\/market\/prices\?server=354&items=100,101,/);
    expect(init.headers['User-Agent']).toContain('dofus-craft.handy-apps.workers.dev');
    expect(kept()[0]).toEqual({ resource_id: '100', unit_price_kamas: 250, support: 7, provisional: 1, stale: 0, is_item: 0 });
    expect(state()).toMatchObject({ run_date: '2026-10-06', cursor: 219 });
    expect(state()!.completed_at).not.toBeNull();
  });

  it('stops after 12 requests, carries on from there at the next run, and does not start a finished day again', async () => {
    const { d1, options, keep, asked, state, fetcher } = setup();
    for (const id of ids(1000, 650)) keep(id);

    expect(await syncHuzounetPrices(d1, options)).toMatchObject({ requests: 12 });
    expect(state()).toMatchObject({ cursor: 1599, completed_at: null });

    expect(await syncHuzounetPrices(d1, options)).toMatchObject({ requests: 1 });
    expect(asked()[12]).toEqual(ids(1600, 50));
    expect(state()!.completed_at).not.toBeNull();

    expect(await syncHuzounetPrices(d1, options)).toMatchObject({ requests: 0, servers: [] });
    expect(fetcher).toHaveBeenCalledTimes(13);
  });

  it('reads no server nobody uses, and no server outside the ones it reads', async () => {
    const { d1, options, keep, fetcher, sqlite } = setup();
    keep('100');
    sqlite.exec('DELETE FROM community_price_contributions');
    expect(await syncHuzounetPrices(d1, options)).toMatchObject({ requests: 0 });
    expect(await syncHuzounetPrices(d1, { ...options, servers: ['nowhere'] })).toMatchObject({ requests: 0 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('asks on Monday for every known item too, and marks an equipment or an item the group priced', async () => {
    const { d1, options, keep, asked, answers, kept, insert } = setup(MONDAY);
    keep('100');
    insert({ resourceId: '300', amountKamas: 5000, createdAt: '2026-10-01T10:00:00.000Z', kind: 'item' });
    for (const id of ['100', '200', '250', '300']) answers.set(id, priced(Number(id)));

    await syncHuzounetPrices(d1, { ...options, itemIds: ['200', '100'], equipmentIds: ['250'] });

    expect(asked()).toEqual([['100', '200', '250', '300']]);
    expect(kept().map((row) => [row.resource_id, row.is_item])).toEqual([['100', 0], ['200', 0], ['250', 1], ['300', 1]]);
  });

  it('leaves a price Huzounet does not know, and removes one it no longer stands by or an absurd one', async () => {
    const { d1, options, keep, answers, kept } = setup();
    for (const id of ['1', '2', '3', '4', '5']) keep(id);
    answers.set('1', { price: null });
    answers.set('2', priced(500, { contested: true }));
    answers.set('3', priced(500, { excluded: true }));
    answers.set('4', priced(3_000_000_000));
    answers.set('5', { price: { numerator: 1, denominator: 4 }, receivedAt: '2026-10-05T20:00:00.000Z', stale: true });

    expect(await syncHuzounetPrices(d1, options)).toMatchObject({ written: 1, removed: 3 });
    expect(kept().map((row) => [row.resource_id, row.unit_price_kamas, row.stale])).toEqual([['1', 10, 0], ['5', 1, 1]]);
  });

  it('stops at the first failure, keeps what it had and records the error', async () => {
    const { d1, options, keep, kept, state, fetcher } = setup();
    for (const id of ids(100, 60)) keep(id);
    fetcher.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

    const result = await syncHuzounetPrices(d1, options);
    expect(result).toMatchObject({ requests: 1, written: 0, error: 'Huzounet a répondu 503' });
    expect(kept()).toHaveLength(60);
    expect(state()).toMatchObject({ cursor: 0, completed_at: null, last_error: 'Huzounet a répondu 503' });

    fetcher.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ prices: { 100: { price: 'cheap' } } }) });
    expect((await syncHuzounetPrices(d1, options)).error).toMatch(/inattendue pour l'objet 100/);
  });
});

describe('purgeStaleExternalPrices', () => {
  it('removes the prices not read since the cutoff', async () => {
    const { d1, keep, kept } = setup();
    keep('1', '2026-06-01T00:00:00.000Z');
    keep('2', '2026-10-01T00:00:00.000Z');
    await purgeStaleExternalPrices(d1, '2026-07-08T00:00:00.000Z');
    expect(kept().map((row) => row.resource_id)).toEqual(['2']);
  });
});

describe('refreshHuzounetPrices', () => {
  it('refuses a list that is empty, too long or not made of identifiers', async () => {
    const { d1, options, fetcher } = setup();
    for (const raw of [undefined, [], ids(1, 91), ['abc'], [12], ['1234567890']]) {
      expect(await refreshHuzounetPrices(d1, 'mikhal', raw, options)).toEqual({ status: 'invalid' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not read a server it does not read', async () => {
    const { d1, options, fetcher } = setup();
    expect(await refreshHuzounetPrices(d1, 'dakal', ['1'], options)).toEqual({ status: 'unknown-server' });
    expect(await refreshHuzounetPrices(d1, 'nowhere', ['1'], options)).toEqual({ status: 'unknown-server' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reads up to 90 items in two requests, each asked once, and marks the item whose page asked', async () => {
    const { d1, options, answers, asked, wait, kept } = setup();
    for (const id of ids(1, 90)) answers.set(id, priced(100));

    const result = await refreshHuzounetPrices(d1, 'mikhal', [...ids(1, 90), '1'].slice(1), { ...options, itemId: '90', equipmentIds: [] });

    expect(result).toEqual({ status: 'ok', refreshed: 90, requests: 2 });
    expect(asked().map((batch) => batch.length)).toEqual([50, 40]);
    expect(wait.mock.calls).toEqual([[1000]]);
    expect(kept().filter((row) => row.is_item === 1).map((row) => row.resource_id)).toEqual(['90']);
  });

  it('asks nothing for what was read in the last two minutes', async () => {
    const { d1, options, answers, asked, advance } = setup();
    answers.set('1', priced(100));
    answers.set('2', priced(200));
    expect(await refreshHuzounetPrices(d1, 'mikhal', ['1'], options)).toMatchObject({ refreshed: 1, requests: 1 });

    advance(60_000);
    expect(await refreshHuzounetPrices(d1, 'mikhal', ['1'], options)).toEqual({ status: 'ok', refreshed: 0, requests: 0 });
    expect(await refreshHuzounetPrices(d1, 'mikhal', ['1', '2'], options)).toMatchObject({ refreshed: 1, requests: 1 });
    expect(asked()).toEqual([['1'], ['2']]);

    advance(121_000);
    expect(await refreshHuzounetPrices(d1, 'mikhal', ['1'], options)).toMatchObject({ refreshed: 1, requests: 1 });
  });

  it('answers too soon when the server was read less than five seconds ago', async () => {
    const { d1, options, answers, advance, fetcher } = setup();
    answers.set('1', priced(100));
    await refreshHuzounetPrices(d1, 'mikhal', ['1'], options);

    advance(4000);
    expect(await refreshHuzounetPrices(d1, 'mikhal', ['2'], options)).toEqual({ status: 'too-soon' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    advance(1000);
    expect(await refreshHuzounetPrices(d1, 'mikhal', ['2'], options)).toMatchObject({ status: 'ok' });
  });

  it('answers unavailable when Huzounet fails, keeping the prices it had', async () => {
    const { d1, options, keep, kept, fetcher } = setup();
    keep('1', '2026-10-01T00:00:00.000Z', 77);
    fetcher.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    expect(await refreshHuzounetPrices(d1, 'mikhal', ['1'], options)).toEqual({ status: 'unavailable' });
    expect(kept()).toMatchObject([{ resource_id: '1', unit_price_kamas: 77 }]);
  });
});
