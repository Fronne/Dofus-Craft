import { useActiveServer } from '../../app/ServerContext';
import { Icon } from '../../components/Icon';

export function ServerSwitcher() {
  const { serverId, servers, selectServer } = useActiveServer();

  return (
    <div className="server-switcher">
      <Icon name="server" size={16} className="server-switcher-icon" />
      <div className="server-switcher-text">
        <label htmlFor="active-server-select">Serveur actif</label>
        <select
          id="active-server-select"
          value={serverId ?? ''}
          onChange={(event) => selectServer(event.target.value)}
        >
          {servers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.name}
            </option>
          ))}
        </select>
      </div>
      <Icon name="chevron-down" size={14} className="server-switcher-chevron" />
    </div>
  );
}
