import { normalizeItemName, parsePurchaseLines, type PurchaseLine } from './purchase-lines';

// --- Capture import (US5) ---

/** A resource the site can price: a rune, or a resource of src/data/hdv-items.json (never an equipment). */
export type PriceableResource = { id: string; name: string };

/** Normalized name → resource, or null when two resources share the name (same rule as the Worker's index). */
export type ResourceNameIndex = Map<string, PriceableResource | null>;

export function buildResourceNameIndex(resources: PriceableResource[]): ResourceNameIndex {
  const index: ResourceNameIndex = new Map();
  for (const resource of resources) {
    const key = normalizeItemName(resource.name);
    const current = index.get(key);
    if (current === undefined) index.set(key, resource);
    else if (current !== null && current.id !== resource.id) index.set(key, null);
  }
  return index;
}

/** A purchase line read from a capture, with the resource its exact name designates, if any (FR-024). */
export type ProposedLine = PurchaseLine & { resource: PriceableResource | null };

export function proposeLines(text: string, index: ResourceNameIndex): ProposedLine[] {
  return parsePurchaseLines(text).map((line) => ({ ...line, resource: index.get(normalizeItemName(line.itemName)) ?? null }));
}
