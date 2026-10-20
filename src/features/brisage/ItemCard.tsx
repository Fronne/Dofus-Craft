import type { StoredCoefficient } from '../../persistence/brisage-coefficients';

// specs/065-refonte-page-brisage (US1): a card per item found, drawn like the results of the Recherche page (the
// `.results` styles): picture, name, level and the coefficient already noted for it — or "à saisir" when it was
// never broken here.

export type CardItem = { id: string; name: string; level: number; imageUrl?: string };

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function ItemCard({ item, selected, stored, onPick }: {
  item: CardItem;
  selected: boolean;
  stored: StoredCoefficient | undefined;
  onPick: () => void;
}) {
  return (
    <button type="button" className={selected ? 'selected' : undefined} aria-pressed={selected} onClick={onPick}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" loading="lazy" width="36" height="36" />
      ) : (
        <span className="result-image-fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
      )}
      <span className="result-item-info">
        <span className="result-item-name" title={item.name}>{item.name}</span>
        <span className="result-item-level">Niveau {item.level}</span>
        {stored
          ? <span className="brisage-card-coef">Coef. {number.format(stored.coefficient)} %</span>
          : <span className="brisage-card-coef is-missing">Coef. à saisir</span>}
      </span>
    </button>
  );
}
