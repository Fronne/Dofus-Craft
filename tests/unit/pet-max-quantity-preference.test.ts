import { beforeEach, describe, expect, it } from 'vitest';
import { getPetMaxQuantity, setPetMaxQuantity } from '../../src/persistence/pet-max-quantity-preference';

// specs/022 FR-008b: the « Quantité max » kept on the device.
describe('pet max quantity preference', () => {
  beforeEach(() => window.localStorage.clear());

  it('is 50 000 until the player sets it', () => {
    expect(getPetMaxQuantity()).toBe(50_000);
  });

  it('remembers a value, and the absence of a cap once the field is emptied', () => {
    setPetMaxQuantity(120_000);
    expect(getPetMaxQuantity()).toBe(120_000);
    setPetMaxQuantity(undefined);
    expect(getPetMaxQuantity()).toBeUndefined();
  });

  it('falls back to 50 000 on anything unreadable', () => {
    window.localStorage.setItem('craftcheck-pet-max-quantity', '"beaucoup"');
    expect(getPetMaxQuantity()).toBe(50_000);
    window.localStorage.setItem('craftcheck-pet-max-quantity', '-3');
    expect(getPetMaxQuantity()).toBe(50_000);
    window.localStorage.setItem('craftcheck-pet-max-quantity', '{');
    expect(getPetMaxQuantity()).toBe(50_000);
  });
});
