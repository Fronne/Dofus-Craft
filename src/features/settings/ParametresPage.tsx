import { useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { accentColors } from '../../domain/accent-colors';
import type { AccentColorId } from '../../domain/accent-colors';
import { priceModes } from '../../domain/price-modes';
import type { PriceMode } from '../../domain/price-modes';
import { listLocalContributions, clearLocalContributions } from '../../persistence/community-contributions';
import { withdrawCommunityContribution } from '../../services/community-price-api';

export function ParametresPage({
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  priceMode,
  setPriceMode,
  shareConsent,
  setShareConsent,
}: {
  theme: 'dark' | 'light';
  setTheme: (value: 'dark' | 'light') => void;
  accentColor: AccentColorId;
  setAccentColor: (value: AccentColorId) => void;
  priceMode: PriceMode;
  setPriceMode: (value: PriceMode) => void;
  shareConsent: boolean;
  setShareConsent: (value: boolean) => void;
}) {
  const [contributions, setContributions] = useState(() => listLocalContributions());
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState(false);

  async function handleWithdrawAll() {
    const confirmed = window.confirm(
      'Retirer définitivement toutes vos contributions déjà envoyées à la communauté ? Cette action est irréversible.',
    );
    if (!confirmed) return;
    setWithdrawing(true);
    setWithdrawError(false);
    const results = await Promise.all(
      contributions.map((entry) => withdrawCommunityContribution(entry.id)),
    );
    setWithdrawing(false);
    if (results.every(Boolean)) {
      clearLocalContributions();
      setContributions([]);
    } else {
      setWithdrawError(true);
    }
  }
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
          Le mode actuellement actif est facilement identifiable ci-dessous.
        </p>
        <div className="settings-price-mode-list">
          {priceModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={
                priceMode === mode.id ? 'price-mode-option selected' : 'price-mode-option'
              }
              aria-pressed={priceMode === mode.id}
              onClick={() => setPriceMode(mode.id)}
            >
              <span className="price-mode-option-label">{mode.label}</span>
              <span className="price-mode-option-description">{mode.description}</span>
            </button>
          ))}
        </div>
      </section>

      {priceMode === 'community' && (
        <section className="panel settings-section">
          <h2>Partage communautaire</h2>
          <p className="settings-section-description">
            Donnez votre consentement pour contribuer, de façon anonyme, vos prix personnels à la
            communauté. Ce choix est distinct du mode de gestion des prix et n'active aucun envoi
            tant qu'il n'est pas donné.
          </p>
          <div className="settings-choice-row">
            <button
              type="button"
              className={shareConsent ? 'settings-choice selected' : 'settings-choice'}
              aria-pressed={shareConsent}
              onClick={() => setShareConsent(true)}
            >
              <Icon name="check" size={18} />
              <span>Partager mes prix</span>
            </button>
            <button
              type="button"
              className={!shareConsent ? 'settings-choice selected' : 'settings-choice'}
              aria-pressed={!shareConsent}
              onClick={() => setShareConsent(false)}
            >
              <Icon name="close" size={18} />
              <span>Ne pas partager</span>
            </button>
          </div>
          {shareConsent && (
            <p className="settings-section-confirmation">
              Partage actif : vos prix personnels peuvent désormais être envoyés anonymement.
            </p>
          )}
          {contributions.length > 0 && (
            <div className="settings-withdraw-contributions">
              <button
                type="button"
                className="settings-choice"
                disabled={withdrawing}
                onClick={() => void handleWithdrawAll()}
              >
                <Icon name="close" size={18} />
                <span>
                  Retirer mes {contributions.length}{' '}
                  contribution{contributions.length > 1 ? 's' : ''} déjà envoyées
                </span>
              </button>
              {withdrawError && (
                <p className="warning">
                  Le retrait a échoué pour au moins une contribution. Réessayez plus tard.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
