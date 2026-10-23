// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCatalogueSnapshot } from '../../scripts/build-catalogue-snapshot.mjs';

let dir: string;
let outDir: URL;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'snapshot-'));
  outDir = pathToFileURL(`${dir}/`);
  vi.useFakeTimers({ toFake: ['setTimeout'] });
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(dir, { recursive: true, force: true });
});

function fakeApi(counts: { items: number; sets: number }, failing = false) {
  return vi.fn(async (url: string) => {
    if (failing) throw new Error('offline');
    const target = new URL(url);
    const skip = Number(target.searchParams.get('$skip'));
    const limit = Number(target.searchParams.get('$limit'));
    const total = target.pathname === '/items' ? counts.items : counts.sets;
    const data = Array.from({ length: Math.max(0, Math.min(limit, total - skip)) }, (_, index) => ({
      id: skip + index + 1,
      name: { fr: `n${skip + index}`, en: 'drop' },
      level: 1,
      description: { fr: 'drop' },
    }));
    return { ok: true, json: async () => ({ total, limit, skip, data }) };
  });
}

async function run(promise: Promise<unknown>) {
  const settled = promise.then((value) => ({ value }), (error: Error) => ({ error }));
  await vi.runAllTimersAsync();
  return settled;
}

describe('buildCatalogueSnapshot (specs/072, US2)', () => {
  it('pages through everything and writes meta, items and item sets', async () => {
    const result = await run(buildCatalogueSnapshot({ fetchImpl: fakeApi({ items: 250, sets: 120 }) as never, outDir, log: () => undefined }));

    expect(result).toHaveProperty('value');
    const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
    expect(meta).toMatchObject({ version: 1, source: 'DofusDB', totals: { items: 250, itemSets: 120 } });
    const items = JSON.parse(await readFile(join(dir, 'items.json'), 'utf8'));
    expect(items).toHaveLength(250);
    expect(items[0]).toEqual({ id: 1, name: { fr: 'n0' }, level: 1 });
    expect(JSON.parse(await readFile(join(dir, 'item-sets.json'), 'utf8'))).toHaveLength(120);
  });

  it('fails without writing anything when DofusDB is unreachable', async () => {
    const result = await run(buildCatalogueSnapshot({ fetchImpl: fakeApi({ items: 1, sets: 1 }, true) as never, outDir, log: () => undefined }));

    expect(result).toHaveProperty('error');
    await expect(readFile(join(dir, 'meta.json'), 'utf8')).rejects.toThrow();
  });

  it('refuses an empty catalogue', async () => {
    const result = await run(buildCatalogueSnapshot({ fetchImpl: fakeApi({ items: 0, sets: 0 }) as never, outDir, log: () => undefined }));

    expect(result).toHaveProperty('error');
  });

  it('keeps the previous snapshot when the new catalogue is under half of it', async () => {
    const previous = JSON.stringify({ version: 1, generatedAt: 'x', source: 'DofusDB', totals: { items: 1000, itemSets: 100 } });
    await writeFile(join(dir, 'meta.json'), previous);

    const result = await run(buildCatalogueSnapshot({ fetchImpl: fakeApi({ items: 300, sets: 100 }) as never, outDir, log: () => undefined }));

    expect(result).toHaveProperty('error');
    expect(await readFile(join(dir, 'meta.json'), 'utf8')).toBe(previous);
  });
});

describe('buildCatalogueSnapshot duplicates', () => {
  it('refuses a crawl with duplicated ids even when the count matches', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ total: 2, limit: 100, skip: 0, data: [{ id: 1 }, { id: 1 }] }),
    }));

    const result = await run(buildCatalogueSnapshot({ fetchImpl: fetchImpl as never, outDir, log: () => undefined }));

    expect(result).toHaveProperty('error');
  });
});
