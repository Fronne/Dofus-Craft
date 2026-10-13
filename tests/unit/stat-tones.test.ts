import { describe, expect, it } from 'vitest';
import { statTone } from '../../src/features/catalogue/stat-tones';

// specs/051-site-visual-refresh (FR-023)
describe('statTone', () => {
  it('gives a characteristic and its resistance the color of their element', () => {
    expect(statTone('tx_vitality')).toBe('vitality');
    expect(statTone('tx_strength')).toBe('earth');
    expect(statTone('tx_intelligenceRes')).toBe('fire');
    expect(statTone('tx_chance')).toBe('water');
    expect(statTone('tx_agilityRes')).toBe('air');
    expect(statTone('tx_wisdom')).toBe('wisdom');
    expect(statTone('tx_crit')).toBe('critical');
    expect(statTone('tx_range')).toBe('range');
  });

  it('falls back to the neutral color for anything else, or without an icon', () => {
    expect(statTone('tx_initiative')).toBe('neutral');
    expect(statTone(undefined)).toBe('neutral');
    expect(statTone('toString')).toBe('neutral');
  });
});
