import type { CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { accentColors } from '../../domain/accent-colors';
import type { AccentColorId } from '../../domain/accent-colors';
import { designs } from '../../domain/designs';
import type { DesignId } from '../../domain/designs';
import { priceModes } from '../../domain/price-modes';
import type { PriceMode } from '../../domain/price-modes';

export function ParametresPage({
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  priceMode,
  setPriceMode,
  design,
  setDesign,
}: {
  theme: 'dark' | 'light';
  setTheme: (value: 'dark' | 'light') => void;
  accentColor: AccentColorId;
  setAccentColor: (value: AccentColorId) => void;
  priceMode: PriceMode;
  setPriceMode: (value: PriceMode) => void;
  design: DesignId;
  setDesign: (value: DesignId) => void;
}) {
  return (
    <>
      <header className="page-header">
        <h1>Paramètres</h1>
        <p>Personnalisez l'apparence et la gestion de vos prix.</p>
      </header>

      <section className="panel settings-section">
        <h2>Design</h2>
        <p className="settings-section-description">
          Choisissez entre le design moderne et le design classique ; vous pouvez en changer à tout moment.
        </p>
        <div className="settings-choice-row">
          {designs.map((option) => (
            <button
              key={option.id}
              type="button"
              className={design === option.id ? 'settings-choice selected' : 'settings-choice'}
              aria-pressed={design === option.id}
              onClick={() => setDesign(option.id)}
            >
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel settings-section">
        <h2>Thème</h2>
        <p className="settings-section-description">
          Choisissez l'apparence claire ou sombre de l'application.
        </p>
        <div className="settings-choice-row">
          <button
            type="button"
            className={theme === 'light' ? 'settings-choice selected' : 'settings-choice'}
            aria-pressed={theme === 'light'}
            onClick={() => setTheme('light')}
          >
            <Icon name="sun" size={18} />
            <span>Thème clair</span>
          </button>
          <button
            type="button"
            className={theme === 'dark' ? 'settings-choice selected' : 'settings-choice'}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            <Icon name="moon" size={18} />
            <span>Thème sombre</span>
          </button>
        </div>
      </section>

      <section className="panel settings-section">
        <h2>Couleur principale</h2>
        <p className="settings-section-description">
          Utilisée pour les boutons, les éléments actifs, les liens et la sélection, quel que soit
          le thème choisi.
        </p>
        <div className="settings-swatch-row">
          {accentColors.map((accent) => (
            <button
              key={accent.id}
              type="button"
              className={accentColor === accent.id ? 'accent-swatch selected' : 'accent-swatch'}
              style={{ '--swatch-color': accent.swatch } as CSSProperties}
              aria-label={accent.label}
              aria-pressed={accentColor === accent.id}
              onClick={() => setAccentColor(accent.id)}
            />
          ))}
        </div>
      </section>

      <section className="panel settings-section">
        <h2>Gestion des prix</h2>
        <p className="settings-section-description">
          Le mode actif est mis en évidence ci-dessous.
        </p>
        <div className="settings-price-mode-list">
          {priceModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={[
                'price-mode-option',
                priceMode === mode.id ? 'selected' : '',
                mode.comingSoon ? 'price-mode-option-disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={priceMode === mode.id}
              disabled={mode.comingSoon}
              onClick={() => setPriceMode(mode.id)}
            >
              <span className="price-mode-option-label">
                {mode.label}
                {mode.comingSoon && (
                  <span className="price-mode-option-badge">Bientôt disponible</span>
                )}
              </span>
              <span className="price-mode-option-description">{mode.description}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
