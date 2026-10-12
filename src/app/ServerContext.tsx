import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Server } from '../domain/servers';
import type { ServerId } from '../domain/types';
import { getActiveServerId, setActiveServerId } from '../persistence/server-preference';
import { getServers } from '../data/servers-repository';

type ServerContextValue = {
  serverId: ServerId | undefined;
  hasSelectedServer: boolean;
  servers: Server[];
  loadingServers: boolean;
  // The server list could not be read (DofusDB unreachable and no local copy); `retryServers` asks again.
  serversError: boolean;
  retryServers: () => void;
  selectServer: (serverId: ServerId) => void;
};

const ServerContext = createContext<ServerContextValue | undefined>(undefined);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [serversError, setServersError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [serverId, setServerId] = useState<ServerId | undefined>(() => getActiveServerId());

  useEffect(() => {
    let cancelled = false;
    setLoadingServers(true);
    setServersError(false);
    getServers()
      .then((fetched) => {
        if (cancelled) return;
        setServers(fetched);
        // The stored server may no longer exist (renamed or merged since it was picked) —
        // only trust it once it's confirmed to be part of the real, current server list.
        setServerId((current) => (current && fetched.some((server) => server.id === current) ? current : undefined));
      })
      .catch(() => {
        if (!cancelled) setServersError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingServers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const selectServer = (nextServerId: ServerId) => {
    setActiveServerId(nextServerId);
    setServerId(nextServerId);
  };

  return (
    <ServerContext.Provider
      value={{
        serverId,
        hasSelectedServer: serverId !== undefined,
        servers,
        loadingServers,
        serversError,
        retryServers: () => setAttempt((count) => count + 1),
        selectServer,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
}

export function useActiveServer(): ServerContextValue {
  const context = useContext(ServerContext);
  if (!context) throw new Error('useActiveServer must be used within a ServerProvider');
  return context;
}
