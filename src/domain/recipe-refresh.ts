// specs/047-recherche-refresh-prices (contracts/recherche-refresh-ui.md): the rules of the Recherche
// page's « Actualiser les prix » button — which prices it asks the API to read again on Huzounet, and
// what the player is told once the API has answered. Pure: no React, no network.

/** The most ids one request may carry — `REFRESH_MAX_IDS` of worker/src/huzounet.ts. */
export const RECIPE_REFRESH_MAX_IDS = 90;

export type RecipeRefreshOutcome =
  | { status: 'ok'; refreshed: number }
  | { status: 'too-soon' | 'not-read' | 'unavailable' };

// The item shown, then the resources of its whole craft chain: each id once, numeric ids only (the
// only ones the API accepts), and never more than one request can carry — the item first, so it is
// never the one left out.
export function recipeRefreshIds(itemId: string, resourceIds: readonly string[]): string[] {
  return [...new Set([itemId, ...resourceIds])].filter((id) => /^\d+$/.test(id)).slice(0, RECIPE_REFRESH_MAX_IDS);
}

export function recipeRefreshMessage(outcome: RecipeRefreshOutcome): string {
  switch (outcome.status) {
    case 'ok':
      return outcome.refreshed > 0 ? 'Prix actualisés.' : 'Les prix sont déjà à jour.';
    case 'too-soon':
      return 'Réessaie dans quelques secondes.';
    case 'not-read':
      return 'Les prix de ce serveur ne sont pas relus.';
    default:
      return 'Actualisation impossible pour le moment.';
  }
}
