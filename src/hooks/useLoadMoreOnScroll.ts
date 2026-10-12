import { useEffect, useRef, useState } from 'react';

// Infinite scroll shared by long lists (Prix page, specs/019 FR-007 revised; HDV page, specs/023
// FR-009): the next lines appear as the end of the list comes into view.
export const LOAD_MORE_PAGE_SIZE = 25;
// A short pause before the next lines appear, with a small « Chargement… » in the meantime, so they
// read as loaded rather than popping in.
const MORE_DELAY_MS = 800;

// Watches the element at the end of the list and calls `onVisible` when it scrolls into view. Without
// IntersectionObserver (very old browsers, tests), every line is simply shown.
function useEndOfList(onVisible: () => void, enabled: boolean) {
  // The element is kept in state, not in a ref: when the list is rebuilt (another tab of the HDV
  // page), the new end-of-list element is observed in place of the one that left the page.
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const callback = useRef(onVisible);
  useEffect(() => {
    callback.current = onVisible;
  });
  useEffect(() => {
    if (!enabled || !target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) callback.current();
    }, { rootMargin: '400px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, target]);
  return setTarget;
}

/**
 * The first lines of `list`, growing by one page each time the end of the list scrolls into view.
 * `reset()` goes back to the first page (call it when a filter or the sort changes); `endRef` goes on
 * the element placed after the list while `visible.length < list.length`.
 */
export function useLoadMoreOnScroll<T>(list: T[]) {
  const [shown, setShown] = useState(LOAD_MORE_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const moreTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(moreTimer.current), []);
  const showMore = () => {
    if (moreTimer.current !== undefined) return;
    setLoadingMore(true);
    moreTimer.current = window.setTimeout(() => {
      moreTimer.current = undefined;
      setLoadingMore(false);
      setShown((count) => count + LOAD_MORE_PAGE_SIZE);
    }, MORE_DELAY_MS);
  };
  const limit = typeof IntersectionObserver === 'undefined' ? list.length : shown;
  const visible = list.slice(0, limit);
  const endRef = useEndOfList(showMore, visible.length < list.length);
  return { visible, endRef, loadingMore, reset: () => setShown(LOAD_MORE_PAGE_SIZE) };
}
