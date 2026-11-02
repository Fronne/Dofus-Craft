import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';

export interface NavMenuItem {
  to: string;
  label: string;
  icon: IconName;
  end: boolean;
}

// A drop-down of pages in the top bar (« Marché », « Outils », « Plus »). It opens on a click, and also when a mouse
// rests on it; Escape, a click elsewhere or a page change close it.
export function NavMenu({ label, items, hidden = false }: { label: string; items: NavMenuItem[]; hidden?: boolean }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // A click on a menu a mouse has just opened by resting on it must not close it again.
  const openedByHover = useRef(false);
  const active = items.some((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // The focus was inside the menu that has just gone: give it back to the button.
      if (rootRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div
      className="app-nav-menu"
      ref={rootRef}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse' || hidden) return;
        openedByHover.current = true;
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        openedByHover.current = false;
        setOpen(false);
      }}
      // Tabbing out of the menu closes it.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`app-nav-link app-nav-menu-button${active ? ' active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        tabIndex={hidden ? -1 : undefined}
        onClick={(event) => {
          // A keyboard « click » has no pointer (detail 0): it always toggles.
          if (openedByHover.current && event.detail > 0) {
            openedByHover.current = false;
            return;
          }
          openedByHover.current = false;
          setOpen((current) => !current);
        }}
      >
        <span>{label}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <div className="app-nav-menu-pop">
          <ul className="app-nav-menu-list">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
