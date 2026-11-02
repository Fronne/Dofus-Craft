// specs/046-hdv-huzounet-load: 'external' is a price the API read on Huzounet, not one shared by the group.
// specs/056-sniffer-batch-prices: 'sniffer' is a price a friend's HDV sniffer sent in a batch.
export type PriceOrigin = 'manual' | 'capture' | 'bot' | 'external' | 'sniffer';

export function isPriceOrigin(value: unknown): value is PriceOrigin {
  return value === 'manual' || value === 'capture' || value === 'bot' || value === 'external' || value === 'sniffer';
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

/** What a séance is attached to — one of the player's items, or a new one for an equipment. */
export type FmAttachTarget =
  | { fmItemId: string }
  | { item: { itemId: string; itemName: string; imageUrl: string | null } };

export type FmMe = {
  discordUserId: string;
  displayName: string;
  avatarUrl: string | null;
  serverId: string | null;
  isPrivate: boolean;
  firstLoginAt: string | null;
  /** specs/049: the name of the group's Discord server, read at login. */
  guildName?: string | null;
  /** specs/075: member of the group's Discord server when this session was opened — the Forgemagie needs it. */
  isMember: boolean;
};

/** specs/082-auteur-prix-communautaires: the prices a player entered — how many are kept, and the latest ones. */
export type FmContributions = {
  total: number;
  recent: { resourceId: string; kind: 'resource' | 'item'; serverId: string; amountKamas: number; createdAt: string }[];
};

/** One session of a profile's spending; `channelId` is its séance (absent from an older API). */
export type FmProfileSession = { sessionId: string; channelId?: string | null; channelName: string; openedAt: string; spentKamas: number; canOpen: boolean };

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
