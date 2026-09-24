// specs/014-admin-counters: the 19 playable classes (DofusDB /breeds, id 19 does not exist) and
// their official head portraits, extracted from the Dofus client into public/class-heads/.
export type Sex = 'm' | 'f';

export const BREEDS: { id: number; name: string }[] = [
  { id: 1, name: 'Féca' },
  { id: 2, name: 'Osamodas' },
  { id: 3, name: 'Enutrof' },
  { id: 4, name: 'Sram' },
  { id: 5, name: 'Xélor' },
  { id: 6, name: 'Ecaflip' },
  { id: 7, name: 'Eniripsa' },
  { id: 8, name: 'Iop' },
  { id: 9, name: 'Crâ' },
  { id: 10, name: 'Sadida' },
  { id: 11, name: 'Sacrieur' },
  { id: 12, name: 'Pandawa' },
  { id: 13, name: 'Roublard' },
  { id: 14, name: 'Zobal' },
  { id: 15, name: 'Steamer' },
  { id: 16, name: 'Eliotrope' },
  { id: 17, name: 'Huppermage' },
  { id: 18, name: 'Ouginak' },
  { id: 20, name: 'Forgelance' },
];

export function isKnownBreedId(id: unknown): id is number {
  return typeof id === 'number' && BREEDS.some((breed) => breed.id === id);
}

export function breedName(id: number): string {
  return BREEDS.find((breed) => breed.id === id)?.name ?? '';
}

// Head_{class}{0 = male, 1 = female}.png, as named in the game's class_assets bundle.
export function portraitUrl(breedId: number, sex: Sex): string {
  return `/class-heads/Head_${breedId}${sex === 'f' ? 1 : 0}.png`;
}
