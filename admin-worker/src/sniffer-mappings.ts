// specs/057-sniffer-admin (contracts/admin-sniffer-api.md « Mappings »): the keymap.json + schema.json
// the friends' tool decodes HDV packets with, per game client build, in the sniffer_mappings table of
// specs/056. The active mapping of a build is the one GET /sniffer/config serves (worker/src/sniffer.ts);
// older ones stay as history, to go back to. Reachable only through the Access-protected API.
type Statement = {
  bind(...values: unknown[]): Statement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export type SnifferMappingsDb = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> };

export type SnifferMappingJson = {
  id: number;
  build: string;
  uploadedAt: string;
  active: boolean;
  keymapBytes: number;
  schemaBytes: number;
};

export type MappingUpload = { build: string; keymap: string; schema: string };
export type MappingValidation =
  | { ok: true; value: MappingUpload }
  | { ok: false; error: string; field: 'build' | 'keymap' | 'schema' };

// The form of the client's `version` file the tool reads (Version=3.7.10.10).
const BUILD_PATTERN = /^\d+\.\d+\.\d+(\.\d+)?$/;
const MAX_BUILD_LENGTH = 32;
// The current documents are about 1 KB and 6 KB (research R3).
export const MAX_DOCUMENT_BYTES = 256 * 1024;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

function parseDocument(text: unknown, name: string): Parsed {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: `${name} manquant.` };
  if (new TextEncoder().encode(text).length > MAX_DOCUMENT_BYTES) return { ok: false, error: `${name} dépasse 256 Ko.` };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: `${name} n'est pas du JSON valide.` };
  }
  if (!isObject(value)) return { ok: false, error: `${name} doit être un objet JSON.` };
  return { ok: true, value };
}

// The definitions price_list needs, followed through each field's `of` from one to the next: the first
// missing one, or undefined when all resolve. Names beginning with _ are notes, never definitions.
function missingDefinition(schema: Record<string, unknown>): string | undefined {
  const seen = new Set(['price_list']);
  const queue = ['price_list'];
  while (queue.length > 0) {
    const fields = (schema[queue.shift()!] as Record<string, unknown>).fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      const of = isObject(field) ? field.of : undefined;
      if (typeof of !== 'string' || seen.has(of)) continue;
      if (of.startsWith('_') || !isObject(schema[of])) return of;
      seen.add(of);
      queue.push(of);
    }
  }
  return undefined;
}

// data-model.md « Validation d'un dépôt »: the first error answers, naming the document.
export function validateMappingUpload(body: unknown): MappingValidation {
  const input = isObject(body) ? body : {};
  const { build } = input;
  if (typeof build !== 'string' || build.length > MAX_BUILD_LENGTH || !BUILD_PATTERN.test(build)) {
    return { ok: false, error: 'Build attendu sous la forme 3.7.10.10.', field: 'build' };
  }
  const keymap = parseDocument(input.keymap, 'keymap.json');
  if (!keymap.ok) return { ok: false, error: keymap.error, field: 'keymap' };
  const schema = parseDocument(input.schema, 'schema.json');
  if (!schema.ok) return { ok: false, error: schema.error, field: 'schema' };
  const entry = keymap.value.price_list;
  if (typeof entry !== 'string' || !entry.trim()) {
    return { ok: false, error: "keymap.json n'a pas d'entrée price_list.", field: 'keymap' };
  }
  if (!isObject(schema.value.price_list)) {
    return { ok: false, error: "schema.json n'a pas de définition price_list.", field: 'schema' };
  }
  const missing = missingDefinition(schema.value);
  if (missing !== undefined) {
    return { ok: false, error: `schema.json : la définition « ${missing} » citée par price_list est absente.`, field: 'schema' };
  }
  // The texts as uploaded: the config route serves exactly their content (research R4).
  return { ok: true, value: { build, keymap: input.keymap as string, schema: input.schema as string } };
}

type MappingRow = { id: number; build: string; uploaded_at: string; active: number; keymap_bytes: number; schema_bytes: number };

const SELECT_MAPPINGS = `SELECT id, build, uploaded_at, active,
  LENGTH(CAST(keymap_json AS BLOB)) AS keymap_bytes, LENGTH(CAST(schema_json AS BLOB)) AS schema_bytes FROM sniffer_mappings`;

const mappingFromRow = (row: MappingRow): SnifferMappingJson => ({
  id: Number(row.id),
  build: row.build,
  uploadedAt: row.uploaded_at,
  active: Number(row.active) === 1,
  keymapBytes: Number(row.keymap_bytes),
  schemaBytes: Number(row.schema_bytes),
});

// Grouped by build, the build uploaded to most recently first, then newest first within a build.
export async function listMappings(db: SnifferMappingsDb): Promise<SnifferMappingJson[]> {
  const { results } = await db.prepare(
    `${SELECT_MAPPINGS} m ORDER BY (SELECT MAX(id) FROM sniffer_mappings n WHERE n.build = m.build) DESC, id DESC`,
  ).all<MappingRow>();
  return results.map(mappingFromRow);
}

async function readActive(db: SnifferMappingsDb, build: string): Promise<SnifferMappingJson | null> {
  const row = await db.prepare(`${SELECT_MAPPINGS} WHERE build = ? AND active = 1`).bind(build).first<MappingRow>();
  return row ? mappingFromRow(row) : null;
}

// One batch (one transaction): the build's active mapping is turned off before the new one is written
// active, so the unique index on (build) WHERE active = 1 never sees two. Answers with the build's active
// mapping read back: the one really saved (two concurrent uploads: the last one wins).
export async function uploadMapping(db: SnifferMappingsDb, upload: MappingUpload, now: Date = new Date()): Promise<SnifferMappingJson> {
  await db.batch([
    db.prepare('UPDATE sniffer_mappings SET active = 0 WHERE build = ? AND active = 1').bind(upload.build),
    db.prepare('INSERT INTO sniffer_mappings (build, keymap_json, schema_json, uploaded_at, active) VALUES (?, ?, ?, ?, 1)')
      .bind(upload.build, upload.keymap, upload.schema, now.toISOString()),
  ]);
  return (await readActive(db, upload.build))!;
}

// Going back: an older mapping becomes the active one of its build, the current one is turned off, in
// one batch. Already active: nothing changes. Unknown id: null.
export async function activateMapping(db: SnifferMappingsDb, id: number): Promise<SnifferMappingJson | null> {
  const target = await db.prepare('SELECT build FROM sniffer_mappings WHERE id = ?').bind(id).first<{ build: string }>();
  if (!target) return null;
  await db.batch([
    db.prepare('UPDATE sniffer_mappings SET active = 0 WHERE build = ? AND active = 1 AND id <> ?').bind(target.build, id),
    db.prepare('UPDATE sniffer_mappings SET active = 1 WHERE id = ?').bind(id),
  ]);
  return readActive(db, target.build);
}
