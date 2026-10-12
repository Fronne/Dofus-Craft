import runeItems from '../../data/rune-items.json';
import { normalizeItemName, type FmItemSummary } from '../../domain/forgemagie';
import { Kamas } from '../prices/PricesPage';

// specs/049-fm-seances (US1): what was bought — in a séance, a session or a capture — one line per item
// with its quantity, total and average unit price.

const quantityFormat = new Intl.NumberFormat('fr-FR');
const RUNE_ICONS_BY_ID = new Map(runeItems.runes.map((rune) => [rune.id, rune.imageUrl]));
const RUNE_ICONS_BY_NAME = new Map(runeItems.runes.map((rune) => [normalizeItemName(rune.name), rune.imageUrl]));

function runeIcon(item: FmItemSummary): string | undefined {
  return (item.itemId !== null ? RUNE_ICONS_BY_ID.get(item.itemId) : undefined)
    ?? RUNE_ICONS_BY_NAME.get(normalizeItemName(item.itemName))
    ?? undefined;
}

export function PurchasesTable({ items, showTotal = true }: { items: FmItemSummary[]; showTotal?: boolean }) {
  if (items.length === 0) return <p className="empty">Aucun achat détaillé.</p>;
  return (
    <table className="fm-items">
      <thead>
        <tr>
          <th scope="col">Objet</th>
          <th scope="col">Quantité</th>
          <th scope="col">Total</th>
          <th scope="col">Prix moyen</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const icon = runeIcon(item);
          return (
            <tr key={item.itemName}>
              <th scope="row">
                <span className="fm-bought-item">
                  {icon && <img className="fm-bought-icon" src={icon} alt="" width={24} height={24} loading="lazy" />}
                  <span>
                    {item.itemName}
                    {item.readNames && item.readNames.length > 0 && (
                      <span className="fm-correction-read">lu : {item.readNames.join(', ')}</span>
                    )}
                  </span>
                  {item.corrected && <span className="fm-corrected">corrigé</span>}
                </span>
              </th>
              <td>{quantityFormat.format(item.quantity)}</td>
              <td><Kamas value={item.totalKamas} /></td>
              <td><span className="fm-unit-price"><Kamas value={item.averageUnitKamas} />/u</span></td>
            </tr>
          );
        })}
      </tbody>
      {showTotal && items.length > 1 && (
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{quantityFormat.format(items.reduce((sum, item) => sum + item.quantity, 0))}</td>
            <td><Kamas value={items.reduce((sum, item) => sum + item.totalKamas, 0)} /></td>
            <td />
          </tr>
        </tfoot>
      )}
    </table>
  );
}
