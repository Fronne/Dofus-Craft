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

// specs/046-hdv-huzounet-load: 'external' is a price the API read on Huzounet, not one shared by the group.
export type PriceOrigin = 'manual' | 'capture' | 'bot' | 'external';

export function isPriceOrigin(value: unknown): value is PriceOrigin {
  return value === 'manual' || value === 'capture' || value === 'bot' || value === 'external';
}

// --- Forgemagie API shapes (contracts/fm-site-api.md) ---

/** A player as another member sees them: a private player has no name, avatar or id (FR-015). */
export type FmPlayer = { discordUserId: string | null; displayName: string | null; avatarUrl: string | null; private: boolean };

export type FmSessionStatus = 'open' | 'closed';

/** specs/028 FR-011: for a session started on the site, whether the bot opened it in Discord. */
export type FmSessionSync = { status: 'pending' | 'opened' | 'failed' | 'cancelled' | 'stale'; error: string | null };

/** specs/029: a channel the site asked the bot to create. */
export type FmChannelRequest = { id: string; status: 'pending' | 'done' | 'failed'; error?: string | null; channelId?: string | null; sessionId?: string | null };

/** What was bought of one item. specs/049: `corrected` once a line of it was corrected, `readNames` the names it was misread under. */
export type FmItemSummary = {
  itemName: string;
  itemId: string | null;
  quantity: number;
  totalKamas: number;
  averageUnitKamas: number;
  corrected?: boolean;
  readNames?: string[];
};

// --- Séances de FM (specs/049-fm-seances, contracts/fm-seances-client.md) ---

/** A séance de FM is a player's private Discord channel: running while a session is open in it. */
export type FmSeanceState = 'running' | 'paused' | 'archived';

export const SEANCE_STATE_LABELS: Record<FmSeanceState, string> = {
  running: 'En cours',
  paused: 'En pause',
  archived: 'Archivée',
};

/** The item forgemaged in a séance: `name` is the player's own name for it, or the equipment's. */
export type FmSeanceItem = { id: string; name: string; itemName: string; label: string | null; imageUrl: string | null };

export type FmSeance = {
  id: string;
  name: string;
  state: FmSeanceState;
  /** The state of the Discord channel itself, as the API tells it. */
  discord: string;
  fmItem: FmSeanceItem | null;
  totalKamas: number;
  sessionCount: number;
  captureCount: number;
  createdAt: string;
  lastActivityAt: string;
};

/** One purchase line of a capture, as it counts now and as it was read. */
export type FmCaptureLine = {
  id: string;
  itemName: string;
  quantity: number;
  totalKamas: number;
  unitPriceKamas: number;
  originalQuantity: number;
  originalTotalKamas: number;
  corrected: boolean;
  priceStatus: string;
};

/** A line of a capture that is not a rune: listed, never counted in the séance. */
export type FmIgnoredLine = { itemName: string; quantity: number; totalKamas: number };

export type FmSeanceCapture = {
  id: string;
  createdAt: string;
  /** `bot`: posted in Discord and read by the bot; `capture`: imported on the site. */
  origin: 'bot' | 'capture';
  spentKamas: number;
  items: FmItemSummary[];
  corrected: boolean;
  lines: FmCaptureLine[];
  ignored: FmIgnoredLine[];
};

export type FmSeanceSession = {
  id: string;
  status: FmSessionStatus;
  openedAt: string;
  closedAt?: string | null;
  totalKamas: number;
  sync?: FmSessionSync | null;
  canStop: boolean;
  captures: FmSeanceCapture[];
};

/** An archiving or a reopening of the channel the bot has not done yet, or failed to do. */
export type FmSeanceRequest = { type: 'archive' | 'reopen'; status: 'pending' | 'failed' | 'stale'; error?: string | null };

export type FmSeanceDetail = FmSeance & {
  /** How many items were bought, every purchase of the séance together. */
  quantity: number;
  items: FmItemSummary[];
  sessions: FmSeanceSession[];
  request: FmSeanceRequest | null;
  canResume: boolean;
  canArchive: boolean;
  canReopen: boolean;
};

/** A séance as the other members of the group see it: no session, no capture, no rune. */
export type FmGroupSeance = {
  name: string;
  state: FmSeanceState;
  fmItem: { name: string; imageUrl: string | null } | null;
  totalKamas: number;
  sessionCount: number;
  lastActivityAt: string;
};

/** A player of the group and what forgemagie cost them; `private` only ever true on the viewer's own line. */
export type FmGroupPlayer = {
  displayName: string;
  avatarUrl: string | null;
  isMe: boolean;
  private: boolean;
  totalKamas: number;
  seanceCount: number;
  lastActivityAt: string | null;
  seances: FmGroupSeance[];
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

export function fmItemDisplayName(item: { label: string | null; itemName: string }): string {
  return item.label ?? item.itemName;
}

/** What a séance is attached to — one of the player's items, or a new one for an equipment. */
export type FmAttachTarget =
  | { fmItemId: string }
  | { item: { itemId: string; itemName: string; imageUrl: string | null } };

const foldForSearch = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** specs/031 FR-009: an item in FM whose name or equipment contains the query, ignoring case and accents. */
export function matchesItemQuery(item: { label: string | null; itemName: string }, query: string): boolean {
  const folded = foldForSearch(query);
  if (folded === '') return false;
  return [item.label ?? '', item.itemName].some((name) => foldForSearch(name).includes(folded));
}

export type FmMe = {
  discordUserId: string;
  displayName: string;
  avatarUrl: string | null;
  serverId: string | null;
  isPrivate: boolean;
  firstLoginAt: string | null;
  /** specs/049: the name of the group's Discord server, read at login. */
  guildName?: string | null;
};

/** specs/049: the name of the players' tab — the group's Discord server, when it is known. */
export function groupTabLabel(me: Pick<FmMe, 'guildName'>): string {
  return me.guildName?.trim() || 'Joueurs';
}

/** specs/049: only runes count in a séance; what the chat names « Rune … » is one. */
export function isRuneName(name: string): boolean {
  return normalizeItemName(name).startsWith('rune ');
}

/** specs/049: the lines of a capture that do not count, one per item — bought twice, listed once. */
export function mergeIgnoredLines(lines: FmIgnoredLine[]): FmIgnoredLine[] {
  const byName = new Map<string, FmIgnoredLine>();
  for (const line of lines) {
    const known = byName.get(line.itemName);
    byName.set(line.itemName, known
      ? { ...known, quantity: known.quantity + line.quantity, totalKamas: known.totalKamas + line.totalKamas }
      : { ...line });
  }
  return [...byName.values()];
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

/** One session of a profile's spending; `channelId` is its séance (absent from an older API). */
export type FmProfileSession = { sessionId: string; channelId?: string | null; channelName: string; openedAt: string; spentKamas: number; canOpen: boolean };

export type FmSeanceSpending = { key: string; seanceId: string | undefined; name: string; lastOpenedAt: string; spentKamas: number };

/**
 * specs/049: a profile's spending, one line per séance — its sessions added up, dated by the latest,
 * the most recent séance first. `seanceId` only when the séance can be opened by the viewer.
 */
export function spendingBySeance(sessions: FmProfileSession[]): FmSeanceSpending[] {
  const bySeance = new Map<string, FmSeanceSpending>();
  for (const session of sessions) {
    const key = session.channelId ?? session.sessionId;
    const known = bySeance.get(key);
    bySeance.set(key, {
      key,
      seanceId: session.canOpen ? session.channelId ?? undefined : known?.seanceId,
      name: known?.name ?? session.channelName,
      lastOpenedAt: known && known.lastOpenedAt > session.openedAt ? known.lastOpenedAt : session.openedAt,
      spentKamas: (known?.spentKamas ?? 0) + session.spentKamas,
    });
  }
  return [...bySeance.values()].sort((a, b) => (a.lastOpenedAt < b.lastOpenedAt ? 1 : -1));
}

export type FmProfile = {
  player: FmPlayer;
  totalKamas: number;
  // specs/030-private-fm-sessions (research R5): a session the player posted in but doesn't own won't open.
  sessions: FmProfileSession[];
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
