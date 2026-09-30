/* global URL, URLSearchParams, fetch, setTimeout, console */
// specs/025-rune-purchase-import (research R5-R6, contracts/rune-items-data.md): builds
// src/data/rune-items.json, the runes the Forgemagie page lists with the stat each one modifies, and
// worker/src/fm/priceable-items.json, the index the Worker uses to recognize a purchase line's item by
// its exact name (the runes plus the resources of src/data/hdv-items.json — never an equipment). Run by
// hand, review the summary, commit both JSON files. Nothing is written if DofusDB fails.
import { readFile, writeFile } from 'node:fs/promises';

const HDV_ITEMS = new URL('../src/data/hdv-items.json', import.meta.url);
const RUNES_OUTPUT = new URL('../src/data/rune-items.json', import.meta.url);
const INDEX_OUTPUT = new URL('../worker/src/fm/priceable-items.json', import.meta.url);
const API = 'https://api.dofusdb.fr';
const PAGE = 50;
const RUNE_TYPE_ID = 78;
const OTHER_STAT = 'Autre';

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

// Same rule as normalizeItemName in src/domain/forgemagie.ts and worker/src/fm/item-names.ts: lower
// case, whitespace runs collapsed, trimmed — accents kept, so a misread name never matches by accident.
function normalizeItemName(name) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

const byId = (field) => (ids) => ids.map((id) => [`${field}[$in][]`, String(id)]);

const runeRecords = await getAll('items', [
  ['typeId', String(RUNE_TYPE_ID)],
  ...['id', 'name', 'iconId', 'level', 'possibleEffects'].map((field) => ['$select[]', field]),
]);

const effectIds = [...new Set(runeRecords.map((rune) => rune.possibleEffects?.[0]?.effectId).filter((id) => typeof id === 'number'))];
const effects = await getAll('effects', [['$select[]', 'id'], ['$select[]', 'characteristic'], ['$select[]', 'description'], ...byId('id')(effectIds)]);
const descriptionByEffect = new Map(effects
  .filter((effect) => typeof effect.description?.fr === 'string')
  .map((effect) => [effect.id, effect.description.fr]));
const characteristicByEffect = new Map(effects
  .filter((effect) => typeof effect.characteristic === 'number' && effect.characteristic >= 0)
  .map((effect) => [effect.id, effect.characteristic]));

const characteristicIds = [...new Set(characteristicByEffect.values())];
const characteristics = await getAll('characteristics', [['$select[]', 'id'], ['$select[]', 'name'], ...byId('id')(characteristicIds)]);
const statLabelById = new Map(characteristics.map((characteristic) => [characteristic.id, characteristic.name.fr]));

// The stat label comes from the effect's in-game description ("#1{{~1~2 à }}#2 Dommage{{~ps}}{{~zs}} Air"
// → "Dommages Air", "#1{{~1~2 à }}#2% Résistance Air" → "Résistance Air (%)"): DofusDB's characteristic
// names alone can't tell "Rune Do Air" (damage) from "Rune Ré Air" (resistance) — both are "Air…".
// The characteristic name is only the fallback when an effect has no description.
function statLabelFromDescription(description) {
  const text = description
    .replace(/#1\{\{~1~2 à \}\}#2/g, '')
    .replace(/\{\{~ps\}\}\{\{~zs\}\}/g, 's')
    .replace(/\{\{[^}]*\}\}/g, '')
    .trim();
  if (!text) return undefined;
  return text.startsWith('%') ? `${text.slice(1).trim()} (%)` : text;
}

const runes = runeRecords.map((rune) => {
  const effectId = rune.possibleEffects?.[0]?.effectId ?? null;
  const characteristicId = effectId === null ? null : characteristicByEffect.get(effectId) ?? null;
  return {
    id: String(rune.id),
    name: rune.name.fr,
    imageUrl: `${API}/img/items/${rune.iconId}.png`,
    level: rune.level,
    effectId,
    characteristicId,
    statLabel: (effectId !== null && descriptionByEffect.has(effectId) ? statLabelFromDescription(descriptionByEffect.get(effectId)) : undefined)
      ?? (characteristicId === null ? undefined : statLabelById.get(characteristicId))
      ?? OTHER_STAT,
  };
}).sort((a, b) => a.statLabel.localeCompare(b.statLabel, 'fr') || a.level - b.level || a.name.localeCompare(b.name, 'fr'));

// Name index: a name shared by two different items maps to null (priceStatus "ambiguous-item").
const hdv = JSON.parse(await readFile(HDV_ITEMS, 'utf-8'));
const index = new Map();
for (const item of [...hdv.items, ...runes]) {
  const key = normalizeItemName(item.name);
  if (!index.has(key)) index.set(key, item.id);
  else if (index.get(key) !== item.id) index.set(key, null);
}
const sortedIndex = Object.fromEntries([...index.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr')));

const retrievedAt = new Date().toISOString().slice(0, 10);
await writeFile(RUNES_OUTPUT, `${JSON.stringify({
  source: 'DofusDB (objets du type 78 « Rune de forgemagie », effets, caractéristiques)',
  sourceUrl: API,
  retrievedAt,
  runes,
}, null, 2)}\n`);
await writeFile(INDEX_OUTPUT, `${JSON.stringify({ generatedAt: retrievedAt, items: sortedIndex })}\n`);

const ambiguous = Object.entries(sortedIndex).filter(([, id]) => id === null).map(([name]) => name);
console.log(`Runes : ${runes.length} ; stats : ${new Set(runes.map((rune) => rune.statLabel)).size}`);
console.log(`Runes sans stat reconnue : ${runes.filter((rune) => rune.statLabel === OTHER_STAT).map((rune) => rune.name).join(', ') || 'aucune'}`);
console.log(`Noms indexés : ${Object.keys(sortedIndex).length} ; ambigus : ${ambiguous.length ? ambiguous.join(', ') : 'aucun'}`);
