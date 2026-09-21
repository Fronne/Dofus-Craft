// Glyphe "kamas" officiel du client Dofus 3 (Unity), extrait de
// StreamingAssets/aa/StandaloneWindows64/spriteassets_assets_2x.bundle (sprite "kama", variante
// haute résolution, dorée) et copié dans public/kamas-icon.png — c'est le même symbole que le jeu
// affiche à côté des montants de kamas dans son interface. Bump ICON_ASSET_VERSION si ce fichier
// est remplacé (voir CharacteristicIcon.tsx pour le même besoin de cache-busting).
const ICON_ASSET_VERSION = 1;
export const KAMAS_ICON_URL = `/kamas-icon.png?v=${ICON_ASSET_VERSION}`;

export function normalizeKamasInput(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatKamasInput(value: string): string {
  const normalized = normalizeKamasInput(value);
  if (!/^\d+$/.test(normalized)) return value;
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function parseKamas(value: string): number | undefined {
  const normalized = normalizeKamasInput(value);
  if (normalized === '') return undefined;
  return /^\d+$/.test(normalized) ? Number(normalized) : undefined;
}

export function isValidKamas(value: string) {
  const normalized = normalizeKamasInput(value);
  return normalized === '' || /^\d+$/.test(normalized);
}

export function formatKamas(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value) + ' kamas';
}

export function formatPercent(value?: number) {
  return value === undefined ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value) + ' %';
}
