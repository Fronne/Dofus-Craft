export type PriceMode = 'personal' | 'community';

type PriceModeOption = { id: PriceMode; label: string; description: string };

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
      'Consulter les prix communautaires et contribuer, de façon anonyme et après consentement, au partage des prix.',
  },
];

export function isKnownPriceMode(value: string): value is PriceMode {
  return priceModes.some((mode) => mode.id === value);
}
