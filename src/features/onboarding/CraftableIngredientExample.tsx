import type { RetainedCost } from '../../domain/types';
import { formatKamas } from '../../domain/kamas';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { RetainedCostIndicator } from '../search/IngredientRow';

// specs/011 révision 2026-09-25 / specs/015: what the "Ingrédients craftables" tour step shows when
// no craftable line is on screen — a still picture of one, drawn with the real line styles and the
// real buy/craft indication, so the player sees the feature concretely. Purely illustrative: not
// focusable, hidden from assistive tech (the bubble's own text already says everything).
const PLANCHE = { id: '16489', name: 'Planche Agglomérée', imageUrl: 'https://api.dofusdb.fr/img/items/95093.png' };
const BOIS = { id: '303', name: 'Bois de Frêne', imageUrl: 'https://api.dofusdb.fr/img/items/38017.png' };
const COST: RetainedCost = {
  resourceId: PLANCHE.id,
  purchaseKamas: 5000,
  recipeKamas: 2000,
  option: 'craft',
  forced: false,
  unitKamas: 2000,
  children: [{ quantity: 10, cost: { resourceId: BOIS.id, purchaseKamas: 200, option: 'buy', forced: false, unitKamas: 200 } }],
};

export function CraftableIngredientExample() {
  return (
    <div className="tour-example" aria-hidden="true" inert>
      <p className="tour-example-caption">Exemple</p>
      <div className="ingredient-row">
        <div className="price-line">
          <span className="price-resource"><ResourceDisplay resource={PLANCHE} /></span>
          <span className="price-resource-quantity">× 2</span>
          <span className="tour-example-price">{formatKamas(5000)}</span>
          <b className="price-resource-formatted">{formatKamas(4000)}</b>
          <span className="retained-cost-row">
            <RetainedCostIndicator cost={COST} />
            <span className="ingredient-choice">
              <button type="button" tabIndex={-1} aria-pressed="true">Auto</button>
              <button type="button" tabIndex={-1} aria-pressed="false">Acheter</button>
              <button type="button" tabIndex={-1} aria-pressed="false">Crafter</button>
            </span>
            <span className="ingredient-toggle" data-expanded="true">Masquer la recette</span>
          </span>
        </div>
        <div className="ingredient-children">
          <div className="ingredient-row">
            <div className="price-line">
              <span className="price-resource"><ResourceDisplay resource={BOIS} /></span>
              <span className="price-resource-quantity">× 20</span>
              <span className="tour-example-price">{formatKamas(200)}</span>
              <b className="price-resource-formatted">{formatKamas(4000)}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
