import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { SERVER_TYPE_LABELS, groupServersByType } from '../../domain/servers';
import { Icon } from '../../components/Icon';

export function ServerSwitcher() {
  const { serverId, servers, selectServer } = useActiveServer();
  const activeServer = servers.find((server) => server.id === serverId);
  const groups = groupServersByType(servers);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Opening puts the focus on the active server, so the arrows start from it.
  useEffect(() => {
    if (!open) return;
    const options = panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    const selected = panelRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    (selected ?? options?.[0])?.focus();
  }, [open]);

  const moveFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const options = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    if (options.length === 0) return;
    const index = options.indexOf(document.activeElement as HTMLElement);
    const target =
      event.key === 'ArrowDown' ? (index + 1) % options.length
        : event.key === 'ArrowUp' ? (index - 1 + options.length) % options.length
          : event.key === 'Home' ? 0
            : event.key === 'End' ? options.length - 1
              : undefined;
    if (target === undefined) return;
    event.preventDefault();
    options[target]?.focus();
  };

  return (
    <div
      className="server-switcher"
      ref={containerRef}
      // Tabbing out closes the list. A click is left to the listener above: some browsers give a
      // clicked button no focus, and closing here would then swallow the click on a server.
      onBlur={(event) => {
        if (event.relatedTarget && !containerRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="server-switcher-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' || open) return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <Icon name="server" size={16} className="server-switcher-icon" />
        <span className="server-switcher-text">
          <span className="server-switcher-label">Serveur actif</span>
          <span className="server-switcher-value">{activeServer?.name ?? '—'}</span>
        </span>
        <Icon name="chevron-down" size={14} className="server-switcher-chevron" />
      </button>
      {open && (
        <div className="server-switcher-panel" role="listbox" aria-label="Serveur actif" ref={panelRef} onKeyDown={moveFocus}>
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
                    close(true);
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
