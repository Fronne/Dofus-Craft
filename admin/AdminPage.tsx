import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerCounter } from '../src/domain/player-counter';
import { adminApi } from './admin-api';
import { CloudflareUsageEditor } from './CloudflareUsageEditor';
import { CounterEditor } from './CounterEditor';
import { Dashboard } from './Dashboard';
import { SECTIONS } from './dashboard-summary';
import { failureMessage } from './messages';
import { NewCounterForm } from './NewCounterForm';
import { MessageEditor } from './MessageEditor';
import { SiteSettingsEditor } from './SiteSettingsEditor';
import { SnifferKeysEditor } from './SnifferKeysEditor';
import { SnifferMappingsEditor } from './SnifferMappingsEditor';
import { useSection } from './useSection';

type Load = { state: 'loading' } | { state: 'ready'; counters: PlayerCounter[] } | { state: 'error'; message: string };

// specs/014-admin-counters (contracts/admin-ui.md): the administration page. specs/068-admin-dashboard: it opens on a
// dashboard of cards, and a card opens its section alone (anchor in the address), so other settings can be added
// later (FR-015): the site's pages (specs/050), the information banner (specs/020), "Compteurs", then the friends' HDV price tool (specs/057).
export function AdminPage() {
  const [email, setEmail] = useState('');
  const section = useSection();
  const title = useRef<HTMLHeadingElement>(null);
  const shown = useRef(section);

  useEffect(() => {
    let cancelled = false;
    void adminApi.me().then((result) => {
      if (!cancelled && result.status === 'ok') setEmail(result.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A change of view (not the first render, even with StrictMode's double effect) moves the focus to the page's
  // title, for keyboards and screen readers.
  useEffect(() => {
    if (shown.current === section) return;
    shown.current = section;
    title.current?.focus();
  }, [section]);

  return (
    <main className="admin-page">
      <header className="page-header admin-header">
        <p className="eyebrow">Dofus Craft</p>
        <h1 ref={title} tabIndex={-1}>Administration</h1>
        {email && <p>Connecté : {email}</p>}
      </header>

      {section === undefined && <Dashboard />}

      {section !== undefined && (
        <>
          <nav className="admin-back">
            <a href="#" className="btn btn-secondary btn-small">← Retour au tableau de bord</a>
            <span className="admin-back-current">{SECTIONS.find((entry) => entry.id === section)?.title}</span>
          </nav>
          {section === 'pages' && <SiteSettingsEditor />}
          {section === 'bandeau' && <MessageEditor />}
          {section === 'compteurs' && <CountersSection />}
          {section === 'cles' && <SnifferKeysEditor />}
          {section === 'correspondances' && <SnifferMappingsEditor />}
          {section === 'cloudflare' && <CloudflareUsageEditor />}
        </>
      )}
    </main>
  );
}

function CountersSection() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    const result = await adminApi.list();
    setLoad(result.status === 'ok' ? { state: 'ready', counters: result.value } : { state: 'error', message: failureMessage(result) });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void adminApi.list().then((result) => {
      if (cancelled) return;
      setLoad(result.status === 'ok' ? { state: 'ready', counters: result.value } : { state: 'error', message: failureMessage(result) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function changed(message: string) {
    setNotice(message);
    void reload();
  }

  return (
    <section className="panel admin-section" aria-labelledby="admin-counters-title">
      <h2 id="admin-counters-title">Compteurs</h2>
      <p className="settings-section-description">
        Les bulles affichées en bas à droite du site. Les changements sont visibles par tous au prochain chargement.
      </p>
      {notice && <p className="admin-message" role="status">{notice}</p>}
      {load.state === 'loading' && <p className="empty" role="status">Chargement…</p>}
      {load.state === 'error' && (
        <div className="inline-retry" role="alert">
          <p className="admin-message admin-message--error">{load.message}</p>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => {
              setLoad({ state: 'loading' });
              void reload();
            }}
          >
            Réessayer
          </button>
        </div>
      )}
      {load.state === 'ready' && load.counters.length === 0 && (
        <p className="empty">Aucun compteur pour l'instant : ajoutez-en un ci-dessous.</p>
      )}
      {load.state === 'ready' && (
        <div className="admin-counters">
          {load.counters.map((counter) => (
            <CounterEditor key={`${counter.id}-${counter.updatedAt}`} counter={counter} onChanged={changed} />
          ))}
        </div>
      )}
      <NewCounterForm onCreated={changed} />
    </section>
  );
}
