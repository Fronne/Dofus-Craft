/* global URL, URLSearchParams, fetch, setTimeout, console */
// specs/071-sniffer-tous-hdv (plan.md R1): builds worker/src/item-types.json, the nature of each DofusDB
// item type — the `category` the friends' tool sends with an HDV price. Run by hand, review the summary,
// commit the JSON. Nothing is written if DofusDB fails.
import { writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../worker/src/item-types.json', import.meta.url);
const API = 'https://api.dofusdb.fr';
const PAGE = 50;
const RUNE_TYPE_ID = 78;
// DofusDB superTypeId -> nature. Any other super-type (quests, mutations, blessings, followers,
// certificates…) is not sold as such at the HDV and stays out: its prices are refused.
const NATURE_BY_SUPER_TYPE = {
  1: 'equipment', // Amulette
  2: 'equipment', // Arme
  3: 'equipment', // Anneau
  4: 'equipment', // Ceinture
  5: 'equipment', // Bottes
  6: 'consumable', // Consommable
  7: 'equipment', // Bouclier
  9: 'resource', // Ressource (runes apart, below)
  10: 'equipment', // Chapeau
  11: 'equipment', // Cape
  12: 'equipment', // Familier, montilier, montures
  13: 'equipment', // Dofus, trophée, prysmaradite
  16: 'consumable', // Nourriture
  22: 'equipment', // Cosmétiques (objets d'apparat)
  23: 'equipment', // Compagnon
  25: 'equipment', // Costume
  69: 'equipment', // Équipement de percepteur
  70: 'consumable', // Consommables de combat (pierres d'âme, filets)
};

async function get(path, params) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${API}/${path}?${new URLSearchParams(params)}`);
    if (response.ok) return response.json();
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error(`DofusDB injoignable : ${path}`);
}

const types = [];
for (let skip = 0; ; skip += PAGE) {
  const page = await get('item-types', [['$limit', String(PAGE)], ['$skip', String(skip)]]);
  types.push(...page.data);
  if (skip + PAGE >= page.total) break;
}

const natures = {};
const leftOut = [];
for (const type of types.sort((a, b) => a.id - b.id)) {
  const nature = type.id === RUNE_TYPE_ID ? 'rune' : NATURE_BY_SUPER_TYPE[type.superTypeId];
  if (nature) natures[String(type.id)] = nature;
  else leftOut.push(`${type.id} ${type.name.fr} (super-type ${type.superTypeId})`);
}

const counts = Object.values(natures).reduce((all, nature) => ({ ...all, [nature]: (all[nature] ?? 0) + 1 }), {});
await writeFile(OUTPUT, `${JSON.stringify({ source: `${API}/item-types`, retrievedAt: new Date().toISOString().slice(0, 10), natures })}\n`);
console.log(`${types.length} types, gardés :`, counts);
console.log(`${leftOut.length} écartés :`, leftOut.join(' ; '));
