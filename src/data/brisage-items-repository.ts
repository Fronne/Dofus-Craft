import type { IndexedEffect, IndexedItem } from '../domain/brisage-search';

// specs/064-recherche-objets-par-stats (T004): the index of equipment and their rolls written by
// scripts/build-brisage-items.mjs. It weighs about 1 MB, so it is imported on demand, once.

export type BrisageItemsIndex = { source: string; sourceUrl: string; retrievedAt: string; items: IndexedItem[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function toEffect(value: unknown): IndexedEffect | undefined {
  if (!isRecord(value)) return undefined;
  const { effectId, from, to } = value;
  if (typeof effectId !== 'number' || typeof from !== 'number' || typeof to !== 'number') return undefined;
  if (!(Math.max(from, to) > 0)) return undefined;
  return { effectId, from: Math.min(from, to), to: Math.max(from, to) };
}

function toItem(value: unknown): IndexedItem | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.level !== 'number' || !Array.isArray(value.effects)) return undefined;
  const effects = value.effects.map(toEffect).filter((effect): effect is IndexedEffect => effect !== undefined);
  if (effects.length === 0) return undefined;
  return { id: value.id, name: value.name, level: value.level, imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : undefined, effects };
}

/** Reads the index back; an item of the wrong shape is dropped, an index of the wrong shape is refused. */
export function parseBrisageItemsIndex(value: unknown): BrisageItemsIndex {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.retrievedAt !== 'string') {
    throw new Error("L'index des objets est illisible.");
  }
  return {
    source: typeof value.source === 'string' ? value.source : '',
    sourceUrl: typeof value.sourceUrl === 'string' ? value.sourceUrl : '',
    retrievedAt: value.retrievedAt,
    items: value.items.map(toItem).filter((item): item is IndexedItem => item !== undefined),
  };
}

let loading: Promise<BrisageItemsIndex> | undefined;

export function loadBrisageItemsIndex(): Promise<BrisageItemsIndex> {
  loading ??= import('./brisage-items.json')
    .then((module) => parseBrisageItemsIndex(module.default))
    .catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
