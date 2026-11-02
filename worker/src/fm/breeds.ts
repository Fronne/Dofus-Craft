// specs/075-connexion-discord-site: the class icons a profile can carry — the ids of the playable classes
// (src/domain/breeds.ts; id 19 does not exist). A test keeps both lists the same.
export const KNOWN_BREED_IDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];

export function isKnownBreedId(value: unknown): value is number {
  return typeof value === 'number' && KNOWN_BREED_IDS.includes(value);
}
