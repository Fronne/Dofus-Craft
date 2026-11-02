import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { layoutNav } from './nav-layout';
import type { NavItem } from './nav-items';
import type { SiteSettings } from '../domain/site-settings';

// The top bar stays on one line, so a new page never pushes the server, mode, settings and theme controls onto a
// second one: what does not fit goes into a menu (nav-layout.ts says which). Every entry is always rendered, the
// ones left out only invisible, so their natural widths can be measured. null: not measured yet (all rendered).
export function useNavFit(navItems: NavItem[]) {
  const navListRef = useRef<HTMLUListElement>(null);
  const navMainRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [shownKey, setShownKey] = useState<string | null>(null);
  const navKey = navItems.map((item) => item.to).join();
  useLayoutEffect(() => {
    const main = navMainRef.current;
    const list = navListRef.current;
    if (!main || !list) return;
    const fit = () => {
      const widths: Record<string, number> = {};
      Array.from(list.children).forEach((entry) => {
        const key = (entry as HTMLElement).dataset.key;
        if (key) widths[key] = (entry as HTMLElement).offsetWidth;
      });
      const shown = layoutNav({
        items: navItems,
        widths,
        room: main.clientWidth,
        gap: parseFloat(getComputedStyle(list).columnGap) || 0,
        moreWidth: moreRef.current?.offsetWidth || 96,
        // The phone layout is a bottom tab bar that shares its width between the links: no menu there.
        compact: typeof window.matchMedia === 'function' && !window.matchMedia('(min-width: 961px)').matches,
      });
      setShownKey([...shown].sort().join('|'));
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : undefined;
    observer?.observe(main);
    Array.from(list.children).forEach((entry) => observer?.observe(entry));
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navKey]);
  const shown = useMemo(() => (shownKey === null ? null : new Set(shownKey.split('|'))), [shownKey]);
  const isShown = (key: string) => shown === null || shown.has(key);
  return { navListRef, navMainRef, moreRef, shownKey, isShown };
}

// The diamond under the current page's link slides from one link to the next: its place is the
// middle of the active link's bottom edge, handed to the list as CSS variables (styles/parts). No
// active link (Paramètres), no diamond.
export function useNavMarker(
  navListRef: RefObject<HTMLUListElement | null>,
  pathname: string,
  navItems: NavItem[],
  siteSettings: SiteSettings,
  shownKey: string | null,
) {
  useLayoutEffect(() => {
    const list = navListRef.current;
    if (!list) return;
    const place = () => {
      // The first active link of the entries in sight: a menu's button when the page is inside the menu.
      const shown = list.querySelector<HTMLElement>('li:not(.is-overflow) .app-nav-link.active')?.closest('li');
      list.style.setProperty('--nav-marker-on', shown ? '1' : '0');
      if (!shown) return;
      list.style.setProperty('--nav-marker-x', `${shown.offsetLeft + shown.offsetWidth / 2}px`);
      // Its own line when the links wrap on two.
      list.style.setProperty('--nav-marker-y', `${shown.offsetTop + shown.offsetHeight}px`);
    };
    place();
    // It slides only once it has been placed a first time: it must not glide in when the page opens.
    const ready = requestAnimationFrame(() => { list.dataset.markerReady = ''; });
    // The links move when the web font arrives or when the list of pages changes.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : undefined;
    observer?.observe(list);
    return () => {
      cancelAnimationFrame(ready);
      observer?.disconnect();
    };
  }, [navListRef, pathname, navItems.length, siteSettings, shownKey]);
}
