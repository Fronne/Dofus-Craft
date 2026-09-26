import type { InfoMessage, InfoMessageInput } from '../../src/domain/info-message';
import { infoMessageFromRow, readInfoMessage } from '../../worker/src/info-message';

// specs/020-info-banner: writes on the info_message table (one row, id 'current'), reachable only
// through the Access-protected API (src/index.ts). Input is validated before it gets here.
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export type MessageDb = { prepare(sql: string): Statement };

export function getMessage(db: MessageDb): Promise<InfoMessage | null> {
  return readInfoMessage(db);
}

// Publishing replaces the message; a new `updated_at` is its new version, so a banner a player had
// closed shows again (FR-005).
export async function saveMessage(db: MessageDb, value: InfoMessageInput, now: Date = new Date()): Promise<InfoMessage> {
  const updatedAt = now.toISOString();
  await db.prepare(
    `INSERT INTO info_message (id, text, tone, ends_at, updated_at) VALUES ('current', ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET text = excluded.text, tone = excluded.tone, ends_at = excluded.ends_at, updated_at = excluded.updated_at`,
  ).bind(value.text, value.tone, value.endsAt, updatedAt).run();
  return infoMessageFromRow({ text: value.text, tone: value.tone, ends_at: value.endsAt, updated_at: updatedAt });
}

export async function deleteMessage(db: MessageDb): Promise<void> {
  await db.prepare("DELETE FROM info_message WHERE id = 'current'").run();
}
