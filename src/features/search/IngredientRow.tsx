import type { ReactNode } from 'react';
import type { IngredientChoice, RecipeTree, Resource, RetainedCost } from '../../domain/types';
import { formatKamas } from '../../domain/kamas';

const OPTION_LABELS: Record<RetainedCost['option'], string> = {
  buy: 'Acheté',
  craft: 'Crafté',
  missing: 'Prix manquant',
};

// specs/015 FR-005 (contracts/recipe-tree-ui.md): on a craftable line, which option is counted and
// both amounts behind that choice — the unit purchase price (carnet) and the unit recipe cost
// (derived, never stored) — so the player can check the pick (constitution, principle III).
export function RetainedCostIndicator({ cost }: { cost: RetainedCost }) {
  return (
    <span className={`retained-cost retained-cost--${cost.option}`}>
      <span className="retained-cost-option">{OPTION_LABELS[cost.option]}</span>
      {cost.forced && <span className="retained-cost-forced"> (ton choix)</span>}
      <span className="retained-cost-amounts">
        {cost.purchaseKamas !== undefined && <span>Achat : {formatKamas(cost.purchaseKamas)}/u</span>}
        {cost.purchaseKamas !== undefined && cost.recipeKamas !== undefined && ' · '}
        {cost.recipeKamas !== undefined && <span>Craft : {formatKamas(cost.recipeKamas)}/u</span>}
      </span>
    </span>
  );
}

const CHOICE_OPTIONS: { label: string; choice: IngredientChoice | undefined }[] = [
  { label: 'Auto', choice: undefined },
  { label: 'Acheter', choice: 'buy' },
  { label: 'Crafter', choice: 'craft' },
];

// Everything a line needs to draw its price field — the page owns the carnet, the typed values and
// the Mode personnel / communautaire behaviour, so it renders the field; this row only adds the
// retained-cost indication, the unfold button and, once unfolded, the sub-resource lines.
export type PriceFieldProps = {
  resource: Resource;
  quantity: number;
  retained?: ReactNode;
  subtotalKamas?: number | null;
};

// specs/015 US2 (contracts/recipe-tree-ui.md): one ingredient line at any depth of the craft chain.
// `quantity` is cumulative (unit quantity × every parent line's quantity), and so is the subtotal.
// A line only offers to unfold when it's craftable here — its cost has children, i.e. its recipe is
// known and it isn't a cycle. Unfolded state lives in the page (`expandedPaths`), keyed by the
// line's path, so the page knows which lines are on screen.
export function IngredientRow({
  path,
  quantity,
  cost,
  tree,
  expandedPaths,
  onToggle,
  renderPriceField,
  choices,
  onChoose,
  tourTarget,
}: {
  path: string;
  quantity: number;
  cost: RetainedCost;
  tree: RecipeTree;
  expandedPaths: ReadonlySet<string>;
  onToggle: (path: string) => void;
  renderPriceField: (props: PriceFieldProps) => ReactNode;
  choices: Record<string, IngredientChoice>;
  onChoose: (resourceId: string, choice: IngredientChoice | undefined) => void;
  // The guided tour's `data-tour` target (specs/011), set on the first craftable top-level line.
  tourTarget?: string;
}) {
  const resource = tree.resources[cost.resourceId] ?? { id: cost.resourceId, name: cost.resourceId };
  const children = cost.children;
  const expanded = children !== undefined && expandedPaths.has(path);
  const retained = children !== undefined ? (
    <span className="retained-cost-row">
      <RetainedCostIndicator cost={cost} />
      {/* US3: force buying or crafting this resource — everywhere it appears, on this device. */}
      <span className="ingredient-choice" role="group" aria-label={`Choix pour ${resource.name}`}>
        {CHOICE_OPTIONS.map(({ label, choice }) => (
          <button
            key={label}
            type="button"
            aria-pressed={choices[cost.resourceId] === choice}
            onClick={(event) => {
              event.preventDefault();
              onChoose(cost.resourceId, choice);
            }}
          >
            {label}
          </button>
        ))}
      </span>
      <button
        type="button"
        className="ingredient-toggle"
        aria-expanded={expanded}
        aria-label={expanded ? `Masquer la recette de ${resource.name}` : `Afficher la recette de ${resource.name}`}
        onClick={(event) => {
          // The line is a <label>: keep the click from also focusing its price field.
          event.preventDefault();
          onToggle(path);
        }}
      >
        {expanded ? 'Masquer la recette' : 'Voir la recette'}
      </button>
    </span>
  ) : undefined;
  const subtotalKamas = children !== undefined
    ? cost.unitKamas === undefined ? null : cost.unitKamas * quantity
    : undefined;

  return (
    <div className="ingredient-row" data-tour={tourTarget}>
      {renderPriceField({ resource, quantity, retained, subtotalKamas })}
      {expanded && (
        <div className="ingredient-children">
          {children.map((child) => {
            const childPath = `${path}>${child.cost.resourceId}`;
            return (
              <IngredientRow
                key={childPath}
                path={childPath}
                quantity={child.quantity * quantity}
                cost={child.cost}
                tree={tree}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                renderPriceField={renderPriceField}
                choices={choices}
                onChoose={onChoose}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
