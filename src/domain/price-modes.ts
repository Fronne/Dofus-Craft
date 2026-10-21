export type PriceMode = 'personal' | 'community';

// Interrupteur unique pour le Mode communautaire (specs/003/004/007). Repasser à `false` le
// désactiverait sans rien retirer : le bouton resterait visible, grisé, avec un badge "Bientôt
// disponible", et `isKnownPriceMode` rejetterait à nouveau 'community' — un joueur déjà en Mode
// communautaire à ce moment-là repasserait automatiquement en mode personnel à la prochaine
// lecture (`getPriceMode`), sans code supplémentaire dédié à cette bascule.
const COMMUNITY_MODE_ENABLED = true;

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
      ? 'Consulter les prix communautaires. Les prix que vous saisissez sont partagés automatiquement et anonymement.'
      : 'Vous pourrez bientôt consulter les prix communautaires et partager anonymement les vôtres.',
    comingSoon: !COMMUNITY_MODE_ENABLED,
  },
];

// What each mode means, worded once for the top bar's tooltip, the page badge and the switch toast.
export const priceModeCopy: Record<PriceMode, { name: string; badge: string; toast: string; details: string[] }> = {
  community: {
    name: 'Mode communautaire',
    badge: 'Prix communautaires',
    toast: 'Mode communautaire activé : prix du groupe affichés, vos saisies sont partagées anonymement.',
    details: [
      'Chaque ressource affiche le dernier prix relevé par le groupe, avec sa date.',
      'Les prix que vous saisissez sont partagés anonymement.',
    ],
  },
  personal: {
    name: 'Mode personnel',
    badge: 'Prix personnels',
    toast: 'Mode personnel activé : seuls vos prix sont utilisés, rien n\'est envoyé.',
    details: [
      'Seuls vos propres prix sont utilisés.',
      'Ils restent sur cet appareil : rien n\'est envoyé.',
    ],
  },
};

export function isKnownPriceMode(value: string): value is PriceMode {
  return priceModes.some((mode) => mode.id === value && !mode.comingSoon);
}
