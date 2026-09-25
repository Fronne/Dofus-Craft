import type { PriceMode } from '../../domain/price-modes';

// specs/011-search-onboarding (data-model.md): one step of a guided tour. `target` is the value of
// the `data-tour` attribute of the page area to highlight; without it (or when that area isn't
// currently rendered) the step shows as a centered bubble, followed by `absentHint` if any (FR-008).
// `body` is a single short sentence; any detail goes into `points`, a short list keyed by the
// page's own label, so a bubble reads at a glance (FR-004).
export type TourPoint = { term: string; text: string };

export type TourStep = {
  id: string;
  target?: string;
  title: string;
  body: string;
  points?: TourPoint[];
  absentHint?: string;
  // Shown instead of `absentHint` when the target isn't on screen: a still example of the area, so
  // the step always has something concrete to look at (specs/011 révision 2026-09-25).
  absentExample?: 'craftable-ingredient';
  // A wider bubble, for a step with more to show.
  wide?: boolean;
};

const NEEDS_ITEM = 'Cette zone apparaît après avoir choisi un objet.';
const NEEDS_CRAFTABLE_ITEM = 'Cette zone apparaît après avoir choisi un objet craftable.';
const STALE_POINT: TourPoint = { term: 'Prix surligné', text: 'ancien, vérifiez le prix à l\'HDV' };

// FR-003 order (revised: HDV price and verdict right after the search), FR-004 (one sentence and at
// most three points per bubble), FR-012 (the page's own labels). "Dernière mise à jour" means
// something different per mode since the community date became the last group contribution, so
// both the resource step and the final step follow the active mode.
export function searchTourSteps(priceMode: PriceMode): TourStep[] {
  const community = priceMode === 'community';
  return [
    {
      id: 'search',
      target: 'search',
      title: 'Rechercher un objet',
      body: 'Tapez le nom d\'un objet ou d\'une panoplie, puis choisissez un résultat.',
      points: [{ term: 'Catégorie et niveau', text: 'pour affiner la liste' }],
    },
    {
      id: 'market-price',
      target: 'market-price',
      title: 'Prix HDV',
      body: 'Saisissez le prix de l\'objet à l\'hôtel des ventes.',
      absentHint: NEEDS_CRAFTABLE_ITEM,
    },
    {
      id: 'recommendation',
      target: 'recommendation',
      title: 'Crafter ou acheter ?',
      body: 'Le coût de craft est comparé au Prix HDV pour indiquer le plus rentable.',
      points: [{ term: '(partiel)', text: 'il manque le prix d\'une ressource' }],
      absentHint: NEEDS_CRAFTABLE_ITEM,
    },
    {
      id: 'recipe',
      target: 'item-detail',
      title: 'La fiche de l\'objet',
      body: 'Les caractéristiques de l\'objet.',
      points: [{ term: 'Suivre', text: 'pour le garder sous la main' }],
      absentHint: NEEDS_ITEM,
    },
    {
      id: 'resource-prices',
      target: 'resource-prices',
      title: 'Prix des ressources',
      body: community
        ? 'Pré-rempli avec le prix de la dernière contribution, modifiable à tout moment.'
        : 'Saisissez le prix de chaque ressource, il est gardé pour la prochaine fois.',
      points: community
        ? [
          { term: 'Dernière mise à jour', text: 'date de la dernière contribution' },
          { term: 'N contributions', text: 'nombre de prix partagés' },
          STALE_POINT,
        ]
        : [
          { term: 'Dernière mise à jour', text: 'date de votre saisie' },
          STALE_POINT,
        ],
      absentHint: NEEDS_CRAFTABLE_ITEM,
    },
    {
      // specs/015-intermediate-craft-costs: an ingredient that crafts itself counts for the cheaper
      // of buying it and crafting it.
      id: 'intermediate',
      target: 'craftable-ingredient',
      title: 'Ingrédients craftables',
      body: 'Un ingrédient qui se crafte est compté au moins cher, acheté ou crafté.',
      points: [
        { term: 'Voir la recette', text: 'ses ressources, pour toute la quantité' },
        { term: 'Auto', text: 'choisit automatiquement la méthode la moins chère' },
        { term: 'Acheter · Crafter', text: 'imposer l\'une ou l\'autre' },
      ],
      absentExample: 'craftable-ingredient',
      wide: true,
    },
    {
      id: 'price-mode',
      title: community ? 'Vous êtes en Mode communautaire' : 'Vous êtes en Mode personnel',
      body: 'Changez de mode dans Paramètres.',
      points: [
        { term: 'Mode communautaire', text: 'prix partagés anonymement avec le groupe' },
        { term: 'Mode personnel', text: 'prix gardés sur cet appareil' },
      ],
    },
  ];
}
