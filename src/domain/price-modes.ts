export type PriceMode = 'personal' | 'community';

// Temporairement désactivé à la demande du joueur : le Mode communautaire n'est pas encore
// terminé. Le bouton reste visible (grisé, avec un badge "Bientôt disponible") pour que les
// joueurs sachent que le mode existe et arrivera bientôt, mais il n'est pas sélectionnable tant
// que ce flag est à `false`. Repasser à `true` pour le réactiver — c'est le seul interrupteur à
// changer, toute la fonctionnalité (persistance, collections, etc.) reste intacte derrière lui.
// Tant qu'il est à `false`, `isKnownPriceMode` continue de rejeter 'community' : un joueur déjà en
// Mode communautaire avant cette désactivation repasse automatiquement en mode personnel à la
// prochaine lecture (`getPriceMode`), sans code supplémentaire dédié à cette bascule.
const COMMUNITY_MODE_ENABLED = false;

type PriceModeOption = { id: PriceMode; label: string; description: string; comingSoon?: boolean };

export const priceModes: PriceModeOption[] = [
  {
    id: 'personal',
    label: 'Mode personnel',
    description: 'Utiliser uniquement mes prix. Mes données ne sont pas partagées.',
  },
  {
    id: 'community',
    label: 'Mode communautaire',
    description: COMMUNITY_MODE_ENABLED
      ? 'Consulter les prix communautaires et contribuer, de façon anonyme et après consentement, au partage des prix.'
      : 'Vous pourrez bientôt consulter les prix communautaires et contribuer, de façon anonyme et après consentement, au partage des prix.',
    comingSoon: !COMMUNITY_MODE_ENABLED,
  },
];

export function isKnownPriceMode(value: string): value is PriceMode {
  return priceModes.some((mode) => mode.id === value && !mode.comingSoon);
}
