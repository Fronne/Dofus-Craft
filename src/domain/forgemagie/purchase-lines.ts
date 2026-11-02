// specs/025-rune-purchase-import: the Forgemagie page's rules. Everything here is pure so it can be
// tested on its own (constitution, principe II). The Worker keeps its own copy of normalizeItemName
// (worker/src/fm/item-names.ts): the two projects share no code.

/** A purchase line from the game chat: `10 x [Rune Do Air] (15 868 kamas)`. `totalKamas` is the lot's total. */
export type PurchaseLine = { itemName: string; quantity: number; totalKamas: number };

// Exactly the bot's LINE_PATTERN (Botomoux main.py), so the site and Discord read the same lines.
export const PURCHASE_LINE_PATTERN = /(\d[\d\s]{0,6})\s*x\s*\[([^\]]{2,40})\]\s*\(?\s*(\d[\d\s]{2,12})\s*kamas\)?/gi;

function parseChatNumber(raw: string): number | undefined {
  const digits = raw.replace(/[\s\u202f\u00a0]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : undefined;
}

/**
 * Every purchase line of a chat text, in order (FR-022). Identical lines stay separate: four
 * `10 x [Rune Do Air] (15 868 kamas)` are four lots bought, as the bot counts them. A line whose
 * quantity or total is zero or unreadable is left out.
 */
export function parsePurchaseLines(text: string): PurchaseLine[] {
  const lines: PurchaseLine[] = [];
  for (const match of text.matchAll(PURCHASE_LINE_PATTERN)) {
    const quantity = parseChatNumber(match[1]);
    const totalKamas = parseChatNumber(match[3]);
    if (!quantity || !totalKamas) continue;
    lines.push({ itemName: match[2].trim().replace(/\s+/g, ' '), quantity, totalKamas });
  }
  return lines;
}

/** The unit price of a lot, rounded to the nearest kama: 15 868 / 10 → 1 587 (FR-022). */
export function unitPriceKamas(line: { quantity: number; totalKamas: number }): number {
  return Math.round(line.totalKamas / line.quantity);
}

/** Lower case, whitespace runs collapsed, trimmed. Accents are kept: a misread name never matches by accident. */
export function normalizeItemName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

export type ItemSummary = { itemName: string; quantity: number; totalKamas: number; averageUnitKamas: number };

/** Per-item totals for display only (like the bot's embeds), largest total first. */
export function summarizeByItem(lines: PurchaseLine[]): ItemSummary[] {
  const byName = new Map<string, { itemName: string; quantity: number; totalKamas: number }>();
  for (const line of lines) {
    const current = byName.get(line.itemName) ?? { itemName: line.itemName, quantity: 0, totalKamas: 0 };
    current.quantity += line.quantity;
    current.totalKamas += line.totalKamas;
    byName.set(line.itemName, current);
  }
  return [...byName.values()]
    .map((item) => ({ ...item, averageUnitKamas: unitPriceKamas(item) }))
    .sort((a, b) => b.totalKamas - a.totalKamas);
}

/** specs/049: the quantity and total typed in a correction — whole numbers of at least 1, or nothing. */
export function correctionValues(quantity: string, total: string): { quantity: number; totalKamas: number } | undefined {
  const parse = (raw: string) => {
    const digits = raw.replace(/[\s\u202f\u00a0]/g, '');
    return /^\d+$/.test(digits) ? Number(digits) : undefined;
  };
  const parsedQuantity = parse(quantity);
  const parsedTotal = parse(total);
  return parsedQuantity !== undefined && parsedQuantity > 0 && parsedTotal !== undefined && parsedTotal > 0
    ? { quantity: parsedQuantity, totalKamas: parsedTotal }
    : undefined;
}
