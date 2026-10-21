import { Icon } from '../../components/Icon';
import { MAX_COEFFICIENT } from '../../domain/brisage';
import type { ResolvedPrice } from '../../domain/brisage-price';
import type { StoredCoefficient } from '../../persistence/brisage-coefficients';
import type { PriceSource } from '../../persistence/brisage-session';
import { Kamas } from '../prices/PricesPage';

// specs/065-refonte-page-brisage (US2, US3): the item picked, and the two settings every figure of the table depends
// on, within reach: where its price comes from (Achat or Craft — the cheaper one is lit first — or Perso, typed by the player) and its coefficient.

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

type ChosenSource = Exclude<PriceSource, 'auto'>;

const SOURCES: { id: ChosenSource; label: string }[] = [
  { id: 'hdv', label: 'Achat' },
  { id: 'craft', label: 'Craft' },
  { id: 'custom', label: 'Perso' },
];

export function ItemHeader({
  item, priceSource, onPriceSource, loading, hdvKamas, craftKamas, resolved, originText, manualCost, onManualCost, noPriceReason,
  stored, coefficientText, onCoefficientText, onRememberCoefficient,
}: {
  item: { name: string; level?: number; imageUrl?: string };
  priceSource: ChosenSource;
  onPriceSource: (source: ChosenSource) => void;
  loading: boolean;
  hdvKamas: number | undefined;
  craftKamas: number | undefined;
  resolved: ResolvedPrice | undefined;
  /** Where the kept price comes from, or "Saisi à la main". */
  originText: string | undefined;
  manualCost: string;
  onManualCost: (text: string) => void;
  noPriceReason: string;
  stored: StoredCoefficient | undefined;
  coefficientText: string;
  onCoefficientText: (text: string) => void;
  onRememberCoefficient: () => void;
}) {
  return (
    <div className="brisage-item-head">
      <div className="brisage-identity">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} />
        ) : (
          <div className="image-fallback" role="img" aria-label={`Visuel indisponible pour ${item.name}`}><Icon name="search" size={22} /></div>
        )}
        <div className="brisage-identity-main">
        <div className="item-head-text">
          <h2>{item.name}</h2>
          {item.level !== undefined && <p className="fm-note">Niveau {item.level}</p>}
        </div>

      <div className="brisage-field brisage-price-field">
        <span className="brisage-field-label" id="brisage-price-label">Prix de l'objet</span>
        <div className="brisage-price-line">
          <div className="brisage-price-source" role="radiogroup" aria-labelledby="brisage-price-label">
            {SOURCES.map((source) => (
              <label key={source.id} className={priceSource === source.id ? 'is-selected' : undefined}>
                <input className="visually-hidden" type="radio" name="brisage-price-source" value={source.id} checked={priceSource === source.id} onChange={() => onPriceSource(source.id)} />
                <span>{source.label}</span>
              </label>
            ))}
          </div>
          {loading && <span className="fm-note">Calcul…</span>}
          {!loading && resolved && priceSource !== 'custom' && <span className="brisage-cost"><Kamas value={resolved.kamas} /></span>}
          {!loading && (!resolved || priceSource === 'custom') && (
            <>
              <label className="visually-hidden" htmlFor="brisage-cost-input">Prix de l'objet (kamas)</label>
              <input id="brisage-cost-input" type="number" inputMode="numeric" min={1} placeholder="Prix en kamas" value={manualCost} onChange={(event) => onManualCost(event.target.value)} />
            </>
          )}
        </div>
        {!loading && (resolved || originText) && <span className="brisage-price-origin">{originText}</span>}
        {!loading && !resolved && !originText && <span className="fm-note">{noPriceReason}</span>}
        {!loading && hdvKamas !== undefined && craftKamas !== undefined && (
          <span className="fm-note brisage-both-prices">Achat <Kamas value={hdvKamas} /> · Craft <Kamas value={craftKamas} /></span>
        )}
      </div>
        </div>
      </div>

      <div className="brisage-field brisage-coef-field">
        <label className="brisage-field-label" htmlFor="brisage-coefficient">Coefficient de brisage (%)</label>
        <div className="brisage-coef">
          <input
            id="brisage-coefficient"
            type="number" inputMode="decimal" min={1} max={MAX_COEFFICIENT}
            placeholder={stored ? String(stored.coefficient) : 'à saisir'}
            className={stored ? undefined : 'is-missing'}
            value={coefficientText}
            onChange={(event) => onCoefficientText(event.target.value)}
            onBlur={onRememberCoefficient}
          />
          <span aria-hidden="true">%</span>
        </div>
        {stored && (
          <span className="fm-note" id="brisage-last">
            Dernier coefficient : <b>{number.format(stored.coefficient)} %</b> ({date.format(new Date(stored.savedAt))})
          </span>
        )}
      </div>
    </div>
  );
}
