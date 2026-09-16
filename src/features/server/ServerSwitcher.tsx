import { useEffect, useRef, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { SERVER_TYPE_LABELS, groupServersByType } from '../../domain/servers';
import { Icon } from '../../components/Icon';

export function ServerSwitcher() {
  const { serverId, servers, selectServer } = useActiveServer();
  const activeServer = servers.find((server) => server.id === serverId);
  const groups = groupServersByType(servers);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="server-switcher" ref={containerRef}>
      <button
        type="button"
        className="server-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="server" size={16} className="server-switcher-icon" />
        <span className="server-switcher-text">
          <span className="server-switcher-label">Serveur actif</span>
          <span className="server-switcher-value">{activeServer?.name ?? '—'}</span>
        </span>
        <Icon name="chevron-down" size={14} className="server-switcher-chevron" />
      </button>
      {open && (
        <div className="server-switcher-panel" role="listbox" aria-label="Serveur actif">
          {groups.map((group) => (
            <div key={group.type} className="server-switcher-group">
              <h3 className="eyebrow">{SERVER_TYPE_LABELS[group.type]}</h3>
              {group.servers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  role="option"
                  aria-selected={server.id === serverId}
                  className={server.id === serverId ? 'server-switcher-option selected' : 'server-switcher-option'}
                  onClick={() => {
                    selectServer(server.id);
                    setOpen(false);
                  }}
                >
                  {server.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
