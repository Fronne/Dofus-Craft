import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { breedName, portraitUrl } from '../../domain/breeds';
import { counterLabel, formatCount, unitFor, type PlayerCounter } from '../../domain/player-counter';
import { usePlayerCounters } from './usePlayerCounters';

// specs/013-dungeon-drop-counter, specs/014-admin-counters: a round player portrait opening a
// non-modal bubble with a humorous counter. Escape, a click outside — including on another
// counter's portrait — or "Fermer" close it, so only one bubble is open at a time.
export function DungeonCounterBubble({ counter }: { counter: PlayerCounter }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const label = counterLabel(counter);
  const portrait = portraitUrl(counter.breedId, counter.sex);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="dungeon-counter" ref={rootRef}>
      {open && (
        <div className="dungeon-counter-panel" role="dialog" aria-label={label}>
          <div className="dungeon-counter-header">
            <img src={portrait} alt="" className="dungeon-counter-avatar" width={44} height={44} />
            <div className="dungeon-counter-who">
              <p className="dungeon-counter-name">{counter.player}</p>
              <p className="dungeon-counter-class">{breedName(counter.breedId)}</p>
            </div>
            <button type="button" className="icon-button dungeon-counter-close" aria-label="Fermer" onClick={() => setOpen(false)}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <p className="dungeon-counter-value">
            <strong>{formatCount(counter)}</strong>
            <span>{unitFor(counter)}</span>
          </p>
          <p className="dungeon-counter-resource">
            <img src={counter.target.icon} alt="" width={28} height={28} />
            <span>{counter.target.name}</span>
          </p>
        </div>
      )}

      <button
        type="button"
        className="dungeon-counter-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <img src={portrait} alt="" width={56} height={56} />
        <span className="dungeon-counter-badge" aria-hidden="true">{formatCount(counter)}</span>
      </button>
    </div>
  );
}

// The portraits stack down from the top-right corner, oldest counter at the top. No counter
// known (first visit while the service is down) means no bubbles at all (FR-004).
export function PlayerCounters() {
  const counters = usePlayerCounters();
  if (counters.length === 0) return null;
  return (
    <div className="player-counters">
      {counters.map((counter) => <DungeonCounterBubble key={counter.id} counter={counter} />)}
    </div>
  );
}
