import { Icon } from '../../components/Icon';
import { MAX_COEFFICIENT } from '../../domain/brisage';
import type { ResolvedPrice } from '../../domain/brisage-price';
import type { StoredCoefficient } from '../../persistence/brisage-coefficients';
import type { PriceSource } from '../../persistence/brisage-session';
import { Kamas } from '../prices/PricesPage';

// specs/065-refonte-page-brisage (US2, US3): the item picked, and the two settings every figure of the table depends
// on, within reach: where its price comes from (Achat, Craft, or Auto = the cheaper of the two) and its coefficient.

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const SOURCES: { id: PriceSource; label: string }[] = [
  { id: 'hdv', label: 'Achat' },
  { id: 'craft', label: 'Craft' },
  { id: 'auto', label: 'Auto' },
];

export function ItemHeader({
  item, priceSource, onPriceSource, loading, hdvKamas, craftKamas, resolved, originText, manualCost, onManualCost, noPriceReason,
  stored, coefficientText, onCoefficientText, onRememberCoefficient,
}: {
  item: { name: string; level?: number; imageUrl?: string };
  priceSource: PriceSource;
  onPriceSource: (source: PriceSource) => void;
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
      <div className="item-head">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} />
        ) : (
          <div className="image-fallback" role="img" aria-label={`Visuel indisponible pour ${item.name}`}><Icon name="search" size={22} /></div>
        )}
        <div className="item-head-text">
          <h2>{item.name}</h2>
          {item.level !== undefined && <div className="item-head-tags"><p>Niveau : {item.level}</p></div>}
        </div>
      </div>

      <div className="brisage-item">
        <div className="brisage-field">
          <span className="brisage-field-label" id="brisage-price-label">Prix de l'objet</span>
          <div className="brisage-price-source" role="radiogroup" aria-labelledby="brisage-price-label">
            {SOURCES.map((source) => (
              <label key={source.id} className={priceSource === source.id ? 'is-selected' : undefined}>
                <input className="visually-hidden" type="radio" name="brisage-price-source" value={source.id} checked={priceSource === source.id} onChange={() => onPriceSource(source.id)} />
                <span>{source.label}</span>
              </label>
            ))}
          </div>
          {loading && <span className="fm-note">Calcul du prix en cours…</span>}
          {!loading && resolved && (
            <>
              <span className="brisage-cost"><Kamas value={resolved.kamas} /></span>
              <span className="brisage-price-origin">{originText}</span>
            </>
          )}
          {!loading && !resolved && (
            <>
              <label className="visually-hidden" htmlFor="brisage-cost-input">Prix de l'objet (kamas)</label>
              <input id="brisage-cost-input" type="number" inputMode="numeric" min={1} value={manualCost} onChange={(event) => onManualCost(event.target.value)} />
              <span className="fm-note">{noPriceReason}</span>
              {originText && <span className="brisage-price-origin">{originText}</span>}
            </>
          )}
          {!loading && (
            <span className="fm-note brisage-both-prices">
              Achat : {hdvKamas === undefined ? 'inconnu' : <Kamas value={hdvKamas} />} · Craft : {craftKamas === undefined ? 'inconnu' : <Kamas value={craftKamas} />}
            </span>
          )}
        </div>

        <div className="brisage-field">
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
          {stored ? (
            <span className="fm-note" id="brisage-last">
              Dernier coefficient : <b>{number.format(stored.coefficient)} %</b> ({date.format(new Date(stored.savedAt))})
            </span>
          ) : (
            <span className="fm-note">Cet objet n'a pas encore été brisé ici : brisez-le en jeu, puis notez son coefficient.</span>
          )}
        </div>
      </div>
    </div>
  );
}
