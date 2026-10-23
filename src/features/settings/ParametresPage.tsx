import { Icon } from '../../components/Icon';
import { priceModes } from '../../domain/price-modes';
import type { PriceMode } from '../../domain/price-modes';
import type { DofusId } from '../../domain/dofus-themes';
import { DofusPicker } from './DofusPicker';

export function ParametresPage({
  theme,
  setTheme,
  dofus,
  setDofus,
  priceMode,
  setPriceMode,
}: {
  theme: 'dark' | 'light';
  setTheme: (value: 'dark' | 'light') => void;
  dofus: DofusId;
  setDofus: (value: DofusId) => void;
  priceMode: PriceMode;
  setPriceMode: (value: PriceMode) => void;
}) {
  return (
    <>
      <header className="page-header">
        <h1>Paramètres</h1>
        <p>Personnalisez l'apparence et la gestion de vos prix.</p>
      </header>

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
        <h2>Dofus</h2>
        <p className="settings-section-description">
          Choisissez le Dofus dont le site prend les couleurs.
        </p>
        <DofusPicker dofus={dofus} setDofus={setDofus} />
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
