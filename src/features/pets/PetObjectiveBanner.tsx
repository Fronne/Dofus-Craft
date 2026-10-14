import type { ReactNode } from 'react';
import { PET_MAX_LEVEL, isPetXpAlmanaxDay, maxTotalXp, type PetXpProgress } from '../../domain/pet-xp';

// specs/055-refonte-xp-familier (US1): the objective banner — what the player types, where the pet
// stands on the way to the last level, the XP still to give, and the Almanax switch that changes how
// it is reached (not how much).

const numberFormat = new Intl.NumberFormat('fr-FR');
const percentFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function PetObjectiveBanner({ levels, totalXpField, progress, xp, almanax, onAlmanaxChange }: {
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
}) {
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
              className="pet-progress-track"
              role="progressbar"
              aria-label="Progression du familier"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.percent)}
              aria-valuetext={`${percentFormat.format(progress.percent)} %, niveau ${progress.level}`}
            >
              <span className="pet-progress-fill" style={{ width: `${progress.percent}%` }} />
              <span className="pet-progress-marker" style={{ left: `clamp(6px, ${progress.percent}%, calc(100% - 6px))` }} aria-hidden="true" />
            </div>
            <div className="pet-progress-bounds">
              <span>Niveau {progress.level} · {numberFormat.format(progress.totalXp)} XP</span>
              <span>Niveau {PET_MAX_LEVEL} · {numberFormat.format(maxTotalXp())} XP</span>
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
            {isPetXpAlmanaxDay() && <small> · c'est aujourd'hui</small>}
          </span>
        </label>
      </div>
    </section>
  );
}
