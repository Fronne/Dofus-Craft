import type { DofusDbItem, DofusDbItemSet, DofusDbItemTypeRecord, DofusDbPage, DofusDbRecipe, DofusDbServer } from './dofusdb-types';
import { stripDiacritics } from './text';

const API_URL = 'https://api.dofusdb.fr';

const ACCENT_VARIANTS: Record<string, string> = {
  a: 'aàâä',
  c: 'cç',
  e: 'eéèêë',
  i: 'iîï',
  o: 'oôö',
  u: 'uùûü',
  y: 'yÿ',
};

export function normalizeSearchText(value: string): string {
  return stripDiacritics(value).toLocaleLowerCase('fr-FR').trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toAccentInsensitiveRegex(value: string): string {
  return [...normalizeSearchText(value)].map((character) => {
    const variants = ACCENT_VARIANTS[character];
    if (!variants) {
      const upper = character.toUpperCase();
      return upper === character ? escapeRegex(character) : `[${character}${upper}]`;
    }
    return `[${variants}${variants.toUpperCase()}]`;
  }).join('');
}

export class DofusDbError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DofusDbError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPage<T>(value: unknown, itemGuard: (item: unknown) => item is T): value is DofusDbPage<T> {
  return (
    isRecord(value) &&
    typeof value.total === 'number' &&
    typeof value.limit === 'number' &&
    typeof value.skip === 'number' &&
    Array.isArray(value.data) &&
    value.data.every(itemGuard)
  );
}

function isItem(value: unknown): value is DofusDbItem {
  if (!isRecord(value) || typeof value.id !== 'number') return false;
  return value.name === undefined || typeof value.name === 'string' || isRecord(value.name);
}

function isRecipe(value: unknown): value is DofusDbRecipe {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.resultId === 'number' &&
    (value.ingredientIds === undefined || Array.isArray(value.ingredientIds)) &&
    (value.quantities === undefined || Array.isArray(value.quantities))
  );
}

function isItemSet(value: unknown): value is DofusDbItemSet {
  return isRecord(value) &&
    typeof value.id === 'number' &&
    (value.name === undefined || isRecord(value.name)) &&
    (value.items === undefined || Array.isArray(value.items) && value.items.every(isItem));
}

function isItemType(value: unknown): value is DofusDbItemTypeRecord {
  return isRecord(value) && typeof value.id === 'number' &&
    (value.superTypeId === undefined || typeof value.superTypeId === 'number');
}

function isServer(value: unknown): value is DofusDbServer {
  return isRecord(value) && typeof value.id === 'number';
}

async function request<T>(
  path: string,
  guard: (value: unknown) => value is T,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new DofusDbError('Impossible de joindre DofusDB.', error);
  }
  if (!response.ok) throw new DofusDbError(`DofusDB a répondu avec le statut ${response.status}.`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new DofusDbError('La réponse de DofusDB n’est pas un JSON valide.', error);
  }
  if (!guard(payload)) throw new DofusDbError('La réponse de DofusDB a un format inattendu.');
  return payload;
}

export async function searchDofusDbItems(
  query: string,
  typeId?: number,
  skip = 0,
  limit = 24,
  signal?: AbortSignal,
  sort = 'name.fr',
): Promise<DofusDbPage<DofusDbItem>> {
  const params = new URLSearchParams({
    $limit: String(limit),
    $skip: String(skip),
    $sort: sort,
    hasRecipe: 'true',
  });
  const queryTokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const serverToken = [...queryTokens].sort((left, right) => right.length - left.length)[0];
  if (serverToken) params.set('name.fr[$regex]', toAccentInsensitiveRegex(serverToken));
  if (typeId !== undefined) params.set('typeId', String(typeId));
  return request(`/items?${params.toString()}`, (value): value is DofusDbPage<DofusDbItem> =>
    isPage(value, isItem), signal);
}

export async function getDofusDbInitialItems(signal?: AbortSignal): Promise<DofusDbItem[]> {
  const page = await searchDofusDbItems('', undefined, 0, 100, signal, 'level');
  return page.data;
}

export async function getDofusDbItems(
  query: string,
  signal?: AbortSignal,
): Promise<DofusDbItem[]> {
  const pageLimit = 100;
  const items: DofusDbItem[] = [];
  let skip = 0;
  let total: number;
  do {
    const page = await searchDofusDbItems(query, undefined, skip, pageLimit, signal);
    items.push(...page.data);
    total = page.total;
    skip += page.data.length;
    if (!page.data.length) break;
  } while (skip < total);
  return items;
}

export async function getDofusDbItemsByTypeIds(
  query: string,
  typeIds: number[],
  signal?: AbortSignal,
): Promise<DofusDbItem[]> {
  const pageLimit = 100;
  const pages = await Promise.all(typeIds.map(async (typeId) => {
    const items: DofusDbItem[] = [];
    let pageSkip = 0;
    let total: number;
    do {
      const page = await searchDofusDbItems(query, typeId, pageSkip, pageLimit, signal);
      items.push(...page.data);
      total = page.total;
      pageSkip += page.data.length;
      if (!page.data.length) break;
    } while (pageSkip < total);
    return { items, total };
  }));
  const deduplicated = new Map<number, DofusDbItem>();
  pages.flatMap((page) => page.items).forEach((item) => deduplicated.set(item.id, item));
  const data = [...deduplicated.values()]
    .sort((left, right) => (left.name?.fr ?? '').localeCompare(right.name?.fr ?? '', 'fr'));
  return data;
}

export async function getDofusDbItemSets(
  query: string,
  signal?: AbortSignal,
): Promise<DofusDbItemSet[]> {
  const pageLimit = 50;
  const itemSets: DofusDbItemSet[] = [];
  let skip = 0;
  let total: number;
  do {
    const params = new URLSearchParams({
      $limit: String(pageLimit),
      $skip: String(skip),
      $sort: 'id',
    });
    const page = await request(`/item-sets?${params.toString()}`, (value): value is DofusDbPage<DofusDbItemSet> =>
      isPage(value, isItemSet), signal);
    itemSets.push(...page.data);
    total = page.total;
    skip += page.data.length;
    if (!page.data.length) break;
  } while (skip < total);

  const queryTokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  return itemSets.filter((itemSet) => {
    const name = normalizeSearchText(itemSet.name?.fr ?? '');
    return queryTokens.every((token) => name.includes(token));
  });
}

export async function getDofusDbItemTypes(signal?: AbortSignal): Promise<DofusDbItemTypeRecord[]> {
  const limit = 100;
  const types: DofusDbItemTypeRecord[] = [];
  let skip = 0;
  let total: number;
  do {
    const params = new URLSearchParams({ $limit: String(limit), $skip: String(skip), $sort: 'id' });
    const page = await request(`/item-types?${params.toString()}`, (value): value is DofusDbPage<DofusDbItemTypeRecord> =>
      isPage(value, isItemType), signal);
    types.push(...page.data);
    total = page.total;
    skip += page.data.length;
    if (!page.data.length) break;
  } while (skip < total);
  return types;
}

export async function getDofusDbServers(signal?: AbortSignal): Promise<DofusDbServer[]> {
  const limit = 100;
  const servers: DofusDbServer[] = [];
  let skip = 0;
  let total: number;
  do {
    // No language filter: DofusDB tags some genuinely FR-playable permanent servers (e.g.
    // Rafal, Tal Kasha) with language "en" for reasons that don't reflect who can play there.
    const params = new URLSearchParams({ $limit: String(limit), $skip: String(skip), $sort: 'id' });
    const page = await request(`/servers?${params.toString()}`, (value): value is DofusDbPage<DofusDbServer> =>
      isPage(value, isServer), signal);
    servers.push(...page.data);
    total = page.total;
    skip += page.data.length;
    if (!page.data.length) break;
  } while (skip < total);
  return servers;
}

export async function getDofusDbRecipes(
  itemId: string,
  signal?: AbortSignal,
): Promise<DofusDbRecipe[]> {
  const params = new URLSearchParams({ resultId: itemId, $limit: '10' });
  const page = await request(`/recipes?${params.toString()}`, (value): value is DofusDbPage<DofusDbRecipe> =>
    isPage(value, isRecipe), signal);
  return page.data;
}

export async function getDofusDbItem(itemId: string, signal?: AbortSignal): Promise<DofusDbItem> {
  return request(`/items/${encodeURIComponent(itemId)}`, (value): value is DofusDbItem =>
    isItem(value), signal);
}

export async function getDofusDbItemSet(itemSetId: number, signal?: AbortSignal): Promise<DofusDbItemSet> {
  return request(`/item-sets/${encodeURIComponent(itemSetId)}`, (value): value is DofusDbItemSet =>
    isItemSet(value), signal);
}

export async function getDofusDbEffects(effectIds: number[], signal?: AbortSignal): Promise<import('./dofusdb-types').DofusDbEffect[]> {
  const effects = await Promise.all(effectIds.map((effectId) =>
    request(`/effects?id=${effectId}&$limit=1`, (value): value is DofusDbPage<import('./dofusdb-types').DofusDbEffect> =>
      isPage(value, (effect): effect is import('./dofusdb-types').DofusDbEffect =>
        isRecord(effect) && typeof effect.id === 'number'), signal)));
  return effects.flatMap((page) => page.data);
}
