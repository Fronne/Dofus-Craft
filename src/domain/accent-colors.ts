export type AccentColorId = 'blue' | 'red' | 'green' | 'purple' | 'orange';

export type AccentColor = { id: AccentColorId; label: string; swatch: string };

export const accentColors: AccentColor[] = [
  { id: 'blue', label: 'Bleu', swatch: '#3b82f6' },
  { id: 'red', label: 'Rouge', swatch: '#ef4444' },
  { id: 'green', label: 'Vert', swatch: '#22c55e' },
  { id: 'purple', label: 'Violet', swatch: '#a855f7' },
  { id: 'orange', label: 'Orange', swatch: '#f97316' },
];

export function listAccentColors(): AccentColor[] {
  return accentColors;
}

export function isKnownAccentColorId(accentColorId: string): accentColorId is AccentColorId {
  return accentColors.some((accent) => accent.id === accentColorId);
}
