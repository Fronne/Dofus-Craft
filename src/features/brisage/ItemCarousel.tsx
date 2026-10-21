import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';

// The row of result cards on the Brisage page, as a carousel: arrows, edge fades, snapping, a slim scrollbar, a
// position counter, and four ways to move (arrows, wheel, mouse drag, keyboard). The cards are the children, one <li> each.

const DRAG_THRESHOLD = 5;
const NEAR_END = 240;

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ItemCarousel({ total, shown, onNearEnd, children }: {
  total: number;
  shown: number;
  onNearEnd: () => void;
  children: ReactNode;
}) {
  const list = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [lastSeen, setLastSeen] = useState(0);
  const [dragging, setDragging] = useState(false);
  const nearEnd = useRef(onNearEnd);
  useEffect(() => { nearEnd.current = onNearEnd; });

  const measure = useCallback(() => {
    const element = list.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setEdges({ start: element.scrollLeft <= 1, end: max <= 1 || element.scrollLeft >= max - 1 });
    // The last card whose right edge is inside the row: the "5" of "5 / 38".
    const right = element.getBoundingClientRect().right + 1;
    let seen = 0;
    Array.from(element.children).forEach((card, position) => {
      if (card.firstElementChild && card.firstElementChild.getBoundingClientRect().right <= right) seen = position + 1;
    });
    setLastSeen(seen);
    // Everything shown fits without scrolling (wide screen): nothing would ever ask for more, so ask now.
    if (max <= 1 && element.clientWidth > 0) nearEnd.current();
  }, []);

  // Near the right end, bring in the next cards on their own (only when the user scrolls).
  const onScroll = useCallback(() => {
    measure();
    const element = list.current;
    if (element && element.scrollLeft + element.clientWidth >= element.scrollWidth - NEAR_END) nearEnd.current();
  }, [measure]);

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
          <p className="carousel-counter" aria-hidden="true">{Math.min(lastSeen, total)} / {total} objet{total > 1 ? 's' : ''}</p>
        </>
      )}
    </div>
  );
}
