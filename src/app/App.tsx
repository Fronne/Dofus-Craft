import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ServerOnboarding } from '../features/server/ServerOnboarding';
import { ServerProvider, useActiveServer } from './ServerContext';
import { preloadCatalogueIndexes } from '../data/catalogue-repository';
import { EmptyState } from '../components/EmptyState';
import { ErrorBoundary } from '../components/ErrorBoundary';

function AppContent() {
  const { hasSelectedServer, loadingServers, serversError, servers, retryServers } = useActiveServer();

  if (loadingServers) {
    return (
      <main className="server-onboarding" aria-busy="true">
        <p className="sync-status" role="status">
          <span className="loading-spinner" aria-hidden="true" />
          Chargement des serveurs…
        </p>
      </main>
    );
  }

  // Without a server list there is nothing to choose from: say so, with a way to ask again. A player
  // who already has a server goes on to the site, which works from what the device has kept.
  if (serversError && servers.length === 0 && !hasSelectedServer) {
    return (
      <main className="server-onboarding">
        <div className="server-onboarding-card" role="alert">
          <EmptyState icon="server" title="Liste des serveurs indisponible" description="DofusDB, qui fournit la liste des serveurs, ne répond pas pour le moment.">
            <button type="button" className="btn btn-primary" onClick={retryServers}>Réessayer</button>
          </EmptyState>
        </div>
      </main>
    );
  }

  if (!hasSelectedServer) return <ServerOnboarding />;

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default function App() {
  // The item catalogue is global game data, not tied to a server, so it's safe to start
  // fetching it the moment the app opens — well before the user ever reaches Recherche —
  // instead of waiting for that page to mount.
  useEffect(() => {
    preloadCatalogueIndexes();
  }, []);

  return (
    <ErrorBoundary>
      <ServerProvider>
        <AppContent />
      </ServerProvider>
    </ErrorBoundary>
  );
}
