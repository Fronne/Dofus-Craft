/* global URL, URLSearchParams, fetch, setTimeout, console, process */
// specs/072-snapshot-catalogue-statique: builds public/catalogue-snapshot/{meta,items,item-sets}.json,
// the DofusDB catalogue (equipment with a recipe + item sets) served with the site instead of being
// crawled page by page at launch. Run by `prebuild`, so every deployment ships a fresh snapshot.
// Nothing is written (and a previous valid snapshot is kept) when DofusDB fails or looks truncated.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const API = 'https://api.dofusdb.fr';
const OUTPUT_DIR = new URL('../public/catalogue-snapshot/', import.meta.url);
const ITEM_PAGE = 100;
const SET_PAGE = 50;
// A snapshot smaller than this share of the previous one is refused (truncated crawl).
const MIN_SHARE_OF_PREVIOUS = 0.5;

// Only the DofusDB fields read by src/services/dofusdb-mappers.ts and src/data/catalogue-repository.ts
// (types in src/services/dofusdb-types.ts) are kept: the rest is dead weight on the wire.
const pickFr = (text) => (text && typeof text === 'object' && text.fr !== undefined ? { fr: text.fr } : undefined);
const clean = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

function projectSuperType(superType) {
  if (!superType) return undefined;
  return clean({ id: superType.id, positions: superType.positions, name: pickFr(superType.name) });
}

function projectType(type) {
  if (!type) return undefined;
  return clean({
    id: type.id,
    superTypeId: type.superTypeId,
    categoryId: type.categoryId,
    name: pickFr(type.name),
    superType: projectSuperType(type.superType),
  });
}

function projectEffect(effect) {
  return clean({
    from: effect.from,
    to: effect.to,
    characteristic: effect.characteristic,
    category: effect.category,
    elementId: effect.elementId,
    effectId: effect.effectId,
  });
}

export function projectItem(item) {
  return clean({
    id: item.id,
    level: item.level,
    name: pickFr(item.name),
    img: item.img,
    type: projectType(item.type),
    hasRecipe: item.hasRecipe,
    itemSetId: item.itemSetId,
    effects: Array.isArray(item.effects) ? item.effects.map(projectEffect) : undefined,
  });
}

export function projectItemSet(itemSet) {
  return clean({
    id: itemSet.id,
    name: pickFr(itemSet.name),
    items: Array.isArray(itemSet.items) ? itemSet.items.map(projectItem) : undefined,
  });
}

async function getJson(fetchImpl, path, params) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(`${API}/${path}?${new URLSearchParams(params)}`);
      if (response.ok) return await response.json();
    } catch {
      // retried below
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`DofusDB injoignable : ${path}`);
}

async function crawl(fetchImpl, path, baseParams, pageSize) {
  const rows = [];
  let total;
  let skip = 0;
  do {
    const page = await getJson(fetchImpl, path, { ...baseParams, $limit: String(pageSize), $skip: String(skip) });
    if (typeof page.total !== 'number' || !Array.isArray(page.data)) throw new Error(`Réponse inattendue : ${path}`);
    total = page.total;
    rows.push(...page.data);
    skip += page.data.length;
    if (!page.data.length) break;
  } while (skip < total);
  return { rows, total };
}

async function readPreviousMeta(outDir) {
  try {
    return JSON.parse(await readFile(new URL('meta.json', outDir), 'utf8'));
  } catch {
    return undefined;
  }
}

async function writeAtomic(outDir, name, content) {
  const target = new URL(name, outDir);
  const temporary = new URL(`${name}.tmp`, outDir);
  await writeFile(temporary, content);
  await rename(temporary, target);
}

export async function buildCatalogueSnapshot({ fetchImpl = fetch, outDir = OUTPUT_DIR, log = console.log } = {}) {
  // Same selection and order as getDofusDbItems('') / getDofusDbItemSets('') in the app.
  const itemCrawl = await crawl(fetchImpl, 'items', { hasRecipe: 'true', $sort: 'name.fr' }, ITEM_PAGE);
  const setCrawl = await crawl(fetchImpl, 'item-sets', { $sort: 'id' }, SET_PAGE);
  const items = itemCrawl.rows.map(projectItem);
  const itemSets = setCrawl.rows.map(projectItemSet);

  if (!items.length || !itemSets.length) throw new Error('Catalogue vide : snapshot refusé.');
  if (new Set(items.map((item) => item.id)).size !== items.length
    || new Set(itemSets.map((itemSet) => itemSet.id)).size !== itemSets.length) {
    throw new Error('Catalogue incohérent : identifiants en double (pagination instable).');
  }
  if (items.length !== itemCrawl.total || itemSets.length !== setCrawl.total) {
    throw new Error(`Catalogue incomplet : ${items.length}/${itemCrawl.total} objets, ${itemSets.length}/${setCrawl.total} panoplies.`);
  }
  const previous = await readPreviousMeta(outDir);
  if (previous?.totals
    && (items.length < previous.totals.items * MIN_SHARE_OF_PREVIOUS
      || itemSets.length < previous.totals.itemSets * MIN_SHARE_OF_PREVIOUS)) {
    throw new Error('Catalogue très inférieur au snapshot précédent : snapshot refusé.');
  }

  const meta = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'DofusDB',
    totals: { items: items.length, itemSets: itemSets.length },
  };
  await mkdir(outDir, { recursive: true });
  await writeAtomic(outDir, 'items.json', JSON.stringify(items));
  await writeAtomic(outDir, 'item-sets.json', JSON.stringify(itemSets));
  // Written last: a reader that sees the new meta finds the matching files.
  await writeAtomic(outDir, 'meta.json', JSON.stringify(meta));
  log(`Snapshot du catalogue : ${items.length} objets, ${itemSets.length} panoplies.`);
  return meta;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  buildCatalogueSnapshot().catch((error) => {
    console.error(`Échec du snapshot du catalogue : ${error.message}`);
    process.exit(1);
  });
}
