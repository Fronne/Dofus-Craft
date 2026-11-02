import { EmptyState } from '../../components/EmptyState';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { Kamas } from '../prices/PricesPage';
import { classifyPriceAge } from '../../domain/price-age';
import { formatPriceUpdate } from '../../domain/price-update';
import { Icon } from '../../components/Icon';
import type { PetFoodRecommendation, PetFoodSort, PetFoodSortKey } from '../../domain/pet-xp';

const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });

// Clicking a column header sorts the whole priced list by it: first click in the most useful direction
// (A → Z, most XP per unit, cheapest), second click the other way.
const COLUMNS: { key: PetFoodSortKey; label: string; first: PetFoodSort['direction'] }[] = [
  { key: 'name', label: 'Ressource', first: 'asc' },
  { key: 'xpPerUnit', label: 'XP', first: 'desc' },
  { key: 'unitPrice', label: 'Prix unitaire', first: 'asc' },
  { key: 'quantity', label: 'Quantité', first: 'asc' },
  { key: 'total', label: 'Coût total', first: 'asc' },
];

function SortHeader({ sort, onSort }: { sort: PetFoodSort; onSort: (sort: PetFoodSort) => void }) {
  return (
    <div className="profit-head pet-food-row" role="group" aria-label="Trier la liste">
      {COLUMNS.map((column) => {
        const active = sort.key === column.key;
        const button = (
          <button
            key={column.key}
            type="button"
            className={`profit-sort${active ? ' profit-sort--active' : ''}`}
            aria-pressed={active}
            aria-label={`Trier par ${column.label}`}
            onClick={() => onSort({
              key: column.key,
              direction: active ? (sort.direction === 'asc' ? 'desc' : 'asc') : column.first,
            })}
          >
            {column.label}
            {active && <span aria-hidden="true">{sort.direction === 'desc' ? ' ↓' : ' ↑'}</span>}
          </button>
        );
        // specs/055 FR-009: the rank, by total cost, heads the resource column; it does not sort.
        return column.key === 'name'
          ? <span key={column.key} className="pet-food-name-head"><span className="pet-food-rank">Rang</span>{button}</span>
          : button;
      })}
    </div>
  );
}

function FoodLine({ line, rank }: { line: PetFoodRecommendation; rank?: number }) {
  const age = classifyPriceAge(line.priceDate);
  const ageClass = age === 'stale' ? ' market-date--stale' : age === 'expired' ? ' market-date--expired' : '';
  return (
    <li className="profit-row pet-food-row">
      <div className="profit-row-main">
        <span className="pet-food-rank">{rank}</span>
        <ResourceDisplay resource={{ id: line.food.itemId, name: line.food.name, imageUrl: line.food.imageUrl }} />
      </div>
      <div className="profit-cell">
        <span className="profit-cell-label">XP</span>
        <b>{numberFormat.format(line.xpPerUnit)}</b>
      </div>
      <div className="profit-cell">
        <span className="profit-cell-label">Prix unitaire</span>
        <b><Kamas value={line.unitPriceKamas} /></b>
        {line.lotSize > 1 && <small>prix du lot ×{line.lotSize}</small>}
        <small className={`market-date${ageClass}`}>
          {line.priceDate ? formatPriceUpdate(line.priceDate, line.priceAuthor) : 'date inconnue'}
        </small>
      </div>
      <div className="profit-cell">
        <span className="profit-cell-label">Quantité</span>
        <b>{numberFormat.format(line.quantity)}</b>
      </div>
      <div className="profit-cell">
        <span className="profit-cell-label">Coût total</span>
        <b><Kamas value={line.totalKamas} /></b>
      </div>
    </li>
  );
}

interface PetFoodTableProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Goes back to the first lines of the list (a new search or sort). */
  resetShown: () => void;
  sort: PetFoodSort;
  onSort: (sort: PetFoodSort) => void;
  maxQuantity: number | undefined;
  maxQuantityText: string;
  maxQuantityValid: boolean;
  onMaxQuantityChange: (raw: string) => void;
  capped: { shown: PetFoodRecommendation[]; hiddenCount: number };
  /** How many resources have a price once the name search is applied. */
  recommendationCount: number;
  /** How many resources match the name search, priced or not. */
  foodCount: number;
  normalizedQuery: string;
  tableLines: PetFoodRecommendation[];
  visible: PetFoodRecommendation[];
  rankById: Map<string, number>;
  endRef: (element: HTMLDivElement | null) => void;
  loadingMore: boolean;
}

/** The « Toutes les ressources » block: search, cap on the quantity, sortable list of the foods off the podium. */
export function PetFoodTable({
  query, onQueryChange, resetShown, sort, onSort,
  maxQuantity, maxQuantityText, maxQuantityValid, onMaxQuantityChange,
  capped, recommendationCount, foodCount, normalizedQuery,
  tableLines, visible, rankById, endRef, loadingMore,
}: PetFoodTableProps) {
  return (
    <section className="panel profit-panel pet-table" aria-labelledby="pet-table-title">
      <h2 id="pet-table-title">Toutes les ressources</h2>
      <div className="profit-toolbar">
        <div className="search-input-wrap prices-search">
          <Icon name="search" size={18} className="search-input-icon" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              resetShown();
            }}
            placeholder="Filtrer…"
            aria-label="Filtrer les ressources"
          />
        </div>
        <label className="pet-max-quantity">
          <span>Quantité max</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={maxQuantityText}
            placeholder="Aucune"
            aria-invalid={maxQuantityValid ? undefined : true}
            aria-describedby={maxQuantityValid ? undefined : 'pet-max-quantity-error'}
            onChange={(event) => onMaxQuantityChange(event.target.value)}
          />
        </label>
        {!maxQuantityValid && (
          <p id="pet-max-quantity-error" className="pet-max-quantity-note field-status--error" role="alert">Nombre entier supérieur à 0.</p>
        )}
        {capped.hiddenCount > 0 && maxQuantity !== undefined && (
          <p className="pet-max-quantity-note">
            {numberFormat.format(capped.hiddenCount)} {capped.hiddenCount === 1 ? 'ressource masquée' : 'ressources masquées'} (plus de {numberFormat.format(maxQuantity)} unités)
          </p>
        )}
      </div>
      {recommendationCount === 0 ? (
        <EmptyState
          icon="search"
          title="Aucune ressource avec un prix ne correspond"
          description={foodCount > 0
            ? `${numberFormat.format(foodCount)} ${foodCount === 1 ? 'ressource correspond' : 'ressources correspondent'}, mais sans prix connu.`
            : 'Essayez un autre nom de ressource.'}
        />
      ) : capped.shown.length === 0 ? (
        <EmptyState
          icon="search"
          title={`Toutes les ressources demandent plus de ${numberFormat.format(maxQuantity ?? 0)} unités`}
          description="Augmentez la quantité max, ou videz le champ pour toutes les voir."
        />
      ) : tableLines.length === 0 ? (
        // Only podium foods are left: the table has nothing else to show (FR-009).
        <p className="pet-block-hint">
          {normalizedQuery
            ? 'Les ressources qui correspondent sont sur le podium, plus haut.'
            : 'Toutes les ressources avec un prix sont sur le podium, plus haut.'}
        </p>
      ) : (
        <>
          <SortHeader sort={sort} onSort={(next) => {
            onSort(next);
            resetShown();
          }} />
          <ul className="profit-list">
            {visible.map((line) => <FoodLine key={line.food.itemId} line={line} rank={rankById.get(line.food.itemId)} />)}
          </ul>
          {visible.length < tableLines.length && (
            <div ref={endRef} className="profit-list-end" role="status">
              {loadingMore && 'Chargement…'}
            </div>
          )}
        </>
      )}
    </section>
  );
}
