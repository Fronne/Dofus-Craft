import { formatPriceUpdate, formatPriceUpdateTitle } from '../domain/price-update';

// specs/082-auteur-prix-communautaires: « Dernière mise à jour : par Pseudo · il y a 2 h ». The exact date
// is in the title and the label, so a touch screen reader gets it too.
export function PriceUpdateNote({ date, author }: { date: string; author?: string }) {
  const full = formatPriceUpdateTitle(date);
  return (
    <span className="price-update-note" title={full} tabIndex={0} aria-label={`Dernière mise à jour : ${author ? `par ${author}, ` : ''}${full}`}>
      Dernière mise à jour : {formatPriceUpdate(date, author)}
    </span>
  );
}
