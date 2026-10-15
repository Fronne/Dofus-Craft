import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminApi, type AdminResult, type SnifferMappingJson } from './admin-api';
import { failureMessage } from './messages';

// specs/057-sniffer-admin (contracts/admin-sniffer-api.md « Interface »): publish keymap.json +
// schema.json for a game client build after a Dofus update; the history per build lets an older
// mapping be made active again (going back). The server validates and answers with what is saved.

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' });

const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} o` : `${(bytes / 1024).toFixed(1).replace('.', ',')} Ko`);

const mappingFailure = (result: Exclude<AdminResult<unknown>, { status: 'ok' }>) =>
  (result.status === 'not-found' ? "Ce mapping n'existe plus : rechargez la page." : failureMessage(result));

// The history, one group per build, in the order the server lists them.
function byBuild(mappings: SnifferMappingJson[]): [string, SnifferMappingJson[]][] {
  const groups = new Map<string, SnifferMappingJson[]>();
  for (const mapping of mappings) groups.set(mapping.build, [...(groups.get(mapping.build) ?? []), mapping]);
  return [...groups];
}

export function SnifferMappingsEditor() {
  const [mappings, setMappings] = useState<SnifferMappingJson[]>();
  const [build, setBuild] = useState('');
  const [keymap, setKeymap] = useState<File>();
  const [schema, setSchema] = useState<File>();
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();

  const reload = useCallback(async () => {
    const result = await adminApi.listSnifferMappings();
    if (result.status === 'ok') setMappings(result.value);
    else setFeedback({ text: failureMessage(result), error: true });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void adminApi.listSnifferMappings().then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') setMappings(result.value);
      else setFeedback({ text: failureMessage(result), error: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!keymap || !schema) {
      setFeedback({ text: 'Choisissez keymap.json et schema.json.', error: true });
      return;
    }
    setBusy(true);
    const result = await adminApi.uploadSnifferMapping({ build: build.trim(), keymap: await keymap.text(), schema: await schema.text() });
    setBusy(false);
    if (result.status === 'ok') {
      setFeedback({ text: `Mapping n° ${result.value.id} publié : c'est l'actif du build ${result.value.build}.`, error: false });
      setKeymap(undefined);
      setSchema(undefined);
      // Empties the file pickers too.
      setFormKey((count) => count + 1);
      void reload();
    } else {
      setFeedback({ text: mappingFailure(result), error: true });
    }
  }

  async function activate(mapping: SnifferMappingJson) {
    if (!window.confirm(`Revenir au mapping n° ${mapping.id} pour ${mapping.build} ?`)) return;
    setBusy(true);
    const result = await adminApi.activateSnifferMapping(mapping.id);
    setBusy(false);
    if (result.status === 'ok') {
      setFeedback({ text: `Mapping n° ${result.value.id} réactivé pour ${result.value.build}.`, error: false });
      void reload();
    } else {
      setFeedback({ text: mappingFailure(result), error: true });
    }
  }

  return (
    <section className="panel admin-section" aria-labelledby="admin-sniffer-mapping-title">
      <h2 id="admin-sniffer-mapping-title">Mapping</h2>
      <p className="settings-section-description">
        Après une mise à jour de Dofus, publiez le keymap et le schema du nouveau client. Le dernier publié devient l'actif de son build ; l'outil des amis le reçoit à son prochain démarrage.
      </p>

      <form key={formKey} className="admin-sniffer-form" onSubmit={(event) => void publish(event)}>
        <label>
          Build du client
          <input value={build} placeholder="3.7.10.10" onChange={(event) => setBuild(event.target.value)} required />
        </label>
        <label>
          keymap.json
          <input type="file" accept=".json,application/json" onChange={(event) => setKeymap(event.target.files?.[0])} required />
        </label>
        <label>
          schema.json
          <input type="file" accept=".json,application/json" onChange={(event) => setSchema(event.target.files?.[0])} required />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>Publier</button>
      </form>

      {feedback && (
        <p className={`admin-message${feedback.error ? ' admin-message--error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>
      )}
      {mappings === undefined && !feedback && <p className="empty" role="status">Chargement…</p>}
      {mappings?.length === 0 && <p className="empty">Aucun mapping publié pour l'instant.</p>}
      {mappings && byBuild(mappings).map(([group, items]) => (
        <div key={group} className="admin-sniffer-build">
          <h3>Build {group}</h3>
          <ul className="admin-sniffer-list">
            {items.map((mapping) => (
              <li key={mapping.id} className="admin-sniffer-row">
                <div>
                  <p className="admin-counter-player">
                    N° {mapping.id}
                    {mapping.active && <span className="admin-sniffer-active"> actif</span>}
                  </p>
                  <p className="admin-counter-meta">
                    Publié le {dateFormatter.format(new Date(mapping.uploadedAt))} · keymap {formatSize(mapping.keymapBytes)} · schema {formatSize(mapping.schemaBytes)}
                  </p>
                </div>
                {!mapping.active && (
                  <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => void activate(mapping)}>
                    Réactiver
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
