import { useEffect, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import type { PriceMode } from '../../domain/price-modes';
import { normalizeSearchText } from '../../services/dofusdb-api';
import {
  PET_FOODS,
  PET_MAX_LEVEL,
  PET_MIN_LEVEL,
  ALMANAX_PET_XP_MULTIPLIER,
  isPetXpAlmanaxDay,
  DEFAULT_PET_FOOD_SORT,
  capPetFoodQuantity,
  petFoodPodium,
  planPetFood,
  rankPetFoods,
  validatePetLevels,
  xpNeeded,
  type PetFoodSort,
  type PetLevelsInput,
} from '../../domain/pet-xp';
import { getPetLevels, setPetLevels } from '../../persistence/pet-levels-preference';
import { getPetMaxQuantity, setPetMaxQuantity } from '../../persistence/pet-max-quantity-preference';
import { usePetFoodPrices } from './usePetFoodPrices';
import { useLoadMoreOnScroll } from '../../hooks/useLoadMoreOnScroll';
import { isIntegerIn, parse, parseCurrentLevel, toText, type Field } from './pet-level-fields';

// The state, the effects and the derived values of the XP Familier page.
export function usePetXpCalculator(priceMode: PriceMode) {
  const { serverId, servers } = useActiveServer();
  const [text, setText] = useState(() => toText(getPetLevels()));
  const [sort, setSort] = useState<PetFoodSort>(DEFAULT_PET_FOOD_SORT);
  const [query, setQuery] = useState('');
  // FR-008b: the « Quantité max » typed, and the cap in force (the last valid value; none when emptied).
  const [maxQuantity, setMaxQuantity] = useState<number | undefined>(() => getPetMaxQuantity());
  const [maxQuantityText, setMaxQuantityText] = useState(() => (maxQuantity === undefined ? '' : String(maxQuantity)));
  const maxQuantityValid = maxQuantityText === '' || (Number.isInteger(Number(maxQuantityText)) && Number(maxQuantityText) > 0);
  // FR-012: on by itself on 23 July, the day of the pet XP Almanax; never remembered.
  const [almanax, setAlmanax] = useState(() => isPetXpAlmanaxDay());
  const levels: PetLevelsInput = {
    totalXp: parse(text.totalXp),
    targetLevel: parse(text.targetLevel),
  };
  const errors = validatePetLevels(levels);
  const valid = Object.keys(errors).length === 0;
  const xp = valid ? xpNeeded(levels) : undefined;
  const fieldErrors: Partial<Record<Field, string>> = {
    ...errors,
    ...(isIntegerIn(parseCurrentLevel(text.currentLevel), PET_MIN_LEVEL, PET_MAX_LEVEL) ? {} : { currentLevel: `Niveau entre ${PET_MIN_LEVEL} et ${PET_MAX_LEVEL}.` }),
  };

  useEffect(() => {
    if (valid) setPetLevels(levels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, levels.totalXp, levels.targetLevel]);

  const [attempt, setAttempt] = useState(0);
  const { status, prices, communityUnavailable } = usePetFoodPrices(serverId, priceMode, attempt);
  // The name search narrows the resources before sorting. Every priced resource is listed, shown 25
  // lines at a time as the end of the list scrolls into view, like Rentabilité (FR-007, revised
  // 2026-09-28); a new search or sort goes back to the first lines.
  const normalizedQuery = normalizeSearchText(query);
  const foods = normalizedQuery ? PET_FOODS.filter((food) => normalizeSearchText(food.name).includes(normalizedQuery)) : PET_FOODS;
  const xpMultiplier = almanax ? ALMANAX_PET_XP_MULTIPLIER : 1;
  const plan = xp !== undefined ? planPetFood(xp, foods, prices, Number.POSITIVE_INFINITY, sort, xpMultiplier) : undefined;
  // FR-008b: lines needing more units than the cap are hidden, before the list is shown in slices.
  const capped = capPetFoodQuantity(plan?.recommendations ?? [], maxQuantity);
  // specs/055: one ranking by total cost, whatever the table's search and sort, gives the podium and
  // every rank shown (research.md §1). The table lists the others.
  const ranked = xp !== undefined ? rankPetFoods(xp, PET_FOODS, prices, maxQuantity, xpMultiplier) : [];
  const podium = petFoodPodium(ranked);
  const rankById = new Map(ranked.map((line) => [line.food.itemId, line.rank]));
  const onPodium = new Set(podium.map((line) => line.food.itemId));
  const tableLines = capped.shown.filter((line) => !onPodium.has(line.food.itemId));
  const { visible, endRef, loadingMore, reset: resetShown } = useLoadMoreOnScroll(tableLines);
  const [targetId, setTargetId] = useState<string>();
  const [targetQuery, setTargetQuery] = useState('');
  const changeMaxQuantity = (raw: string) => {
    setMaxQuantityText(raw);
    const next = raw === '' ? undefined : Number(raw);
    if (next !== undefined && !(Number.isInteger(next) && next > 0)) return;
    setMaxQuantity(next);
    setPetMaxQuantity(next);
    resetShown();
  };
  const unpricedCount = PET_FOODS.filter((food) => !(prices[food.itemId]?.unitPriceKamas > 0)).length;
  const hasAnyPrice = unpricedCount < PET_FOODS.length;
  const serverName = servers.find((server) => server.id === serverId)?.name;
  const retryPrices = () => setAttempt((count) => count + 1);

  return {
    serverId, serverName,
    text, setText, sort, setSort, query, setQuery,
    maxQuantity, maxQuantityText, maxQuantityValid, changeMaxQuantity,
    almanax, setAlmanax,
    levels, errors, xp, fieldErrors,
    status, prices, communityUnavailable, hasAnyPrice, retryPrices,
    normalizedQuery, foods, xpMultiplier, plan, capped, ranked, podium, rankById, tableLines,
    visible, endRef, loadingMore, resetShown,
    targetId, setTargetId, targetQuery, setTargetQuery,
  };
}
