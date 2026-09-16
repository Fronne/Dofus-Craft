import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ServerOnboarding } from '../features/server/ServerOnboarding';
import { ServerProvider, useActiveServer } from './ServerContext';
import { preloadCatalogueIndexes } from '../data/catalogue-repository';

function AppContent() {
  const { hasSelectedServer, loadingServers } = useActiveServer();

  if (loadingServers) {
    return (
      <main className="server-onboarding" aria-live="polite" aria-busy="true">
        <span className="loading-spinner" aria-hidden="true" />
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
    <ServerProvider>
      <AppContent />
    </ServerProvider>
  );
}
