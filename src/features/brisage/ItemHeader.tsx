import { useRef, type RefObject } from 'react';
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

const SOURCES: { id: 'hdv' | 'craft'; label: string }[] = [
  { id: 'hdv', label: 'Achat' },
  { id: 'craft', label: 'Craft' },
];

export function ItemHeader({
  item, priceSource, onPriceSource, loading, hdvKamas, craftKamas, resolved, originText, manualCost, onManualCost, noPriceReason,
  stored, coefficientText, onCoefficientText, onRememberCoefficient, onForgetCoefficient, canEditCraftPrices, onOpenCraftPrices, craftPricesButtonRef,
}: {
  item: { id: string; name: string; level?: number; imageUrl?: string };
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
  /** « Coefficient unknown »: forgets the coefficient noted for the item. */
  onForgetCoefficient: () => void;
  /** specs/070-atelier-prix-craft-brisage: the item has a recipe, so its resource prices can be edited here. */
  canEditCraftPrices: boolean;
  onOpenCraftPrices: () => void;
  craftPricesButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  // The side to go back to when the custom price is dropped: the last real source seen, else the cheaper known one.
  const lastReal = useRef<{ itemId: string; source: 'hdv' | 'craft' } | undefined>(undefined);
  if (priceSource !== 'custom') lastReal.current = { itemId: item.id, source: priceSource };
  const remembered = lastReal.current?.itemId === item.id ? lastReal.current.source : undefined;
  const custom = priceSource === 'custom';
  const base = custom ? remembered ?? (hdvKamas !== undefined && (craftKamas === undefined || hdvKamas <= craftKamas) ? 'hdv' : 'craft') : priceSource;

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
          {/* One switch, each side showing its own price. "Perso" is not a side: the pencil turns the lit side's amount into a field. */}
          <div className="brisage-price-source" role="radiogroup" aria-labelledby="brisage-price-label" data-side={base} data-custom={custom || undefined}>
            <span className="brisage-switch-thumb" aria-hidden="true" />
            {SOURCES.map((source) => {
              const kamas = source.id === 'hdv' ? hdvKamas : craftKamas;
              const lit = base === source.id;
              return (
                <label key={source.id} className={[lit ? 'is-selected' : '', custom ? 'is-overridden' : ''].filter(Boolean).join(' ') || undefined}>
                  <input className="visually-hidden" type="radio" name="brisage-price-source" value={source.id} checked={lit && !custom} onChange={() => onPriceSource(source.id)} />
                  <span>{source.label}</span>
                  <span className={lit && !custom ? 'brisage-cost' : 'brisage-seg-price'}>
                    {loading ? '…' : kamas !== undefined ? <Kamas value={kamas} /> : '—'}
                  </span>
                </label>
              );
            })}
          </div>
          {!custom && resolved && (
            <button type="button" className="brisage-perso-button" aria-label="Saisir un prix perso" title="Saisir un prix perso" onClick={() => onPriceSource('custom')}>
              <Icon name="edit" size={14} />
            </button>
          )}
          {loading && <span className="fm-note">Calcul…</span>}
          {!loading && (!resolved || custom) && (
            <div className="brisage-perso-field">
              <label className="visually-hidden" htmlFor="brisage-cost-input">Prix de l'objet (kamas)</label>
              <input id="brisage-cost-input" type="number" inputMode="numeric" min={1} placeholder="Prix en kamas" value={manualCost} onChange={(event) => onManualCost(event.target.value)} />
              {custom && (
                <>
                  <span className="brisage-price-origin">Prix perso</span>
                  <button type="button" className="brisage-perso-button" aria-label="Revenir au prix normal" title="Revenir au prix normal" onClick={() => onPriceSource(base)}>
                    <Icon name="close" size={14} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {/* The link sits with the note that says where the craft price comes from: it opens the prices behind it. */}
        <div className="brisage-price-notes">
          {!loading && (resolved || originText) && <span className="brisage-price-origin">{originText}</span>}
          {!loading && !resolved && !originText && <span className="brisage-price-origin">{noPriceReason}</span>}
          {canEditCraftPrices && (
            <button ref={craftPricesButtonRef} type="button" className="brisage-craft-prices-button" onClick={onOpenCraftPrices}>
              <Icon name="edit" size={14} />
              <span>Modifier le prix des ressources</span>
            </button>
          )}
        </div>
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
            {' '}<button type="button" className="brisage-craft-prices-button" onClick={onForgetCoefficient}>Effacer (coefficient inconnu)</button>
          </span>
        )}
      </div>
    </div>
  );
}
