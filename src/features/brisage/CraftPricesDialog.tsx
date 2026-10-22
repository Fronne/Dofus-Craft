import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import { getItemDetail } from '../../data/catalogue-repository';
import { compare } from '../../domain/craft-comparison';
import { effectiveIngredientPrices, retainedCost, treeResourceIds } from '../../domain/craft-tree';
import { formatKamas, parseKamas } from '../../domain/kamas';
import type { PriceMode } from '../../domain/price-modes';
import type { Recipe, Resource, ResourcePrice, RetainedCost, ServerId } from '../../domain/types';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { PriceEntryField } from '../comparison/PriceEntryField';
import { useIngredientChoices } from '../comparison/useIngredientChoices';
import { useRecipeTree } from '../comparison/useRecipeTree';
import { useResourcePrices } from '../comparison/useResourcePrices';
import { IngredientRow, type PriceFieldProps } from '../search/IngredientRow';

// specs/070-atelier-prix-craft-brisage: the prices of the resources of an item's craft chain, edited without leaving
// Brisage. Nothing here is its own: the lines, the price fields and the total are the ones of Recherche, over the same
// carnet of the active mode, so a price typed here is the one Recherche and Épingles read. Closing the window hands
// control back to the page, which reads the carnets again.

type Loaded = { recipe: Recipe; resources: Resource[] };
type DetailState = { status: 'loading' } | { status: 'failed' } | { status: 'no-recipe' } | ({ status: 'ready' } & Loaded);

/** Every craftable line of the chain, by path — the lines the window shows unfolded. */
function craftablePaths(cost: RetainedCost, path: string, into: Set<string>) {
  if (cost.children === undefined) return;
  into.add(path);
  for (const child of cost.children) craftablePaths(child.cost, `${path}>${child.cost.resourceId}`, into);
}

/** The resources of the chain that count for nothing yet: no price, or a craftable one with a missing price below. */
function missingResourceIds(cost: RetainedCost, into: Set<string>) {
  if (cost.option === 'missing' && cost.children === undefined) into.add(cost.resourceId);
  cost.children?.forEach((child) => missingResourceIds(child.cost, into));
}

function CraftPricesBody({
  recipe, resources, serverId, priceMode, track, listRef,
}: {
  recipe: Recipe;
  resources: Resource[];
  serverId: ServerId;
  priceMode: PriceMode;
  /** Registers a write to the carnet, so closing waits for it. */
  track: <T>(write: Promise<T>) => Promise<T>;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const tree = useRecipeTree(recipe, resources);
  const ids = treeResourceIds(recipe, tree);
  const { data, save, remove, error, loaded } = useResourcePrices(serverId, ids, resourcePricesFor(priceMode));
  const { choices, setChoice } = useIngredientChoices();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());

  // The prices typed and not yet saved count at once, so the total follows the typing (FR-005).
  const merged: Record<string, ResourcePrice> = {};
  for (const id of ids) {
    const typed = inputs[id];
    const price = typed === undefined ? data[id]?.unitPriceKamas : parseKamas(typed);
    if (price !== undefined && Number.isFinite(price)) merged[id] = { resourceId: id, unitPriceKamas: price, updatedAt: data[id]?.updatedAt ?? '' };
  }

  const topCosts = recipe.ingredients.map((ingredient) => retainedCost(ingredient.resourceId, tree, merged, choices, new Set([recipe.itemId])));
  const craftable = new Set<string>();
  topCosts.forEach((cost) => craftablePaths(cost, cost.resourceId, craftable));
  const expanded = new Set([...craftable].filter((path) => !folded.has(path)));
  const toggle = (path: string) => setFolded((current) => {
    const next = new Set(current);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });

  const result = compare(recipe, effectiveIngredientPrices(recipe, tree, merged, choices));
  const missing = new Set<string>();
  topCosts.forEach((cost) => missingResourceIds(cost, missing));

  // The first price is ready to be replaced as soon as the window opens (FR-007).
  useEffect(() => {
    listRef.current?.querySelector<HTMLInputElement>('input[aria-label^="Prix de "]')?.focus();
  }, [listRef]);

  // Enter validates the field (usePriceEntry) and moves on to the next price, in the order of the lines.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
    const fields = [...(listRef.current?.querySelectorAll<HTMLInputElement>('input[aria-label^="Prix de "]') ?? [])];
    // On the last price the field was just left to save it: the focus comes back to it instead of being lost.
    (fields[fields.indexOf(event.target) + 1] ?? event.target).focus();
  };

  const renderPriceField = ({ resource, quantity, retained, subtotalKamas }: PriceFieldProps) => (
    <PriceEntryField
      resource={resource}
      quantity={quantity}
      priceMode={priceMode}
      serverId={serverId}
      input={inputs[resource.id]}
      onInput={(next) => setInputs((current) => ({ ...current, [resource.id]: next }))}
      carnet={{
        data,
        save: (resourceId, price, updatedAt) => track(save(resourceId, price, updatedAt)),
        remove: (resourceId) => track(remove(resourceId)),
        loaded,
      }}
      retained={retained}
      subtotalKamas={subtotalKamas}
    />
  );

  const names = [...missing].map((id) => tree.resources[id]?.name ?? id);
  return (
    <>
      {error && <p className="fm-error" role="alert">{error}</p>}
      {/* The keydown only follows the focus: the list is a plain group of price fields. */}
      <div className="craft-prices-list" ref={listRef} onKeyDown={onKeyDown}>
        {topCosts.map((cost, index) => (
          <IngredientRow
            key={cost.resourceId}
            path={cost.resourceId}
            quantity={recipe.ingredients[index].quantity}
            cost={cost}
            tree={tree}
            expandedPaths={expanded}
            onToggle={toggle}
            renderPriceField={renderPriceField}
            choices={choices}
            onChoose={setChoice}
          />
        ))}
      </div>
      <div className="craft-prices-total">
        {result.craftCostStatus === 'complete' ? (
          <p><span>Total du craft</span> <b>{formatKamas(result.knownCraftCostKamas)}</b></p>
        ) : (
          <p>
            <span>Total du craft incomplet</span>
            {result.knownCraftCostKamas > 0 && <small>Prix connus : {formatKamas(result.knownCraftCostKamas)}</small>}
          </p>
        )}
        {names.length > 0 && <p className="fm-note craft-prices-missing">Prix manquant : {names.join(', ')}</p>}
      </div>
    </>
  );
}

export function CraftPricesDialog({
  itemId, itemName, serverId, priceMode, onClose,
}: {
  itemId: string;
  itemName: string;
  serverId: ServerId;
  priceMode: PriceMode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pending = useRef(new Set<Promise<unknown>>());
  const closing = useRef(false);
  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDetail({ status: 'loading' });
    getItemDetail(itemId)
      .then((found) => {
        if (cancelled) return;
        setDetail(found.recipe ? { status: 'ready', recipe: found.recipe, resources: found.resources } : { status: 'no-recipe' });
      })
      .catch(() => {
        if (!cancelled) setDetail({ status: 'failed' });
      });
    return () => { cancelled = true; };
  }, [itemId, attempt]);

  const track = <T,>(write: Promise<T>): Promise<T> => {
    pending.current.add(write);
    // The caller keeps the original promise and its failure; this one only forgets the write once settled.
    write.then(() => pending.current.delete(write), () => pending.current.delete(write));
    return write;
  };

  // Leaving the field in progress saves it; closing waits for the writes, so the page reads them all (FR-006).
  const requestClose = async () => {
    if (closing.current) return;
    closing.current = true;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await Promise.allSettled([...pending.current]);
    dialogRef.current?.close();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="craft-prices-dialog"
      aria-label={`Prix du craft de ${itemName}`}
      onCancel={(event) => {
        event.preventDefault();
        void requestClose();
      }}
      // The browser can also close the dialog without a cancel (a second Escape): the page is told all the same.
      onClose={() => void requestClose()}
      // A click on the backdrop lands on the dialog itself; its padding is on the panel inside, so only the backdrop counts.
      onClick={(event: MouseEvent<HTMLDialogElement>) => {
        if (event.target === event.currentTarget) void requestClose();
      }}
    >
      <div className="craft-prices-panel">
        <header className="craft-prices-head">
          <h2>Prix du craft · {itemName}</h2>
          <button type="button" className="btn btn-small" onClick={() => void requestClose()}>Fermer</button>
        </header>
        {detail.status === 'loading' && <p className="fm-note" role="status">Lecture de la recette…</p>}
        {detail.status === 'no-recipe' && <p className="fm-note">Aucun craft n'existe pour cet objet.</p>}
        {detail.status === 'failed' && (
          <div role="alert">
            <p className="fm-error">La recette de cet objet n'a pas pu être lue.</p>
            <button type="button" className="btn btn-small" onClick={() => setAttempt((count) => count + 1)}>Réessayer</button>
          </div>
        )}
        {detail.status === 'ready' && (
          <CraftPricesBody recipe={detail.recipe} resources={detail.resources} serverId={serverId} priceMode={priceMode} track={track} listRef={listRef} />
        )}
      </div>
    </dialog>
  );
}
