import { isKnownServerId } from '../domain/servers';
import type { ServerId } from '../domain/types';

const STORAGE_KEY = 'craftcheck-active-server';

export function getActiveServerId(): ServerId | undefined {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (!stored || !isKnownServerId(stored)) return undefined;
  return stored;
}

export function setActiveServerId(serverId: ServerId): void {
  if (!isKnownServerId(serverId)) throw new Error('Serveur inconnu');
  window.localStorage.setItem(STORAGE_KEY, serverId);
}
