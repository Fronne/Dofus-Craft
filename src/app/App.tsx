import { BrowserRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ServerOnboarding } from '../features/server/ServerOnboarding';
import { ServerProvider, useActiveServer } from './ServerContext';

function AppContent() {
  const { hasSelectedServer } = useActiveServer();

  if (!hasSelectedServer) return <ServerOnboarding />;

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ServerProvider>
      <AppContent />
    </ServerProvider>
  );
}
