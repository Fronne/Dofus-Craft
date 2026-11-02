import { useRef, useState } from 'react';
import { resolveItemPrice } from '../../domain/brisage-price';
import type { PriceMode } from '../../domain/price-modes';
import type { StoredCoefficient } from '../../persistence/brisage-coefficients';
import type { PriceSource } from '../../persistence/brisage-session';
import { parse, type PickedItem } from './brisageHelpers';
import { useItemCost } from './useItemCost';
import { useItemCraftCost } from './useItemCraftCost';

/**
 * The price of the open item and its coefficient. specs/062 + specs/065: the price of the item is the HDV price noted on
 * Recherche, the cost of its craft chain, or the cheaper of the two (Auto). Both are read as soon as an item is picked so
 * they can be shown side by side. A typed price fills in when the chosen source has none; a zero or negative price is
 * never accepted.
 */
export function useBrisageCost(
  serverId: string | undefined,
  item: PickedItem | undefined,
  priceMode: PriceMode,
  priceSource: PriceSource,
  manualCost: string,
  coefficientText: string,
  shownCoefficient: StoredCoefficient | undefined,
) {
  const hdvCost = useItemCost(serverId, item?.id, priceMode);
  // specs/070-atelier-prix-craft-brisage: the craft prices window writes to the carnets; closing it reads them again.
  const [craftPricesOpen, setCraftPricesOpen] = useState(false);
  const [craftReloadKey, setCraftReloadKey] = useState(0);
  const craftPricesButton = useRef<HTMLButtonElement>(null);
  const craftCost = useItemCraftCost(serverId, item?.id, priceMode, craftReloadKey);
  const hdvPending = hdvCost.status === 'loading';
  const craftPending = craftCost.status === 'loading';
  const isKnown = (kamas: number | undefined) => kamas !== undefined && kamas > 0;
  // No button chosen yet: the cheaper of the two (the HDV on a tie, or when neither price is known).
  const cheaperSource = isKnown(craftCost.costKamas) && (!isKnown(hdvCost.costKamas) || craftCost.costKamas! < hdvCost.costKamas!) ? 'craft' : 'hdv';
  const source: Exclude<PriceSource, 'auto'> = priceSource === 'auto' ? cheaperSource : priceSource;
  const priceLoading = priceSource === 'auto' ? hdvPending || craftPending : source === 'hdv' ? hdvPending : source === 'craft' ? craftPending : false;
  const resolvedPrice = !priceLoading && source !== 'custom' ? resolveItemPrice(hdvCost.costKamas, craftCost.costKamas, source) : undefined;
  const typedPrice = parse(manualCost);
  const typedCoefficient = parse(coefficientText);
  const coefficient = typedCoefficient > 0 ? typedCoefficient : shownCoefficient?.coefficient ?? NaN;
  const cost = resolvedPrice?.kamas ?? (typedPrice > 0 ? typedPrice : NaN);
  const priceOrigin = resolvedPrice
    ? (resolvedPrice.origin === 'craft' ? `Coût de la chaîne de craft (${priceMode === 'community' ? 'mode communautaire' : 'mode personnel'})` : 'Prix noté sur la page Recherche')
    : typedPrice > 0 ? (source === 'custom' ? 'Prix personnalisé' : 'Saisi à la main') : undefined;
  const noPriceReason = source === 'custom' ? 'Saisis le prix à utiliser.' : source === 'craft'
    ? (craftCost.reason === 'no-recipe'
      ? 'Aucun craft n\'existe pour cet objet.'
      : 'Prix de craft incomplet (ressource sans prix).')
    : 'Aucun prix connu pour cet objet.';

  return {
    hdvCost, craftCost, craftPricesOpen, setCraftPricesOpen, setCraftReloadKey, craftPricesButton,
    source, priceLoading, resolvedPrice, coefficient, cost, priceOrigin, noPriceReason,
  };
}
