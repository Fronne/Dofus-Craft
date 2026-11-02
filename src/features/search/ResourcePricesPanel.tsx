import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import type { Comparison, IngredientChoice, Item, Recipe, RecipeTree, RetainedCost } from '../../domain/types';
import { formatKamas } from '../../domain/kamas';
import type { PriceMode } from '../../domain/price-modes';
import { Icon } from '../../components/Icon';
import { useCountUp } from '../comparison/useCountUp';
import { PriceEntryField } from '../comparison/PriceEntryField';
import { IngredientRow, type PriceFieldProps } from './IngredientRow';

// The craft total, counted from one amount to the next as prices are typed — never from zero.
function CraftTotal({ kamas }: { kamas: number }) {
  return <strong>{formatKamas(useCountUp(kamas, kamas))}</strong>;
}

export function ResourcePricesPanel({
  recipe,
  community,
  serverId,
  selectedItem,
  refresh,
  onRefresh,
  reload,
  priceMode,
  inputs,
  setInputs,
  carnet,
  topCosts,
  firstCraftable,
  result,
  recipeTree,
  expandedPaths,
  onToggle,
  ingredientChoices,
  onChoose,
  error,
}: {
  recipe: Recipe;
  community: boolean;
  serverId: string | undefined;
  selectedItem: Item | undefined;
  refresh: { busy: boolean; message?: string };
  onRefresh: () => void;
  reload: number;
  priceMode: PriceMode;
  inputs: Record<string, string>;
  setInputs: Dispatch<SetStateAction<Record<string, string>>>;
  carnet: ComponentProps<typeof PriceEntryField>['carnet'];
  topCosts: RetainedCost[];
  firstCraftable: number;
  result: Comparison | undefined;
  recipeTree: RecipeTree;
  expandedPaths: ReadonlySet<string>;
  onToggle: (path: string) => void;
  ingredientChoices: Record<string, IngredientChoice>;
  onChoose: (resourceId: string, choice: IngredientChoice | undefined) => void;
  error: string;
}) {
  // One price field, whatever its depth in the craft chain (specs/015 FR-007): same carnet, same
  // Mode personnel / communautaire rules as a top-level ingredient.
  const renderPriceField = ({ resource, quantity, retained, subtotalKamas }: PriceFieldProps) => (
    <PriceEntryField
      resource={resource}
      quantity={quantity}
      priceMode={priceMode}
      serverId={serverId}
      input={inputs[resource.id]}
      // Only updates the locally-typed value — persistence (and therefore "dernière mise à jour")
      // happens once the player is done typing, so it doesn't move on every keystroke.
      onInput={(nextValue) => setInputs((current) => ({ ...current, [resource.id]: nextValue }))}
      carnet={carnet}
      retained={retained}
      subtotalKamas={subtotalKamas}
    />
  );

  return (
    <section className="panel resource-prices" data-tour="resource-prices">
      <div className="prices-head">
        <h2>Prix des ressources</h2>
        {community && serverId && selectedItem && (
          <div className="prices-refresh">
            <button type="button" className="btn btn-secondary btn-small" disabled={refresh.busy} onClick={onRefresh}>
              <Icon name="refresh" size={16} className={refresh.busy ? 'prices-refresh-icon--busy' : undefined} />
              {refresh.busy ? 'Actualisation…' : 'Actualiser les prix'}
            </button>
            {refresh.message && <p role="status">{refresh.message}</p>}
          </div>
        )}
      </div>
      {/* Decorative: every field of a line already names what it is. */}
      <div className="prices-columns" aria-hidden="true">
        <span>Ressource</span>
        <span>Prix unitaire</span>
        <span>Sous-total</span>
      </div>
      {recipe.ingredients.map((ingredient, index) => {
        const path = ingredient.resourceId;
        return (
          <IngredientRow
            // specs/047: mounted again once prices were read again, so the line reads its own.
            key={`${path}:${reload}`}
            path={path}
            quantity={ingredient.quantity}
            cost={topCosts[index]}
            shareOfKamas={result?.knownCraftCostKamas}
            tourTarget={index === firstCraftable ? 'craftable-ingredient' : undefined}
            tree={recipeTree}
            expandedPaths={expandedPaths}
            onToggle={onToggle}
            renderPriceField={renderPriceField}
            choices={ingredientChoices}
            onChoose={onChoose}
          />
        );
      })}
      {/* The same amount as the verdict's craft cost, at the foot of the lines it adds up. */}
      {result && (
        <p className="prices-total">
          <span>Total du craft</span>
          <CraftTotal kamas={result.knownCraftCostKamas} />
          {result.craftCostStatus === 'partial' && <small>(partiel)</small>}
        </p>
      )}
      {error && <p className="warning" role="alert">{error}</p>}
    </section>
  );
}
