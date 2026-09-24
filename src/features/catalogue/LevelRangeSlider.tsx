import { useEffect, useRef, useState } from 'react';

const LEVEL_MIN = 1;
const LEVEL_MAX = 200;
// Dragging a handle fires a change on every pixel; the search (and its URL update) only follows once
// the handle has paused this long, so a drag from 1 to 200 doesn't run 200 searches.
const COMMIT_DELAY_MS = 200;

// An empty bound means "no limit", shown at the end of the track.
function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, parsed)) : fallback;
}

function percent(value: number) {
  return ((value - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN)) * 100;
}

// Two range inputs stacked on one track: each handle stays keyboard- and screen-reader-accessible
// on its own ("Niveau min" / "Niveau max"), and neither can cross the other.
export function LevelRangeSlider({
  levelMin,
  setLevelMin,
  levelMax,
  setLevelMax,
}: {
  levelMin: string;
  setLevelMin: (value: string) => void;
  levelMax: string;
  setLevelMax: (value: string) => void;
}) {
  const [low, setLow] = useState(() => toNumber(levelMin, LEVEL_MIN));
  const [high, setHigh] = useState(() => toNumber(levelMax, LEVEL_MAX));
  const pendingRef = useRef<number | undefined>(undefined);

  // Follows outside changes (e.g. « Réinitialiser les filtres », a restored search).
  useEffect(() => setLow(toNumber(levelMin, LEVEL_MIN)), [levelMin]);
  useEffect(() => setHigh(toNumber(levelMax, LEVEL_MAX)), [levelMax]);
  useEffect(() => () => window.clearTimeout(pendingRef.current), []);

  const commit = (nextLow: number, nextHigh: number) => {
    window.clearTimeout(pendingRef.current);
    pendingRef.current = window.setTimeout(() => {
      setLevelMin(nextLow === LEVEL_MIN ? '' : String(nextLow));
      setLevelMax(nextHigh === LEVEL_MAX ? '' : String(nextHigh));
    }, COMMIT_DELAY_MS);
  };

  const isFullRange = low === LEVEL_MIN && high === LEVEL_MAX;

  return (
    <div className="level-slider">
      <span className="level-slider-value" aria-hidden="true">
        {isFullRange ? 'Tous les niveaux' : low === high ? `Niveau ${low}` : `${low} – ${high}`}
      </span>
      <div className="level-slider-track">
        <span
          className="level-slider-fill"
          style={{ left: `${percent(low)}%`, right: `${100 - percent(high)}%` }}
        />
        <input
          type="range"
          min={LEVEL_MIN}
          max={LEVEL_MAX}
          value={low}
          aria-label="Niveau min"
          // Both handles at the far right: the min one must sit on top, or it could never be
          // dragged back left (the max handle above it can't go below the min).
          className={low === high && low > (LEVEL_MIN + LEVEL_MAX) / 2 ? 'level-slider-on-top' : undefined}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), high);
            setLow(next);
            commit(next, high);
          }}
        />
        <input
          type="range"
          min={LEVEL_MIN}
          max={LEVEL_MAX}
          value={high}
          aria-label="Niveau max"
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), low);
            setHigh(next);
            commit(low, next);
          }}
        />
      </div>
      <div className="level-slider-bounds" aria-hidden="true">
        <span>{LEVEL_MIN}</span>
        <span>{LEVEL_MAX}</span>
      </div>
    </div>
  );
}
