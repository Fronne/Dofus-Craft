// specs/074-dofus-color-themes (data-model.md): the six primordial Dofus the player can pick as the
// site's color theme. The palettes themselves live in theme.css, one per id and per mode; index.html
// repeats the ids, icons and colors for its early script (tests/unit/dofus-themes.test.ts keeps both
// in step).
export type DofusId = 'emeraude' | 'pourpre' | 'turquoise' | 'ocre' | 'ebene' | 'ivoire';

export type DofusTheme = {
  id: DofusId;
  name: string;
  // The item on DofusDB the picture comes from, so the source stays traceable.
  dofusDbId: number;
  image: string;
  // Page background of the dark palette, for the browser's address bar.
  themeColor: string;
};

export const DEFAULT_DOFUS: DofusId = 'emeraude';
export const DOFUS_STORAGE_KEY = 'craftcheck-dofus';

export const dofusThemes: readonly DofusTheme[] = [
  { id: 'emeraude', name: 'Dofus Émeraude', dofusDbId: 737, image: '/dofus-emeraude.png', themeColor: '#08181c' },
  { id: 'pourpre', name: 'Dofus Pourpre', dofusDbId: 694, image: '/dofus-pourpre.png', themeColor: '#180d0c' },
  { id: 'turquoise', name: 'Dofus Turquoise', dofusDbId: 739, image: '/dofus-turquoise.png', themeColor: '#0b1119' },
  { id: 'ocre', name: 'Dofus Ocre', dofusDbId: 7754, image: '/dofus-ocre.png', themeColor: '#17140c' },
  { id: 'ebene', name: 'Dofus Ébène', dofusDbId: 7114, image: '/dofus-ebene.png', themeColor: '#131211' },
  { id: 'ivoire', name: 'Dofus Ivoire', dofusDbId: 7115, image: '/dofus-ivoire.png', themeColor: '#14130f' },
];

export function isDofusId(value: unknown): value is DofusId {
  return dofusThemes.some((dofus) => dofus.id === value);
}

export function dofusById(id: DofusId): DofusTheme {
  return dofusThemes.find((dofus) => dofus.id === id) ?? dofusThemes[0];
}

// An unknown, missing or unreadable choice is the emerald, the theme the site always had.
export function readStoredDofus(storage: Pick<Storage, 'getItem'>): DofusId {
  try {
    const stored = storage.getItem(DOFUS_STORAGE_KEY);
    return isDofusId(stored) ? stored : DEFAULT_DOFUS;
  } catch {
    return DEFAULT_DOFUS;
  }
}
