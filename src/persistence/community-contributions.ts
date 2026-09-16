export type LocalContributionRecord = {
  id: string;
  resourceId: string;
  serverId: string;
};

const STORAGE_KEY = 'craftcheck-community-contributions';

function isLocalContributionRecord(value: unknown): value is LocalContributionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<LocalContributionRecord>;
  return typeof record.id === 'string' &&
    typeof record.resourceId === 'string' &&
    typeof record.serverId === 'string';
}

export function listLocalContributions(): LocalContributionRecord[] {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isLocalContributionRecord) : [];
  } catch {
    return [];
  }
}

function saveLocalContributions(records: LocalContributionRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage unavailable — the local contribution record just won't survive a reload.
  }
}

export function addLocalContribution(record: LocalContributionRecord): void {
  saveLocalContributions([...listLocalContributions(), record]);
}

export function clearLocalContributions(): void {
  saveLocalContributions([]);
}
