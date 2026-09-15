import { createContext, useContext, useState, type ReactNode } from 'react';
import { listServers } from '../domain/servers';
import type { Server } from '../domain/servers';
import type { ServerId } from '../domain/types';
import { getActiveServerId, setActiveServerId } from '../persistence/server-preference';

type ServerContextValue = {
  serverId: ServerId | undefined;
  hasSelectedServer: boolean;
  servers: Server[];
  selectServer: (serverId: ServerId) => void;
};

const ServerContext = createContext<ServerContextValue | undefined>(undefined);

export function ServerProvider({ children }: { children: ReactNode }) {
  const [serverId, setServerId] = useState<ServerId | undefined>(() => getActiveServerId());

  const selectServer = (nextServerId: ServerId) => {
    setActiveServerId(nextServerId);
    setServerId(nextServerId);
  };

  return (
    <ServerContext.Provider
      value={{
        serverId,
        hasSelectedServer: serverId !== undefined,
        servers: listServers(),
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
