import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';

// The row of result cards on the Brisage page, as a carousel: arrows, edge fades, snapping, a slim scrollbar,
// and four ways to move (arrows, wheel, mouse drag, keyboard). The cards are the children, one <li> each.

const DRAG_THRESHOLD = 5;
const NEAR_END = 240;

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ItemCarousel({ total, shown, onNearEnd, onVisibleEnd, children }: {
  total: number;
  shown: number;
  onNearEnd: () => void;
  /** How many cards, counted from the first, are now fully in view up to the right edge. */
  onVisibleEnd?: (count: number) => void;
  children: ReactNode;
}) {
  const list = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [dragging, setDragging] = useState(false);
  const nearEnd = useRef(onNearEnd);
  const visibleEnd = useRef(onVisibleEnd);
  const lastSeen = useRef(0);
  useEffect(() => { nearEnd.current = onNearEnd; visibleEnd.current = onVisibleEnd; });

  const measure = useCallback(() => {
    const element = list.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setEdges({ start: element.scrollLeft <= 1, end: max <= 1 || element.scrollLeft >= max - 1 });
    // The buttons, not the <li> around them: those take no box of their own.
    const cards = element.querySelectorAll<HTMLElement>(':scope > li > button');
    const right = element.scrollLeft + element.clientWidth + 1;
    let seen = 0;
    cards.forEach((card) => { if (card.offsetLeft - element.offsetLeft + card.offsetWidth <= right) seen += 1; });
    seen = Math.min(cards.length, Math.max(1, seen));
    if (cards.length > 0 && seen !== lastSeen.current) {
      lastSeen.current = seen;
      visibleEnd.current?.(seen);
    }
    // Everything shown fits without scrolling (wide screen): nothing would ever ask for more, so ask now.
    if (max <= 1 && element.clientWidth > 0) nearEnd.current();
  }, []);

  // Near the right end, bring in the next cards on their own (only when the user scrolls).
  const onScroll = useCallback(() => {
    measure();
    const element = list.current;
    if (element && element.scrollLeft + element.clientWidth >= element.scrollWidth - NEAR_END) nearEnd.current();
  }, [measure]);

  // A card already picked when the list appears (a shared link, a return to the page) is brought into view.
  useLayoutEffect(() => {
    const element = list.current;
    const card = element?.querySelector<HTMLElement>(':scope > li > button.selected');
    if (!element || !card) return;
    const left = card.offsetLeft - element.offsetLeft;
    if (left + card.offsetWidth > element.clientWidth) element.scrollLeft = Math.max(0, left - 8);
  }, []);

  // New cards (or a new list) change what fits: measure again.
  useLayoutEffect(measure, [measure, shown, total]);
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    element.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      element.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, [measure, onScroll]);

  // Move by whole cards, so a card is never left cut in half. The step is the distance between two cards.
  // Steps asked while the previous one is still sliding build on its destination, so quick turns of the wheel add up.
  const pending = useRef({ index: 0, until: 0 });
  const stepBy = useCallback((direction: -1 | 1) => {
    const element = list.current;
    const cards = element?.querySelectorAll<HTMLElement>(':scope > li > button');
    if (!element || !cards || cards.length === 0) return;
    // Layout pixels (offsetLeft), like scrollLeft: the page may be scaled, which rectangles would reflect.
    const pitch = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : cards[0].offsetWidth;
    if (pitch <= 0) return;
    const max = element.scrollWidth - element.clientWidth;
    const now = performance.now();
    const from = now < pending.current.until ? pending.current.index : Math.round(element.scrollLeft / pitch);
    const index = Math.min(Math.ceil(max / pitch), Math.max(0, from + direction));
    pending.current = { index, until: now + 450 };
    element.scrollTo({ left: Math.min(max, index * pitch), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    if (direction === 1 && shown < total) nearEnd.current();
  }, [shown, total]);
  const step = useRef(stepBy);
  useEffect(() => { step.current = stepBy; });

  // The wheel (vertical or horizontal) moves one card per notch (100 of delta); at either end it falls through to the page.
  // A trackpad's many small deltas add up the same way, and the sum is forgotten after a pause.
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    let sum = 0;
    let lastEvent = 0;
    const onWheel = (event: WheelEvent) => {
      const raw = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const delta = event.deltaMode === 1 ? raw * 33 : raw;
      if (delta === 0) return;
      const max = element.scrollWidth - element.clientWidth;
      if (max <= 0) return;
      const atStart = element.scrollLeft <= 0 && delta < 0 && pending.current.index <= 0;
      const atEnd = element.scrollLeft >= max - 1 && delta > 0;
      if (atStart || atEnd) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastEvent > 200 || Math.sign(sum) !== Math.sign(delta)) sum = 0;
      lastEvent = now;
      sum += delta;
      while (Math.abs(sum) >= 100) {
        step.current(sum > 0 ? 1 : -1);
        sum -= Math.sign(sum) * 100;
      }
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  // Mouse drag: only once the pointer has moved a few pixels, so a plain click still picks the card.
  const drag = useRef<{ x: number; left: number; active: boolean } | null>(null);
  const onPointerDown = (event: React.PointerEvent<HTMLUListElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft, active: false };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLUListElement>) => {
    const state = drag.current;
    if (!state) return;
    // The button was released outside the list: no pointerup came, so forget the press.
    if (event.buttons === 0) { endDrag(); return; }
    const moved = event.clientX - state.x;
    if (!state.active) {
      if (Math.abs(moved) < DRAG_THRESHOLD) return;
      state.active = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.currentTarget.scrollLeft = state.left - moved;
  };
  // Once dragging, the pointer is captured by the list, so the click lands on it and no card is picked.
  const endDrag = () => {
    if (drag.current?.active) setDragging(false);
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    stepBy(event.key === 'ArrowRight' ? 1 : -1);
  };

  const overflowing = !(edges.start && edges.end);
  return (
    <div
      className="brisage-carousel"
      data-start={edges.start || undefined}
      data-end={edges.end || undefined}
      data-dragging={dragging || undefined}
      onKeyDown={onKeyDown}
    >
      <ul
        className="results brisage-cards"
        aria-label="Objets trouvés"
        ref={list}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {children}
      </ul>
      {overflowing && (
        <>
          <button type="button" className="carousel-arrow carousel-arrow--prev" aria-label="Objets précédents" disabled={edges.start} onClick={() => stepBy(-1)}>
            <Icon name="chevron-left" size={20} />
          </button>
          <button type="button" className="carousel-arrow carousel-arrow--next" aria-label="Objets suivants" disabled={edges.end && shown >= total} onClick={() => stepBy(1)}>
            <Icon name="chevron-right" size={20} />
          </button>
        </>
      )}
    </div>
  );
}
