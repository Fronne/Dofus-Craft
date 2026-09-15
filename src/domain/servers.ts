export type Server = { id: string; name: string };

export const servers: Server[] = [
  { id: 'dakal', name: 'Dakal' },
  { id: 'draconiros', name: 'Draconiros' },
  { id: 'mikhal', name: 'Mikhal' },
  { id: 'salar', name: 'Salar' },
  { id: 'tal-kasha', name: 'Tal Kasha' },
  { id: 'brumaire', name: 'Brumaire' },
];

export function listServers(): Server[] {
  return servers;
}

export function isKnownServerId(serverId: string): boolean {
  return servers.some((server) => server.id === serverId);
}
