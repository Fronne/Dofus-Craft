import { Icon } from '../../components/Icon';
import type { StoredCoefficient } from '../../persistence/brisage-coefficients';

// specs/065-refonte-page-brisage (US1): a small card per item found: picture, name, level and the coefficient
// already noted for it — or "à saisir" when it was never broken here.

export type CardItem = { id: string; name: string; level: number; imageUrl?: string };

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function ItemCard({ item, selected, stored, onPick }: {
  item: CardItem;
  selected: boolean;
  stored: StoredCoefficient | undefined;
  onPick: () => void;
}) {
  return (
    <button type="button" className={selected ? 'brisage-card is-selected' : 'brisage-card'} aria-pressed={selected} onClick={onPick}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" width={44} height={44} loading="lazy" />
      ) : (
        <span className="brisage-card-noimage" aria-hidden="true"><Icon name="search" size={20} /></span>
      )}
      <span className="brisage-card-text">
        <strong>{item.name}</strong>
        <span className="fm-note">Niv. {item.level}</span>
        {stored
          ? <span className="brisage-card-coef">Coef. {number.format(stored.coefficient)} %</span>
          : <span className="brisage-card-coef is-missing">Coef. à saisir</span>}
      </span>
    </button>
  );
}
