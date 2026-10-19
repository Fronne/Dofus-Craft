import { beforeEach, expect, it, vi } from 'vitest';
import { getItemEffectLines, getItemEffectRanges } from '../../src/data/catalogue-repository';
import { clearCache, setPersistentStore } from '../../src/data/catalogue-cache';

// specs/060-page-brisage (FR-002, FR-008): numeric lines of an item; weapon effects, negative lines
// and malformed effects are left out, a range keeps its maximum.
beforeEach(() => {
  clearCache();
  setPersistentStore(undefined);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    id: 777,
    effects: [
      { effectId: 125, from: 40, to: 44, category: 1 },
      { effectId: 123, from: 38, to: 0, category: 1 },
      { effectId: 112, from: 4, to: 4 },
      { effectId: 100, from: 10, to: 20, category: 2 },
      { effectId: 118, from: -5, to: -5, category: 1 },
      { from: 3, to: 3 },
      { effectId: 126, from: 0, to: 0 },
    ],
  }), { status: 200 })));
});

it('keeps positive non-weapon lines, with the maximum of a range', async () => {
  expect(await getItemEffectLines('777')).toEqual([
    { effectId: 125, value: 44 },
    { effectId: 123, value: 38 },
    { effectId: 112, value: 4 },
  ]);
});

// specs/061-simplification-page-brisage (FR-006): the roll range of each line; `to: 0` is a fixed value.
it('keeps the roll range of positive non-weapon lines', async () => {
  expect(await getItemEffectRanges('777')).toEqual([
    { effectId: 125, from: 40, to: 44 },
    { effectId: 123, from: 38, to: 38 },
    { effectId: 112, from: 4, to: 4 },
  ]);
});
