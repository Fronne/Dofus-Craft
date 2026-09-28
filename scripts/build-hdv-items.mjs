/* global URL, URLSearchParams, fetch, setTimeout, console */
// specs/023-hdv-price-entry (research.md §1-§3, contracts/hdv-items-data.md): builds
// src/data/hdv-items.json, the items each HDV tab of the price-entry page lists. Useful items are
// every recipe ingredient (DofusDB /recipes) plus the pet foods of src/data/pet-xp-data.json; pet
// food types listed in `listAllExchangeable` add all their exchangeable items. The HDV of each type
// comes only from the hand-written scripts/data/hdv-type-map.json (checked in game). Run by hand,
// review the summary, commit the JSON.
import { readFile, writeFile } from 'node:fs/promises';
import { selectHdvItems } from './hdv-items-selection.mjs';

const TYPE_MAP = new URL('./data/hdv-type-map.json', import.meta.url);
const PET_XP = new URL('../src/data/pet-xp-data.json', import.meta.url);
const OUTPUT = new URL('../src/data/hdv-items.json', import.meta.url);
const API = 'https://api.dofusdb.fr';
const PAGE = 50;

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

const ITEM_FIELDS = ['id', 'name', 'iconId', 'typeId', 'exchangeable'].map((field) => ['$select[]', field]);

function toCandidate(item) {
  return {
    id: String(item.id),
    name: item.name.fr,
    ...(typeof item.iconId === 'number' ? { imageUrl: `${API}/img/items/${item.iconId}.png` } : {}),
    typeId: item.typeId,
    exchangeable: item.exchangeable === true,
  };
}

const typeMap = JSON.parse(await readFile(TYPE_MAP, 'utf-8'));
const petXp = JSON.parse(await readFile(PET_XP, 'utf-8'));

const recipes = await getAll('recipes', [['$select[]', 'ingredientIds']]);
const usefulIds = new Set([
  ...recipes.flatMap((recipe) => recipe.ingredientIds.map(String)),
  ...petXp.foods.map((food) => food.itemId),
]);

const candidates = [];
const ids = [...usefulIds];
for (let index = 0; index < ids.length; index += PAGE) {
  const page = await get('items', [...ITEM_FIELDS, ['$limit', String(PAGE)], ...ids.slice(index, index + PAGE).map((id) => ['id[$in][]', id])]);
  candidates.push(...page.data.map(toCandidate));
}
for (const typeId of typeMap.listAllExchangeable) {
  const items = await getAll('items', [...ITEM_FIELDS, ['typeId', String(typeId)], ['exchangeable', 'true']]);
  candidates.push(...items.map(toCandidate));
}

const { items, skipped } = selectHdvItems({ typeMap, usefulIds, candidates });

const typeIds = [...new Set(items.map((item) => item.typeId))];
const typeRecords = await getAll('item-types', [['$select[]', 'id'], ['$select[]', 'name'], ...typeIds.map((id) => ['id[$in][]', String(id)])]);
const types = Object.fromEntries(typeRecords.sort((a, b) => a.id - b.id).map((type) => [String(type.id), type.name.fr]));

const data = {
  source: 'DofusDB (recettes, objets) + tableau d’XP familier + correspondance relevée en jeu',
  sourceUrl: API,
  typeMapCheckedAt: typeMap.checkedAt,
  retrievedAt: new Date().toISOString().slice(0, 10),
  types,
  items,
  skipped,
};
await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`);

const byHdv = items.reduce((counts, item) => ({ ...counts, [item.hdv]: (counts[item.hdv] ?? 0) + 1 }), {});
console.log(`Recettes lues : ${recipes.length} ; objets utiles : ${usefulIds.size}`);
console.log('Objets par HDV :', byHdv);
console.log('Écartés :', skipped);
