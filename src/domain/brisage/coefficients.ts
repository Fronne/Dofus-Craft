// specs/060-page-brisage: is breaking an item profitable, and is a focus worth it? Every formula
// here is an ESTIMATE, not an official rule (spec.md H1–H4); the weights and yields are settings.

/**
 * H1 – the coefficient left after one breaking (Dorel's empirical formula, measured on level 40 items).
 * It is a decimal: the game shows the whole part, so several breaks in a row can show the same value
 * (66 %, 66 %, 65 % was read in game, the loss at 66 % being about 0.11 point).
 */
export function nextCoefficient(coefficient: number): number {
  const loss = (2.63e-5 - 5.958e-10 * coefficient) * coefficient * coefficient;
  return Math.max(0, coefficient - loss);
}

/** The coefficient as the game shows it (whole number, nearest). */
export function displayedCoefficient(coefficient: number): number {
  return Math.round(coefficient);
}

/** A rune count as the game gives it: whole runes only. */
export function wholeRunes(count: number): number {
  return Math.round(count);
}

/** specs/061 (FR-006) – the default roll of a line: the middle of its range, rounded down (1–50 → 25, 5–10 → 7). */
export function averageRoll(from: number, to: number): number {
  return Math.floor((Math.min(from, to) + Math.max(from, to)) / 2);
}

// The loss per breaking is small and shrinks with the coefficient, so a long descent has many steps.
const MAX_DESCENT_STEPS = 20000;
/** A coefficient read in game can go above 100 % (a fresh item, a bonus): only an absurd value is refused. */
export const MAX_COEFFICIENT = 4000;

/**
 * The coefficients at which successive items are broken, from `start` while they stay at or above
 * `threshold`. Its length is the number of items worth breaking.
 */
export function coefficientDescent(start: number, threshold: number): number[] {
  const coefficients: number[] = [];
  let current = start;
  while (current >= threshold && current > 0 && coefficients.length < MAX_DESCENT_STEPS) {
    coefficients.push(current);
    current = nextCoefficient(current);
  }
  return coefficients;
}

/** Lowest coefficient at which breaking still pays: the coefficient where runes' value equals the cost. */
export function minimumProfitableCoefficient(coefficient: number, itemCostKamas: number, runesValueKamas: number): number | undefined {
  if (!(runesValueKamas > 0)) return undefined;
  return (coefficient * itemCostKamas) / runesValueKamas;
}
