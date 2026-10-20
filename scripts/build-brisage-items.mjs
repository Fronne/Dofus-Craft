/* global URL, URLSearchParams, fetch, setTimeout, console */
// specs/064-recherche-objets-par-stats (T002): builds src/data/brisage-items.json, the index the "Par stats"
// search of the Brisage page reads: every equipment with its level, image and rolls on the stats the site
// can break into runes. Run by hand (`node scripts/build-brisage-items.mjs`), review the summary, commit the
// JSON. Nothing is written if DofusDB fails. Refresh it when DofusDB's catalogue changes (about every two weeks).
import { writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../src/data/brisage-items.json', import.meta.url);
const API = 'https://api.dofusdb.fr';
const PAGE = 50;
// Same equipment rule as isEquipment in src/services/dofusdb-mappers.ts: these super types, and only the
// Trophées / Prysmaradites among super type 13. No `hasRecipe` filter: an item without a recipe breaks too.
const EQUIPMENT_SUPER_TYPE_IDS = new Set([1, 2, 3, 4, 5, 7, 10, 11, 13]);
const TROPHY_TYPE_IDS = new Set([151, 217]);
// The stats the site knows a rune for: effect ids of BRISAGE_STATS in src/domain/brisage.ts, read from the file
// so the index never drifts from it.
const HUNT_EFFECT_IDS = [696969, 795];
const TYPE_BATCH = 10;

async function get(path, params) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${API}/${path}?${new URLSearchParams(params)}`);
    if (response.ok) return response.json();
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error(`DofusDB injoignable : ${path}`);
}

async function getAll(path, params) {
  const all = [];
  for (let skip = 0; ; skip += PAGE) {
    const page = await get(path, [...params, ['$limit', String(PAGE)], ['$skip', String(skip)]]);
    all.push(...page.data);
    if (skip + PAGE >= page.total) return all;
  }
}

// Same rule as effectRangesOf in src/data/catalogue-repository.ts (keep both in step): a positive roll,
// not an exo (category 2); DofusDB writes a fixed effect as `to: 0`.
function effectRanges(effects) {
  const ranges = [];
  for (const effect of effects ?? []) {
    if (typeof effect.effectId !== 'number' || typeof effect.from !== 'number' || typeof effect.to !== 'number') continue;
    if (effect.category === 2) continue;
    if (!(Math.max(effect.from, effect.to) > 0 && effect.from >= 0 && effect.to >= 0)) continue;
    ranges.push(effect.to === 0
      ? { effectId: effect.effectId, from: effect.from, to: effect.from }
      : { effectId: effect.effectId, from: Math.min(effect.from, effect.to), to: Math.max(effect.from, effect.to) });
  }
  return ranges;
}

const { readFile } = await import('node:fs/promises');
const brisageSource = await readFile(new URL('../src/domain/brisage.ts', import.meta.url), 'utf-8');
const statBlock = brisageSource.slice(brisageSource.indexOf('export const BRISAGE_STATS'), brisageSource.indexOf('export type BrisageSettings'));
const statEffectIds = new Set([...statBlock.matchAll(/stat\((\d+),/g)].map((match) => Number(match[1])));
for (const id of HUNT_EFFECT_IDS) statEffectIds.delete(id);
if (statEffectIds.size < 10) throw new Error('BRISAGE_STATS illisible : le script doit suivre src/domain/brisage.ts.');

const types = await getAll('item-types', [['$select[]', 'id'], ['$select[]', 'superTypeId'], ['$select[]', 'categoryId']]);
const typeIds = types
  .filter((type) => (type.superTypeId === 13 ? TROPHY_TYPE_IDS.has(type.id) : type.categoryId === 0 && EQUIPMENT_SUPER_TYPE_IDS.has(type.superTypeId)))
  .map((type) => type.id);

const records = [];
for (let index = 0; index < typeIds.length; index += TYPE_BATCH) {
  const batch = typeIds.slice(index, index + TYPE_BATCH);
  records.push(...await getAll('items', [
    ...batch.map((id) => ['typeId[$in][]', String(id)]),
    ...['id', 'name', 'level', 'iconId', 'effects', 'typeId'].map((field) => ['$select[]', field]),
  ]));
}

const items = [];
for (const record of records) {
  const name = record.name?.fr?.trim();
  if (!name || typeof record.level !== 'number') continue;
  const effects = effectRanges(record.effects).filter((range) => statEffectIds.has(range.effectId));
  if (effects.length === 0) continue;
  items.push({
    id: String(record.id),
    name,
    level: record.level,
    ...(record.iconId ? { imageUrl: `${API}/img/items/${record.iconId}.png` } : {}),
    effects,
  });
}
items.sort((a, b) => a.name.localeCompare(b.name, 'fr') || Number(a.id) - Number(b.id));
const unique = new Map(items.map((item) => [item.id, item]));
if (unique.size < 100) throw new Error(`Index suspect : ${unique.size} objets seulement, rien n'est écrit.`);

const json = JSON.stringify({
  source: 'DofusDB (équipements et leurs effets)',
  sourceUrl: API,
  retrievedAt: new Date().toISOString().slice(0, 10),
  items: [...unique.values()],
});
await writeFile(OUTPUT, json);
console.log(`${unique.size} équipements (${records.length} lus sur ${typeIds.length} types), ${(json.length / 1024 / 1024).toFixed(2)} Mo`);
