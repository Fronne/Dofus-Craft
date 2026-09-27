/* global URL, URLSearchParams, fetch, setTimeout, console */
// specs/022-pet-xp-calculator (research.md §1-§3, contracts/pet-xp-data.md): builds
// src/data/pet-xp-data.json from the two committed source files of scripts/data/:
// - pet-xp-resources.csv: the « XP COMPLET » tab of the player's EXCEL FAMILIER workbook (data from
//   https://dafous.app/pet-xp), one line per resource with the XP one unit gives;
// - pet-xp-curve.json: the cumulative XP per level (0 to 100) from the game client.
// Each resource is matched to its DofusDB item by exact name (case-insensitive, oe/œ tolerant).
// Anything not matched with certainty is listed in `unmatched`, never guessed. Run by hand, review
// the summary, commit the JSON.
import { readFile, writeFile } from 'node:fs/promises';

const RESOURCES = new URL('./data/pet-xp-resources.csv', import.meta.url);
const CURVE = new URL('./data/pet-xp-curve.json', import.meta.url);
const OUTPUT = new URL('../src/data/pet-xp-data.json', import.meta.url);
const CONCURRENCY = 8;

// Minimal CSV reader: comma-separated, fields optionally double-quoted with "" escapes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findItems(name) {
  const params = new URLSearchParams([
    ['name.fr[$regex]', `^${escapeRegex(name)}$`],
    ['name.fr[$options]', 'i'],
    ['$select[]', 'id'], ['$select[]', 'name'], ['$select[]', 'iconId'],
    ['$limit', '5'],
  ]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.dofusdb.fr/items?${params}`);
    if (response.ok) return (await response.json()).data;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error(`DofusDB injoignable pour « ${name} »`);
}

async function match(name) {
  const variants = [...new Set([name, name.replace(/oe/g, 'œ').replace(/Oe/g, 'Œ'), name.replace(/œ/g, 'oe').replace(/Œ/g, 'Oe')])];
  const found = new Map();
  for (const variant of variants) for (const item of await findItems(variant)) found.set(item.id, item);
  if (found.size === 0) return { reason: 'not-found' };
  if (found.size > 1) return { reason: 'ambiguous' };
  const [item] = found.values();
  return { item };
}

async function mapLimited(items, task) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

const curve = JSON.parse(await readFile(CURVE, 'utf-8'));
const cumulativeXpByLevel = curve.cumulativeXpByLevel;
if (cumulativeXpByLevel.length !== 101 || cumulativeXpByLevel[0] !== 0 || cumulativeXpByLevel.some((value, index) =>
  !Number.isInteger(value) || (index > 0 && value <= cumulativeXpByLevel[index - 1]))) {
  throw new Error('Courbe d’XP inattendue (101 niveaux croissants attendus, de 0 à 100)');
}

const [header, ...lines] = parseCsv(await readFile(RESOURCES, 'utf-8')).filter((row) => row.some(Boolean));
if (header.join(',') !== 'name,xpPerUnit') throw new Error('En-tête CSV inattendu');

const unmatched = [];
const rowsByName = new Map();
for (const [rawName, xpText] of lines) {
  const sourceName = rawName.trim();
  const xpPerUnit = Number(xpText);
  if (!Number.isFinite(xpPerUnit) || xpPerUnit <= 0) { unmatched.push({ sourceName, reason: 'zero-xp' }); continue; }
  const rows = rowsByName.get(sourceName) ?? [];
  rows.push({ sourceName, xpPerUnit });
  rowsByName.set(sourceName, rows);
}

const candidates = [];
for (const [sourceName, rows] of rowsByName) {
  if (rows.every((row) => row.xpPerUnit === rows[0].xpPerUnit)) candidates.push(rows[0]);
  else unmatched.push({ sourceName, reason: 'conflicting-duplicate' });
}

const matches = await mapLimited(candidates, (candidate) => match(candidate.sourceName));
const foods = [];
candidates.forEach((candidate, index) => {
  const { item, reason } = matches[index];
  if (!item) { unmatched.push({ sourceName: candidate.sourceName, reason }); return; }
  const itemId = String(item.id);
  // Two source names landing on the same item (e.g. « Coeur » and « Cœur »): keep one if identical.
  const kept = foods.find((food) => food.itemId === itemId);
  if (kept) {
    if (kept.xpPerUnit !== candidate.xpPerUnit) {
      foods.splice(foods.indexOf(kept), 1);
      unmatched.push({ sourceName: kept.sourceName, reason: 'conflicting-duplicate' }, { sourceName: candidate.sourceName, reason: 'conflicting-duplicate' });
    }
    return;
  }
  const imageUrl = typeof item.iconId === 'number' ? `https://api.dofusdb.fr/img/items/${item.iconId}.png` : undefined;
  foods.push({ itemId, name: item.name.fr, ...(imageUrl ? { imageUrl } : {}), xpPerUnit: candidate.xpPerUnit, sourceName: candidate.sourceName });
});

foods.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
unmatched.sort((a, b) => a.sourceName.localeCompare(b.sourceName, 'fr'));

const data = {
  source: 'Dafous — Calculateur Pet XP',
  sourceUrl: 'https://dafous.app/pet-xp',
  curveSource: curve.source,
  retrievedAt: new Date().toISOString().slice(0, 10),
  cumulativeXpByLevel,
  foods,
  unmatched,
};
await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`);

const byReason = unmatched.reduce((counts, entry) => ({ ...counts, [entry.reason]: (counts[entry.reason] ?? 0) + 1 }), {});
console.log(`Niveaux : 0 à ${cumulativeXpByLevel.length - 1} (niveau 100 = ${cumulativeXpByLevel.at(-1)} XP)`);
console.log(`Ressources rattachées : ${foods.length} / ${lines.length}`);
console.log('Écartées :', byReason);
