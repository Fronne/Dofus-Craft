export type PriceMode = 'personal' | 'community';

export type PriceModeOption = { id: PriceMode; label: string; description: string };

export const priceModes: PriceModeOption[] = [
  {
    id: 'personal',
    label: 'Mode personnel',
    description: 'Utiliser uniquement mes prix. Mes données ne sont pas partagées.',
  },
  {
    id: 'community',
    label: 'Mode communautaire',
    description:
      'Consulter les prix de la communauté et contribuer au partage des prix — bientôt disponible.',
  },
];

export function listPriceModes(): PriceModeOption[] {
  return priceModes;
}

export function isKnownPriceMode(value: string): value is PriceMode {
  return priceModes.some((mode) => mode.id === value);
}
