import { describe, expect, it } from 'vitest';
import { BREEDS } from '../../src/domain/breeds';
import { isKnownBreedId, KNOWN_BREED_IDS } from '../../worker/src/fm/breeds';

// specs/075-connexion-discord-site: the Worker's list of class ids is a copy of the site's.
describe('the Worker\'s class ids', () => {
  it('are exactly those of the site', () => {
    expect([...KNOWN_BREED_IDS]).toEqual(BREEDS.map((breed) => breed.id));
  });

  it('accept a known class id', () => {
    expect(isKnownBreedId(8)).toBe(true);
    expect(isKnownBreedId(20)).toBe(true);
  });

  it('refuse anything else', () => {
    for (const value of [0, 19, 21, -1, 1.5, '8', null, undefined, NaN]) expect(isKnownBreedId(value)).toBe(false);
  });
});
