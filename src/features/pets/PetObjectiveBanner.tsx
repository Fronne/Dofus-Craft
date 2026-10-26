import { useRef, useState, type ReactNode } from 'react';
import { PET_MAX_LEVEL, PET_MIN_LEVEL, isPetXpAlmanaxDay, levelAtProgress, maxTotalXp, type PetXpProgress } from '../../domain/pet-xp';

// specs/055-refonte-xp-familier (US1): the objective banner — what the player types, where the pet
// stands on the way to the last level, the XP still to give, and the Almanax switch that changes how
// it is reached (not how much).

const numberFormat = new Intl.NumberFormat('fr-FR');
const percentFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// specs/075: the keys that move the level of the slider.
const KEY_LEVELS: Record<string, (level: number) => number> = {
  ArrowRight: (level) => level + 1,
  ArrowUp: (level) => level + 1,
  ArrowLeft: (level) => level - 1,
  ArrowDown: (level) => level - 1,
  Home: () => PET_MIN_LEVEL,
  End: () => PET_MAX_LEVEL,
};

export function PetObjectiveBanner({ levels, totalXpField, progress, xp, almanax, onAlmanaxChange, onLevelChange }: {
  /** The « Niveau actuel → Niveau visé » fields. */
  levels: ReactNode;
  /** The « XP totale du familier » field, linked to the current level. */
  totalXpField: ReactNode;
  /** Undefined while the total XP typed is not valid. */
  progress?: PetXpProgress;
  /** XP still to give; undefined while a field is not valid. */
  xp?: number;
  almanax: boolean;
  onAlmanaxChange: (on: boolean) => void;
  /** specs/075: the level picked by dragging or keying the progress bar. */
  onLevelChange: (level: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // The bar is proportional to the XP: the pointer's place on it gives an XP, and so a level.
  const chooseLevelAt = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    const level = levelAtProgress((clientX - box.left) / box.width);
    if (level !== progress?.level) onLevelChange(level);
  };
  return (
    <section className="panel pet-objective" aria-label="Objectif du familier">
      <div className="pet-objective-main">
        <div className="pet-objective-fields">
          {levels}
          {totalXpField}
        </div>
        {progress && (
          <div className="pet-progress">
            <div className="pet-progress-head">
              <span>Progression vers le niveau {PET_MAX_LEVEL}</span>
              <b>{percentFormat.format(progress.percent)} %</b>
            </div>
            <div
              ref={trackRef}
              className={`pet-progress-track${dragging ? ' pet-progress-track--dragging' : ''}`}
              role="slider"
              tabIndex={0}
              aria-label="Progression du familier"
              aria-valuemin={PET_MIN_LEVEL}
              aria-valuemax={PET_MAX_LEVEL}
              aria-valuenow={progress.level}
              aria-valuetext={`${percentFormat.format(progress.percent)} %, niveau ${progress.level}`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                setDragging(true);
                chooseLevelAt(event.clientX);
              }}
              onPointerMove={(event) => { if (dragging) chooseLevelAt(event.clientX); }}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
              onLostPointerCapture={() => setDragging(false)}
              onKeyDown={(event) => {
                const next = KEY_LEVELS[event.key]?.(progress.level);
                if (next === undefined) return;
                event.preventDefault();
                onLevelChange(Math.min(Math.max(next, PET_MIN_LEVEL), PET_MAX_LEVEL));
              }}
            >
              <span className="pet-progress-fill" style={{ width: `${progress.percent}%` }} />
              <span className="pet-progress-marker" style={{ left: `clamp(6px, ${progress.percent}%, calc(100% - 6px))` }} aria-hidden="true" />
              {dragging && (
                <span className="pet-progress-bubble" style={{ left: `clamp(28px, ${progress.percent}%, calc(100% - 28px))` }} aria-hidden="true">
                  Niveau {progress.level}
                </span>
              )}
            </div>
            <div className="pet-progress-bounds">
              <span>Niveau {progress.level}, {numberFormat.format(progress.totalXp)} XP</span>
              <span>Niveau {PET_MAX_LEVEL}, {numberFormat.format(maxTotalXp())} XP</span>
            </div>
          </div>
        )}
      </div>
      <div className="pet-objective-result">
        <p className="pet-xp-needed" role="status">
          {xp === undefined ? (
            <><span>XP à donner</span><b>—</b></>
          ) : xp > 0 ? (
            <><span>XP à donner</span><b>{numberFormat.format(xp)}</b></>
          ) : (
            'Aucune XP à donner : le niveau visé est déjà atteint.'
          )}
        </p>
        <label className="pet-almanax-switch">
          <input type="checkbox" role="switch" checked={almanax} onChange={(event) => onAlmanaxChange(event.target.checked)} />
          <span className="pet-almanax-switch-track" aria-hidden="true" />
          <span>
            Almanax du 23 juillet (+50 % d'XP)
            {isPetXpAlmanaxDay() && <small> (c'est aujourd'hui)</small>}
          </span>
        </label>
      </div>
    </section>
  );
}
