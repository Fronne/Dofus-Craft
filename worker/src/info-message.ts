import { isInfoMessageActive, type InfoMessage, type InfoTone } from '../../src/domain/info-message';

// specs/020-info-banner (contracts/info-message-api.md): the public read of the information message.
// Writes only happen in the Access-protected dofus-craft-admin Worker, which shares this row format.

export type InfoMessageRow = { text: string; tone: InfoTone; ends_at: string | null; updated_at: string };

// Typed structurally so the module also compiles in the app's test setup (no Workers types there).
type ReadDb = { prepare(sql: string): { first<T>(): Promise<T | null> } };

export const SELECT_INFO_MESSAGE = "SELECT text, tone, ends_at, updated_at FROM info_message WHERE id = 'current'";

export function infoMessageFromRow(row: InfoMessageRow): InfoMessage {
  return { text: row.text, tone: row.tone, endsAt: row.ends_at, version: row.updated_at };
}

export async function readInfoMessage(db: ReadDb): Promise<InfoMessage | null> {
  const row = await db.prepare(SELECT_INFO_MESSAGE).first<InfoMessageRow>();
  return row ? infoMessageFromRow(row) : null;
}

// GET /info-message: the message while it's active, `null` otherwise (none, or past its end date).
export async function infoMessageResponse(db: ReadDb, now: Date = new Date()): Promise<{ status: number; body: InfoMessage | null }> {
  const message = await readInfoMessage(db);
  return { status: 200, body: message && isInfoMessageActive(message, now) ? message : null };
}
