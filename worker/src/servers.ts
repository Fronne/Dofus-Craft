// The site's server identifiers and Huzounet's (specs/045-restore-production-worker). specs/056: shared
// by the reading of Huzounet's prices and the friends' price tool (GET /sniffer/config,
// POST /community-price/batch) — the manual price form still accepts any server id.
export const HUZOUNET_SERVER_IDS: Record<string, number> = {
  brial: 351,
  dakal: 353,
  draconiros: 295,
  'hell-mina': 294,
  imagiro: 291,
  kourial: 355,
  mikhal: 354,
  ombre: 50,
  orukam: 292,
  rafal: 350,
  salar: 352,
  'tal-kasha': 290,
  tylezia: 293,
};

export const SERVERS: string[] = Object.keys(HUZOUNET_SERVER_IDS).sort();

export function isKnownServer(serverId: string): boolean {
  return Object.prototype.hasOwnProperty.call(HUZOUNET_SERVER_IDS, serverId);
}
