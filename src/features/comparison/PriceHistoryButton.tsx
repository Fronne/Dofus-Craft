import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import { useActiveServer } from '../../app/ServerContext';
import { formatKamas } from '../../domain/kamas';
import { GROUPINGS, GROUPING_LABELS, formatPeriod, historyDisplay, type Grouping } from '../../domain/price-history';
import { readHistoryGrouping, saveHistoryGrouping } from '../../persistence/history-grouping-preference';
import { PriceHistoryChart } from './PriceHistoryChart';
import { usePriceHistory, type PriceHistoryState } from './usePriceHistory';

// specs/017-price-history-chart (contracts/price-history-ui.md): the history button of a resource line
// or of the HDV price field, Mode communautaire only (the caller decides). The panel is portaled to
// <body> because the button sits inside a <label>: clicking a panel nested there would focus the
// price field (research.md §5). Closing mirrors DungeonCounterBubble — Escape, a pointerdown outside
// (including on another history button, so only one stays open) or « Fermer ». Scrolling or resizing
// moves the panel along instead of closing it; under 480px the CSS pins it to the bottom of the screen.

const PANEL_WIDTH = 340;
const GAP = 8;
const EDGE = 16;
const NARROW_SCREEN = 480;

export function PriceHistoryButton({ kind, id, name, serverId, label, className }: {
  kind: 'resource' | 'item';
  id: string;
  name: string;
  serverId: string;
  // Visible text beside the icon (the item card's button); icon only otherwise.
  label?: string;
  className?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [grouping, setGrouping] = useState<Grouping>(readHistoryGrouping);
  const state = usePriceHistory(kind, id, serverId, open);
  const serverName = useActiveServer().servers.find((server) => server.id === serverId)?.name ?? serverId;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const chooseGrouping = (next: Grouping) => {
    setGrouping(next);
    saveHistoryGrouping(next);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) close(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  // Positioned by writing the panel's style directly: the position follows the page, not React state.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      if (window.innerWidth < NARROW_SCREEN) {
        panel.style.top = '';
        panel.style.left = '';
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const left = Math.min(Math.max(rect.right - PANEL_WIDTH, EDGE), window.innerWidth - PANEL_WIDTH - EDGE);
      const below = rect.bottom + GAP;
      const above = rect.top - GAP - panel.offsetHeight;
      const fitsBelow = below + panel.offsetHeight <= window.innerHeight - EDGE;
      panel.style.left = `${left}px`;
      panel.style.top = `${fitsBelow || above < EDGE ? below : above}px`;
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, state.kind, grouping]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className ?? 'icon-button price-history-trigger'}
        aria-label="Historique du prix"
        title="Historique du prix"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(event) => {
          // Inside a <label>: never let the click reach (and focus) the price field.
          event.preventDefault();
          if (open) {
            setOpen(false);
          } else {
            setGrouping(readHistoryGrouping());
            setOpen(true);
          }
        }}
      >
        <Icon name="chart" size={label ? 18 : 14} />
        {label}
      </button>
      {open && createPortal(
        <div ref={panelRef} className="price-history-panel" role="dialog" aria-label={`Historique du prix de ${name}`}>
          <div className="price-history-header">
            <div>
              <p className="price-history-title">{name}</p>
              <p className="price-history-server">Serveur {serverName}</p>
            </div>
            <button type="button" className="icon-button price-history-close" aria-label="Fermer" onClick={() => close(true)}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="price-history-groupings" role="group" aria-label="Regroupement">
            {GROUPINGS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className="price-history-grouping"
                aria-pressed={grouping === candidate}
                onClick={() => chooseGrouping(candidate)}
              >
                {GROUPING_LABELS[candidate]}
              </button>
            ))}
          </div>
          <PriceHistoryBody state={state} grouping={grouping} onChooseGrouping={chooseGrouping} />
        </div>,
        document.body,
      )}
    </>
  );
}

function PriceHistoryBody({ state, grouping, onChooseGrouping }: {
  state: PriceHistoryState;
  grouping: Grouping;
  onChooseGrouping: (grouping: Grouping) => void;
}) {
  if (state.kind === 'loading') return <div className="price-history-skeleton" aria-busy="true" aria-label="Chargement de l'historique" />;
  // FR-013: no curve, no value — never an invented or outdated one.
  if (state.kind === 'unavailable') return <p className="price-history-message">Historique indisponible pour le moment.</p>;
  const display = historyDisplay(state.history, grouping);
  if (display.kind === 'empty') return <p className="price-history-message">Pas encore d'historique pour ce serveur.</p>;
  if (display.kind === 'single') {
    const { point, finerGrouping } = display;
    return (
      <div className="price-history-message">
        <p><strong>Pas assez d'historique</strong></p>
        <p>{formatPeriod(point.periodStart, grouping)} : {formatKamas(point.medianAmountKamas)} ({point.sampleSize} prix)</p>
        {finerGrouping && (
          <button type="button" className="price-history-invite" onClick={() => onChooseGrouping(finerGrouping)}>
            Essayez le regroupement {GROUPING_LABELS[finerGrouping]}
          </button>
        )}
      </div>
    );
  }
  return <PriceHistoryChart points={display.points} grouping={grouping} />;
}
