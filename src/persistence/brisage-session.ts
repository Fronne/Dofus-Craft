// specs/061-simplification-page-brisage: what the player was doing on the Brisage page (the item picked,
// the rolls and the coefficient typed, the typed cost), kept on the device so a reload brings it back.
const STORAGE_KEY = 'craftcheck-brisage-session';

export type BrisageSession = {
  serverId: string;
  item: { id: string; name: string; level?: number; imageUrl?: string };
  /** Typed rolls by line position, as typed. */
  rolls: Record<number, string>;
  coefficientText: string;
  manualCost: string;
  /** specs/062: where the price of the item comes from. A session saved before that has none: HDV. */
  priceSource: PriceSource;
};

/** 'auto' = no button chosen yet: the cheaper of the HDV price and the craft cost is kept. 'custom' = the price typed by the player. */
export type PriceSource = 'hdv' | 'craft' | 'custom' | 'auto';

/** Reads a stored value back; anything of the wrong type makes the whole session unusable. */
function mergeSession(value: unknown): BrisageSession | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const item = raw.item as Record<string, unknown> | null;
  if (typeof raw.serverId !== 'string' || typeof item !== 'object' || item === null) return undefined;
  if (typeof item.id !== 'string' || typeof item.name !== 'string') return undefined;
  const rolls: Record<number, string> = {};
  if (typeof raw.rolls === 'object' && raw.rolls !== null) {
    for (const [index, text] of Object.entries(raw.rolls)) {
      if (typeof text === 'string' && Number.isInteger(Number(index))) rolls[Number(index)] = text;
    }
  }
  return {
    serverId: raw.serverId,
    item: {
      id: item.id,
      name: item.name,
      level: typeof item.level === 'number' ? item.level : undefined,
      imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
    },
    rolls,
    coefficientText: typeof raw.coefficientText === 'string' ? raw.coefficientText : '',
    manualCost: typeof raw.manualCost === 'string' ? raw.manualCost : '',
    priceSource: raw.priceSource === 'craft' || raw.priceSource === 'auto' || raw.priceSource === 'custom' ? raw.priceSource : 'hdv',
  };
}

export function getBrisageSession(): BrisageSession | undefined {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? undefined : mergeSession(JSON.parse(stored));
  } catch {
    return undefined;
  }
}

/** `undefined` forgets the session (no item picked). */
export function setBrisageSession(session: BrisageSession | undefined): void {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing or blocked storage: the page just isn't remembered.
  }
}
