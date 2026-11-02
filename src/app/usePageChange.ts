import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PAGE_TITLES, SITE_NAME } from './nav-items';

// On a page change: the tab's title follows, and the focus moves to the page itself, so a keyboard
// or screen-reader user lands on the new content rather than staying on the menu link.
export function usePageChange() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstPage = useRef(true);
  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? `Page introuvable — ${SITE_NAME}`;
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);
  return { pathname, mainRef };
}
