import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { priceModeCopy, priceModes } from '../../domain/price-modes';
import type { PriceMode } from '../../domain/price-modes';

const OPTIONS: { id: PriceMode; label: string; icon: 'users' | 'user'; title: string }[] = [
  { id: 'community', label: 'Communauté', icon: 'users', title: 'Communauté, prix partagés avec le groupe' },
  { id: 'personal', label: 'Perso', icon: 'user', title: 'Perso, prix gardés sur cet appareil' },
];

// Two-pill switch in the top bar: one click flips the price mode (same state as Paramètres).
// Hovering or focusing a pill opens a tooltip saying what the mode shows and what it sends.
export function PriceModeSwitch({ priceMode, setPriceMode }: {
  priceMode: PriceMode;
  setPriceMode: (value: PriceMode) => void;
}) {
  // Échap hides the open tooltip until the pointer or focus leaves its pill.
  const [dismissed, setDismissed] = useState<PriceMode | null>(null);
  return (
    <div className="price-mode-switch" role="group" aria-label="Mode de prix">
      {OPTIONS.map((option) => {
        const copy = priceModeCopy[option.id];
        const active = priceMode === option.id;
        const tipId = `price-mode-tip-${option.id}`;
        return (
          <span
            className="price-mode-switch-item"
            key={option.id}
            data-dismissed={dismissed === option.id ? '' : undefined}
            onMouseLeave={() => setDismissed(null)}
            onBlur={() => setDismissed(null)}
            onKeyDown={(event) => { if (event.key === 'Escape') setDismissed(option.id); }}
          >
            <button
              type="button"
              className={`price-mode-switch-option${active ? ' selected' : ''}`}
              data-mode={option.id}
              aria-pressed={active}
              aria-label={option.title}
              aria-describedby={tipId}
              disabled={priceModes.some((mode) => mode.id === option.id && mode.comingSoon)}
              onClick={() => setPriceMode(option.id)}
            >
              <Icon name={option.icon} size={16} />
              <span className="price-mode-switch-label">{option.label}</span>
            </button>
            <span className="price-mode-tip" role="tooltip" id={tipId}>
              <strong className="price-mode-tip-title">
                {copy.name}
                {active && <span className="price-mode-tip-state">actif</span>}
              </strong>
              {copy.details.map((line) => <span className="price-mode-tip-line" key={line}>{line}</span>)}
              {!active && <span className="price-mode-tip-action">Cliquer pour passer en {copy.name.toLowerCase()}.</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}
