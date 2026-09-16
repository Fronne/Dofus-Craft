type ServerType = 'mono' | 'multi';

export type Server = { id: string; name: string; type: ServerType };

export const SERVER_TYPE_LABELS: Record<ServerType, string> = {
  mono: 'Mono-compte',
  multi: 'Multi-compte',
};

export const SERVER_TYPE_ORDER: ServerType[] = ['mono', 'multi'];

export function groupServersByType(servers: Server[]): { type: ServerType; servers: Server[] }[] {
  return SERVER_TYPE_ORDER
    .map((type) => ({ type, servers: servers.filter((server) => server.type === type) }))
    .filter((group) => group.servers.length > 0);
}
