import type { ServerId } from '../domain/types';

const STORAGE_KEY = 'craftcheck-active-server';

export function getActiveServerId(): ServerId | undefined {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
  return stored ?? undefined;
}

export function setActiveServerId(serverId: ServerId): void {
  window.localStorage.setItem(STORAGE_KEY, serverId);
}
