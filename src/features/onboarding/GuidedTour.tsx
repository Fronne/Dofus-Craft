import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { CraftableIngredientExample } from './CraftableIngredientExample';
import type { TourStep } from './search-tour-steps';

export type TourCloseReason = 'finished' | 'skipped' | 'escaped';

// Gap between the highlighted area and its cutout, and between the cutout and the bubble.
const CUTOUT_MARGIN = 8;
const BUBBLE_GAP = 12;
// Room assumed for the bubble above/below the target until its real height is measured; otherwise
// it goes beside it, or docks at the bottom as a last resort.
const BUBBLE_MIN_ROOM = 200;
const BUBBLE_MAX_WIDTH = 360;
// A step with more to show (e.g. the craftable-ingredient example) gets a wider bubble.
const WIDE_BUBBLE_MAX_WIDTH = 520;
const NARROW_SCREEN = 640;
const GUTTER = 16;

type Measure = { index: number; rect: DOMRect | null };

function findTarget(target: string | undefined): Element | null {
  return target ? document.querySelector(`[data-tour="${target}"]`) : null;
}

// `bubbleHeight` is the bubble's measured height: a tall bubble (e.g. step 6) only goes below or
// above the area when it fits entirely there, so it never runs off the screen.
function bubblePlacement(rect: DOMRect, maxWidth: number, bubbleHeight: number): { style?: CSSProperties; docked: boolean } {
  if (window.innerWidth < NARROW_SCREEN) return { docked: true };
  const left = Math.min(Math.max(rect.left, GUTTER), window.innerWidth - maxWidth - GUTTER);
  const room = Math.max(BUBBLE_MIN_ROOM, bubbleHeight + CUTOUT_MARGIN + BUBBLE_GAP + GUTTER);
  if (window.innerHeight - rect.bottom >= room) {
    return { docked: false, style: { top: rect.bottom + CUTOUT_MARGIN + BUBBLE_GAP, left } };
  }
  if (rect.top >= room) {
    return { docked: false, style: { bottom: window.innerHeight - rect.top + CUTOUT_MARGIN + BUBBLE_GAP, left } };
  }
  // A tall area on a short screen (e.g. the item card or the resource prices): beside it, vertically
  // centered in the viewport, on whichever side has room — right first, then left.
  const sideRoom = maxWidth + CUTOUT_MARGIN + BUBBLE_GAP + GUTTER;
  const side = { top: '50%', transform: 'translateY(-50%)' };
  if (window.innerWidth - rect.right >= sideRoom) {
    return { docked: false, style: { ...side, left: rect.right + CUTOUT_MARGIN + BUBBLE_GAP } };
  }
  if (rect.left >= sideRoom) {
    return { docked: false, style: { ...side, left: rect.left - CUTOUT_MARGIN - BUBBLE_GAP - maxWidth } };
  }
  return { docked: true };
}

// specs/011-search-onboarding (contracts/guided-tour-ui.md): a step-by-step tour that highlights
// one page area per step. Mounted only while the tour is shown, so every opening starts back at
// step 1. Uses a native modal <dialog> like OutlierConfirmDialog: it blocks any interaction with
// the page underneath (FR-009), keeps focus inside the bubble and turns Escape into a `cancel`
// event (FR-005, FR-011) — research.md §2.
export function GuidedTour({
  steps,
  onClose,
  onStepChange,
}: {
  steps: TourStep[];
  onClose: (reason: TourCloseReason) => void;
  // Lets the page prepare the area a step shows (e.g. unfold a recipe), each time the step changes.
  onStepChange?: (step: TourStep) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const [measure, setMeasure] = useState<Measure | undefined>(undefined);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  // The bubble's real height, re-read after every render (its content changes with the step), so the
  // placement below can check that it fits; settles after one extra render.
  useLayoutEffect(() => {
    const height = bubbleRef.current?.offsetHeight ?? 0;
    if (height !== bubbleHeight) setBubbleHeight(height);
  });
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const target = step.target;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    onStepChange?.(steps[index]);
    // Only a step change should notify; the callback's identity changes with every page render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Brings the step's area into view, then measures it — on the next frame, after the scroll, and
  // again on every scroll/resize so the cutout keeps following it. A missing area (e.g. no item
  // selected yet) measures as `null`, which switches the step to a centered bubble (FR-008).
  useEffect(() => {
    const element = findTarget(target);
    // On a narrow screen the bubble docks at the bottom, so the area goes to the top to stay visible.
    const block = window.innerWidth < NARROW_SCREEN ? 'start' : 'center';
    if (element && typeof element.scrollIntoView === 'function') element.scrollIntoView({ block });
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = findTarget(target);
        setMeasure({ index, rect: current ? current.getBoundingClientRect() : null });
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    // The area itself can grow or shrink while shown (e.g. a recipe unfolded for this step).
    const resizeObserver = element && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined;
    if (element) resizeObserver?.observe(element);
    nextRef.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      resizeObserver?.disconnect();
    };
  }, [index, target]);

  // Until the new step is measured (one frame), the previous step's area stays shown rather than
  // hiding the bubble: the step switches in place, with no blink or sliding effect.
  const measured = measure?.index === index ? measure : undefined;
  const rect = measure?.rect ?? null;
  const placement = rect
    ? bubblePlacement(rect, step.wide ? WIDE_BUBBLE_MAX_WIDTH : BUBBLE_MAX_WIDTH, bubbleHeight)
    : { docked: false };
  const absent = measured !== undefined && rect === null && step.target !== undefined;

  return (
    <dialog
      ref={dialogRef}
      className="guided-tour"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose('escaped');
      }}
    >
      {rect ? (
        <div
          className="guided-tour-cutout"
          style={{
            top: rect.top - CUTOUT_MARGIN,
            left: rect.left - CUTOUT_MARGIN,
            width: rect.width + CUTOUT_MARGIN * 2,
            height: rect.height + CUTOUT_MARGIN * 2,
          }}
        />
      ) : (
        <div className="guided-tour-dim" />
      )}
      <div
        className={[
          'guided-tour-bubble',
          rect ? '' : 'guided-tour-bubble--centered',
          step.wide ? 'guided-tour-bubble--wide' : '',
          placement.docked ? 'guided-tour-bubble--docked' : '',
        ].filter(Boolean).join(' ')}
        style={placement.style}
        ref={bubbleRef}
      >
        <p className="guided-tour-progress">{index + 1} / {steps.length}</p>
        <h2 id={titleId}>{step.title}</h2>
        <p>{step.body}</p>
        {step.points && (
          <ul className="guided-tour-points">
            {step.points.map((point) => (
              <li key={point.term}><strong>{point.term}</strong> : {point.text}</li>
            ))}
          </ul>
        )}
        {absent && step.absentExample === 'craftable-ingredient' && <CraftableIngredientExample />}
        {absent && !step.absentExample && step.absentHint && <p className="guided-tour-hint">{step.absentHint}</p>}
        <div className="guided-tour-actions">
          <button type="button" className="btn guided-tour-skip" onClick={() => onClose('skipped')}>
            Passer
          </button>
          {index > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setIndex(index - 1)}>
              Précédent
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            className="btn btn-primary"
            onClick={() => (isLast ? onClose('finished') : setIndex(index + 1))}
          >
            {isLast ? 'Terminer' : 'Suivant'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
