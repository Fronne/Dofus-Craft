/* global URL, URLSearchParams, fetch, setTimeout, console */
// specs/022-pet-xp-calculator (research.md §1-§3, contracts/pet-xp-data.md): builds
// src/data/pet-xp-data.json from the Dofus Tool pet XP tables, matching each resource to its DofusDB
// item by exact name (case-insensitive, oe/œ tolerant). Anything not matched with certainty is listed
// in `unmatched`, never guessed. Run by hand, review the summary, commit the JSON.
import { writeFile } from 'node:fs/promises';

const SOURCE_URL = 'https://www.dofustool.com/tableau-xp-familier-dofus/';
const OUTPUT = new URL('../src/data/pet-xp-data.json', import.meta.url);
const CONCURRENCY = 8;

const decode = (text) => text
  .replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&rsquo;/g, '’')
  .replace(/&#039;|&apos;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

function tables(html) {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/g)].map(([table]) =>
    [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map(([row]) =>
      [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, cell]) => decode(cell))));
}

const parseNumber = (text) => {
  const value = Number(text.replace(/\s/g, '').replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : undefined;
};

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

const response = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!response.ok) throw new Error(`Source indisponible (${response.status})`);
const [levelTable, foodTable] = tables(await response.text());

const cumulativeXpByLevel = levelTable.slice(1).map((row) => parseNumber(row[1]));
if (cumulativeXpByLevel.length !== 100 || cumulativeXpByLevel.some((value, index) =>
  value === undefined || (index > 0 && value <= cumulativeXpByLevel[index - 1]))) {
  throw new Error('Tableau d’XP par niveau inattendu');
}

const unmatched = [];
const rowsByName = new Map();
for (const [sourceName, xpText, quantityText] of foodTable.slice(1)) {
  if (!sourceName) continue;
  const xpGiven = parseNumber(xpText ?? '');
  const quantityNeeded = parseNumber(quantityText ?? '');
  if (xpGiven === undefined || xpGiven <= 0) { unmatched.push({ sourceName, reason: 'zero-xp' }); continue; }
  if (quantityNeeded === undefined || quantityNeeded <= 0 || !Number.isInteger(quantityNeeded)) {
    unmatched.push({ sourceName, reason: 'invalid-quantity' });
    continue;
  }
  const rows = rowsByName.get(sourceName) ?? [];
  rows.push({ sourceName, xpGiven, quantityNeeded });
  rowsByName.set(sourceName, rows);
}

const candidates = [];
for (const [sourceName, rows] of rowsByName) {
  const same = rows.every((row) => row.xpGiven === rows[0].xpGiven && row.quantityNeeded === rows[0].quantityNeeded);
  if (same) candidates.push(rows[0]);
  else unmatched.push({ sourceName, reason: 'conflicting-duplicate' });
}

const matches = await mapLimited(candidates, (candidate) => match(candidate.sourceName));
const foods = [];
const seenIds = new Set();
candidates.forEach((candidate, index) => {
  const { item, reason } = matches[index];
  if (!item) { unmatched.push({ sourceName: candidate.sourceName, reason }); return; }
  const itemId = String(item.id);
  // Two source names landing on the same item (e.g. « Coeur » and « Cœur »): keep only one if identical.
  if (seenIds.has(itemId)) {
    const kept = foods.find((food) => food.itemId === itemId);
    if (kept.xpGiven !== candidate.xpGiven || kept.quantityNeeded !== candidate.quantityNeeded) {
      foods.splice(foods.indexOf(kept), 1);
      unmatched.push({ sourceName: kept.sourceName, reason: 'conflicting-duplicate' }, { sourceName: candidate.sourceName, reason: 'conflicting-duplicate' });
    }
    return;
  }
  seenIds.add(itemId);
  const imageUrl = typeof item.iconId === 'number' ? `https://api.dofusdb.fr/img/items/${item.iconId}.png` : undefined;
  foods.push({ itemId, name: item.name.fr, ...(imageUrl ? { imageUrl } : {}), xpGiven: candidate.xpGiven, quantityNeeded: candidate.quantityNeeded, sourceName: candidate.sourceName });
});

foods.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
unmatched.sort((a, b) => a.sourceName.localeCompare(b.sourceName, 'fr'));

const data = {
  source: 'Dofus Tool — Tableau d’XP familier',
  sourceUrl: SOURCE_URL,
  retrievedAt: new Date().toISOString().slice(0, 10),
  cumulativeXpByLevel,
  foods,
  unmatched,
};
await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`);

const byReason = unmatched.reduce((counts, entry) => ({ ...counts, [entry.reason]: (counts[entry.reason] ?? 0) + 1 }), {});
console.log(`Niveaux : ${cumulativeXpByLevel.length} (niveau 100 = ${cumulativeXpByLevel[99]} XP)`);
console.log(`Ressources rattachées : ${foods.length}`);
console.log('Écartées :', byReason);
