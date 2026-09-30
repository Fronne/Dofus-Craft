import { CORS_HEADERS } from '../cors';

// specs/025-rune-purchase-import: what the Forgemagie routes share — their database and environment
// types, JSON answers, hashing, the site session and the player upsert.

// The D1 calls these modules need, typed structurally (like retention.ts) so they also compile in the
// app's test setup, which doesn't load the Workers types. D1Database is assignable to it.
export type FmStatement = {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};
export type FmDb = {
  prepare(sql: string): FmStatement & { bind(...values: unknown[]): FmStatement };
  batch(statements: FmStatement[]): Promise<unknown>;
};

export type FmEnv = {
  DB: FmDb;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_GUILD_ID?: string;
  FM_BOT_API_KEY?: string;
  SITE_URL?: string;
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

export const unauthorized = () => json({ error: 'Unauthorized' }, 401);

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const nowIso = () => new Date().toISOString();

export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() || undefined : undefined;
}

// research R3: the site sends its session token as a bearer token; only its SHA-256 is stored.
export async function requireSession(request: Request, db: FmDb): Promise<string | undefined> {
  const token = bearerToken(request);
  if (!token) return undefined;
  const row = await db.prepare(
    'SELECT discord_user_id FROM fm_auth_sessions WHERE token_hash = ? AND expires_at > ?',
  ).bind(await sha256Hex(token), nowIso()).first<{ discord_user_id: string }>();
  return row?.discord_user_id;
}

export type PlayerIdentity = { discordUserId: string; displayName: string; avatarUrl: string | null };

// Creates the player (public, no server yet — FR-006) or refreshes their name and avatar; never
// touches their server or visibility.
export function upsertPlayerStatement(db: FmDb, player: PlayerIdentity, at: string = nowIso()): FmStatement {
  return db.prepare(
    `INSERT INTO fm_players (discord_user_id, display_name, avatar_url, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (discord_user_id) DO UPDATE SET display_name = excluded.display_name, avatar_url = excluded.avatar_url`,
  ).bind(player.discordUserId, player.displayName, player.avatarUrl, at);
}
