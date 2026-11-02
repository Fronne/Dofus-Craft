import type { RefObject } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ROUTES } from './router';
import { Icon } from '../components/Icon';
import { NavMenu } from './NavMenu';
import { AccountMenu } from './AccountMenu';
import { groupKey } from './nav-layout';
import type { NavItem } from './nav-items';
import { ServerSwitcher } from '../features/server/ServerSwitcher';
import { DEFAULT_DOFUS, dofusById, type DofusId } from '../domain/dofus-themes';

interface AppTopBarProps {
  entryTo: string;
  entryName: string;
  dofus: DofusId;
  navItems: NavItem[];
  marketItems: NavItem[];
  toolItems: NavItem[];
  marketMenu: boolean;
  /** The pages that are neither a link on the bar nor in one of its menus. */
  plusItems: NavItem[];
  isShown: (key: string) => boolean;
  navListRef: RefObject<HTMLUListElement | null>;
  navMainRef: RefObject<HTMLDivElement | null>;
  moreRef: RefObject<HTMLDivElement | null>;
}

// The top bar: the brand, the pages (links, « Marché » and « Outils » menus, « Plus »), then the server, the account and Paramètres.
export function AppTopBar({
  entryTo, entryName, dofus, navItems, marketItems, toolItems, marketMenu, plusItems,
  isShown, navListRef, navMainRef, moreRef,
}: AppTopBarProps) {
  return (
    <nav className="app-nav" aria-label="Navigation principale">
      <Link className="app-nav-brand" to={entryTo} aria-label={`DofusCraft, aller à ${entryName}`}>
        <img
          className="app-nav-brand-mark"
          src={dofusById(dofus).image}
          alt=""
          width="44"
          height="44"
          onError={(event) => {
            const fallback = dofusById(DEFAULT_DOFUS).image;
            if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
          }}
        />
        <span className="app-nav-brand-name">
          Dofus<span className="app-nav-brand-accent">Craft</span>
        </span>
      </Link>
      <div className="app-nav-main" ref={navMainRef}>
        <ul className="app-nav-list" ref={navListRef}>
          {navItems.map((item) => (
            <li key={item.to} data-key={item.to} className={isShown(item.to) ? undefined : 'is-overflow'} aria-hidden={isShown(item.to) ? undefined : true}>
              <NavLink
                to={item.to}
                end={item.end}
                tabIndex={isShown(item.to) ? undefined : -1}
                className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
          {marketMenu && (
            <li data-key={groupKey('market')} className={isShown(groupKey('market')) ? undefined : 'is-overflow'} aria-hidden={isShown(groupKey('market')) ? undefined : true}>
              <NavMenu label="Marché" items={marketItems} hidden={!isShown(groupKey('market'))} />
            </li>
          )}
          {toolItems.length > 0 && (
            <li data-key={groupKey('tools')} className={isShown(groupKey('tools')) ? undefined : 'is-overflow'} aria-hidden={isShown(groupKey('tools')) ? undefined : true}>
              <NavMenu label="Outils" items={toolItems} hidden={!isShown(groupKey('tools'))} />
            </li>
          )}
        </ul>
        {plusItems.length > 0 && (
          <div className="app-nav-more" ref={moreRef}>
            <NavMenu label="Plus" items={plusItems} />
          </div>
        )}
      </div>
      {/* specs/051-site-visual-refresh: the right end of the top bar — active server, then
          the account, then Paramètres (reached from this icon, not from the page list). The theme and the price
          mode are chosen in Paramètres only: their switches left the bar to give the pages more room. */}
      <div className="app-nav-footer">
        <ServerSwitcher />
        <AccountMenu />
        <NavLink
          to={ROUTES.settings}
          className={({ isActive }) => `icon-button app-nav-settings${isActive ? ' active' : ''}`}
          aria-label="Paramètres"
          title="Paramètres"
        >
          <Icon name="settings" size={18} />
        </NavLink>
      </div>
    </nav>
  );
}
