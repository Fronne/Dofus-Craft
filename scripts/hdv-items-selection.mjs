// specs/023-hdv-price-entry (research.md §1-§3, contracts/hdv-type-map.md): the rule deciding which
// items each HDV tab lists, kept pure so it can be tested on its own (constitution II). An item is
// listed when it is exchangeable, not of an excluded type, and either useful to the app (a recipe
// ingredient or a pet food of the XP table) or of a type whose every exchangeable item is listed
// (pet food, FR-004b). Its HDV comes only from the hand-written type map: a type missing from it is
// never guessed — the whole selection fails and names it.

export class MissingHdvTypesError extends Error {
  constructor(typeIds) {
    super(`Types absents de scripts/data/hdv-type-map.json : ${typeIds.join(', ')}`);
    this.typeIds = typeIds;
  }
}

export function selectHdvItems({ typeMap, usefulIds, candidates }) {
  const excluded = new Set(typeMap.excludedTypes);
  const listAll = new Set(typeMap.listAllExchangeable);
  const seen = new Set();
  const missing = new Set();
  const items = [];
  const skipped = { outOfScope: 0, excluded: 0, notExchangeable: 0 };
  for (const candidate of candidates) {
    const id = String(candidate.id);
    if (seen.has(id)) continue;
    seen.add(id);
    if (!usefulIds.has(id) && !listAll.has(candidate.typeId)) continue;
    if (excluded.has(candidate.typeId)) { skipped.excluded += 1; continue; }
    if (!candidate.exchangeable) { skipped.notExchangeable += 1; continue; }
    const key = String(candidate.typeId);
    if (!(key in typeMap.types)) { missing.add(candidate.typeId); continue; }
    const hdv = typeMap.types[key];
    if (hdv === null) { skipped.outOfScope += 1; continue; }
    items.push({
      id,
      name: candidate.name,
      ...(candidate.imageUrl ? { imageUrl: candidate.imageUrl } : {}),
      typeId: candidate.typeId,
      hdv,
    });
  }
  if (missing.size > 0) throw new MissingHdvTypesError([...missing].sort((a, b) => a - b));
  const order = ['resources', 'consumables', 'animals'];
  items.sort((a, b) => order.indexOf(a.hdv) - order.indexOf(b.hdv) || a.name.localeCompare(b.name, 'fr'));
  return { items, skipped };
}
