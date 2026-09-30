import { normalizeSearchText } from '../services/dofusdb-api';

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

export type PriceOrigin = 'manual' | 'capture' | 'bot';

export const PRICE_ORIGIN_LABELS: Record<PriceOrigin, string> = {
  manual: 'Saisie manuelle',
  capture: 'Capture',
  bot: 'Bot Discord',
};

export function isPriceOrigin(value: unknown): value is PriceOrigin {
  return value === 'manual' || value === 'capture' || value === 'bot';
}

// --- Forgemagie API shapes (contracts/fm-site-api.md) ---

/** A player as another member sees them: a private player has no name, avatar or id (FR-015). */
export type FmPlayer = { discordUserId: string | null; displayName: string | null; avatarUrl: string | null; private: boolean };

export type FmSessionStatus = 'open' | 'closed';

/** specs/027: the item a session is attached to, or `{ private: true }` for a private owner's item. */
export type FmSessionItem = { id: string; name: string; owner: FmPlayer } | { private: true };

export type FmSession = {
  id: string;
  channelName: string;
  status: FmSessionStatus;
  openedAt: string;
  closedAt: string | null;
  totalKamas: number;
  players: { player: FmPlayer; spentKamas: number }[];
  fmItem: FmSessionItem | null;
  /** specs/028: who started it (site) or typed /fmstart; null for older sessions. */
  owner: FmPlayer | null;
  origin: 'discord' | 'site';
  /** specs/028 FR-011: for a session started on the site, whether the bot opened it in Discord. */
  sync: FmSessionSync | null;
  canStop: boolean;
};

export type FmSessionSync = { status: 'pending' | 'opened' | 'failed' | 'cancelled' | 'stale'; error: string | null };

/** specs/028 FR-003: a Discord channel the bot has used; `busy` when a session is open in it. */
export type FmChannel = { channelId: string; channelName: string; busy: boolean };

export type FmItemSummary = { itemName: string; itemId: string | null; quantity: number; totalKamas: number; averageUnitKamas: number };

export type FmSessionDetail = FmSession & {
  items: FmItemSummary[];
  /** specs/027 FR-005: not attached yet, and the viewer spent in it. */
  canAttach: boolean;
  /** specs/027 FR-007: attached to one of the viewer's items. */
  canDetach: boolean;
};

/** specs/027: an item a player forgemages ("objet en FM"), with the total of its attached sessions. */
export type FmOwnedItem = {
  id: string;
  itemId: string;
  itemName: string;
  imageUrl: string | null;
  label: string | null;
  owner: FmPlayer;
  totalKamas: number;
  sessionCount: number;
};

/** specs/027 FR-009 to FR-012: an item's recap — no share per player. */
export type FmItemRecap = FmOwnedItem & {
  sessions: { id: string; channelName: string; status: FmSessionStatus; openedAt: string; totalKamas: number }[];
  items: FmItemSummary[];
};

export function fmItemDisplayName(item: { label: string | null; itemName: string }): string {
  return item.label ?? item.itemName;
}

export type FmSessionsPage = { sessions: FmSession[]; nextBefore: string | null };

export type FmMe = {
  discordUserId: string;
  displayName: string;
  avatarUrl: string | null;
  serverId: string | null;
  isPrivate: boolean;
  firstLoginAt: string | null;
};

export type FmPlayerSpend = FmPlayer & { totalKamas: number };

export type FmProfile = {
  player: FmPlayer;
  totalKamas: number;
  sessions: { sessionId: string; channelName: string; openedAt: string; spentKamas: number }[];
  importedKamas: number;
  items: FmItemSummary[];
  /** specs/027 FR-014. */
  fmItems: FmOwnedItem[];
};

/** Why a purchase line created a price, or not (contracts/fm-bot-api.md). */
export type PriceStatus = 'recorded' | 'unknown-item' | 'ambiguous-item' | 'no-server' | 'outlier' | 'personal-mode' | 'invalid';

// --- Runes (src/data/rune-items.json, contracts/rune-items-data.md) ---

export type RuneItem = {
  id: string;
  name: string;
  imageUrl: string;
  level: number;
  effectId: number | null;
  characteristicId: number | null;
  statLabel: string;
};

export type RuneItemsData = { source: string; sourceUrl: string; retrievedAt: string; runes: RuneItem[] };

/** The stats runes can be filtered by, in alphabetical order (FR-017). */
export function runeStatLabels(runes: RuneItem[]): string[] {
  return [...new Set(runes.map((rune) => rune.statLabel))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** specs/026: the Runes tab of the HDV page — name without accents or case, exact stat; order kept. */
export function filterRunes(runes: RuneItem[], { query, stat }: { query: string; stat: string }): RuneItem[] {
  const needle = normalizeSearchText(query);
  return runes.filter((rune) => (!stat || rune.statLabel === stat) && (!needle || normalizeSearchText(rune.name).includes(needle)));
}

const sessionDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
});

/** « 30 sept. 2026, 18:02 », in the game's time zone. */
export function formatFmDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : sessionDateFormatter.format(date);
}

/** Reads `#session=…` or `#error=…`, left in the address by the Worker after the Discord login. */
export function parseLoginFragment(hash: string): { token?: string; error?: 'not-member' | 'login-failed' } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('session');
  if (token && /^[0-9a-f]{64}$/.test(token)) return { token };
  const error = params.get('error');
  if (error === 'not-member') return { error };
  if (error) return { error: 'login-failed' };
  return {};
}

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
