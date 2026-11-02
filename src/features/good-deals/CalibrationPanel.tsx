import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { BRISAGE_STATS } from '../../domain/brisage';
import { IMPORTANCE_LEVELS, MAX_THRESHOLD, MIN_THRESHOLD, acceptedGap, hasScaledGap, statImportance, type DealCalibration } from '../../domain/good-deals';
import { isThreshold } from './deal-calibration';

// specs/080-bons-plans-filtre-calibrage (US2): what a player can set for themselves, for every item. Only what
// differs from the defaults of specs/079 is kept in the calibration.

function without<T>(entries: Record<number, T> | undefined, effectId: number): Record<number, T> {
  const others = { ...entries };
  delete others[effectId];
  return others;
}

function compact(calibration: DealCalibration): DealCalibration {
  const kept: DealCalibration = {};
  if (calibration.importance && Object.keys(calibration.importance).length > 0) kept.importance = calibration.importance;
  if (calibration.gaps && Object.keys(calibration.gaps).length > 0) kept.gaps = calibration.gaps;
  if (calibration.thresholdPercent !== undefined) kept.thresholdPercent = calibration.thresholdPercent;
  return kept;
}

function withImportance(calibration: DealCalibration, effectId: number, value: number): DealCalibration {
  const importance = without(calibration.importance, effectId);
  return compact({ ...calibration, importance: value === statImportance(effectId) ? importance : { ...importance, [effectId]: value } });
}

function withGap(calibration: DealCalibration, effectId: number, text: string): DealCalibration {
  const gaps = without(calibration.gaps, effectId);
  const fixedDefault = hasScaledGap(effectId) ? undefined : acceptedGap(effectId, 0);
  // Emptied: the stat stops making defects, which a stat without a default gap already does.
  const neverByDefault = !hasScaledGap(effectId) && fixedDefault === undefined;
  if (text === '') return compact({ ...calibration, gaps: neverByDefault ? gaps : { ...gaps, [effectId]: null } });
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) return calibration;
  return compact({ ...calibration, gaps: value === fixedDefault ? gaps : { ...gaps, [effectId]: value } });
}

function gapText(calibration: DealCalibration, effectId: number): string {
  const own = calibration.gaps?.[effectId];
  if (own !== undefined) return own === null ? '' : String(own);
  return hasScaledGap(effectId) ? '' : String(acceptedGap(effectId, 0) ?? '');
}

const importanceText = (value: number) => (value === 0 ? 'ignorée' : `compte ${value.toLocaleString('fr-FR')} fois`);

function ThresholdField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label>
      Seuil de bon plan (%){' '}
      <input
        type="number" className="good-deal-calibration-threshold" min={MIN_THRESHOLD} max={MAX_THRESHOLD} value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          const typed = Number(event.target.value);
          if (event.target.value !== '' && isThreshold(typed)) onChange(typed);
        }}
        onBlur={() => setDraft(String(value))}
      />
    </label>
  );
}

/** How the calculation works, behind a small button: the panel itself stays a list of settings. */
function CalibrationHelp() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    // On the document: a click on the text takes the focus out of the bubble.
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="good-deal-help" ref={box}>
      <button
        ref={trigger} type="button" className="good-deal-help-button" aria-expanded={open} aria-label="Comment fonctionne le calibrage"
        onClick={() => setOpen(!open)}
      >
        <Icon name="info" />
      </button>
      {open && (
        <div className="good-deal-help-text">
          <p>
            Chaque annonce est comparée aux exemplaires de jet proche du même objet. Elle devient un bon plan si elle coûte au moins
            le seuil de moins que leur prix médian. Ces réglages restent dans ce navigateur.
          </p>
          <p><strong>Importance</strong> : le poids de la stat dans la valeur du jet.</p>
          <ul>
            {IMPORTANCE_LEVELS.map((level) => <li key={level.value}>{level.label} : {importanceText(level.value)}</li>)}
          </ul>
          <p>
            <strong>Écart accepté</strong> : de combien la stat peut être sous le maximum de l'objet sans compter comme un défaut.
            Deux annonces ne sont comparées que si elles ont les mêmes défauts. Exemple : Force maximum 100, écart 5 : 95 est correct, 94 est un défaut.
          </p>
          <ul>
            <li>Auto : l'écart dépend du maximum de l'objet (Vitalité, Dommages Critiques).</li>
            <li>Vide : la stat ne fait jamais de défaut.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export function CalibrationPanel({ calibration, defaultThreshold, onChange }: {
  calibration: DealCalibration;
  defaultThreshold: number;
  onChange: (calibration: DealCalibration) => void;
}) {
  return (
    <details className="good-deal-calibration">
      <summary>Calibrer le calcul</summary>
      <div className="good-deal-calibration-head">
        <ThresholdField
          value={calibration.thresholdPercent ?? defaultThreshold}
          onChange={(value) => onChange(compact({ ...calibration, thresholdPercent: value === defaultThreshold ? undefined : value }))}
        />
        <div className="good-deal-calibration-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onChange({})}>Réinitialiser</button>
          <CalibrationHelp />
        </div>
      </div>
      <div className="good-deal-calibration-scroll" role="region" aria-label="Réglages par stat" tabIndex={0}>
        <div className="good-deal-calibration-stat good-deal-calibration-titles" aria-hidden="true">
          <span>Stat</span><span>Importance</span><span>Écart accepté</span>
        </div>
        <ul className="good-deal-calibration-stats">
          {BRISAGE_STATS.map((stat) => (
            <li key={stat.effectId} className="good-deal-calibration-stat">
              <span>{stat.label}</span>
              <select
                aria-label={`Importance de ${stat.label}`} value={statImportance(stat.effectId, calibration)}
                onChange={(event) => onChange(withImportance(calibration, stat.effectId, Number(event.target.value)))}
              >
                {IMPORTANCE_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
              </select>
              <input
                type="number" min="0" aria-label={`Écart accepté de ${stat.label}`}
                placeholder={hasScaledGap(stat.effectId) && calibration.gaps?.[stat.effectId] === undefined ? 'Auto' : 'Aucun'}
                value={gapText(calibration, stat.effectId)}
                onChange={(event) => onChange(withGap(calibration, stat.effectId, event.target.value))}
              />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
