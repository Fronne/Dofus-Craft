import { describe, expect, it } from 'vitest';
import { statIconAsset } from '../../src/features/good-deals/stat-icons';

// specs/078-bons-plans-hdv: the icon of a stat line of an announcement (effect id -> characteristic icon).
describe('statIconAsset', () => {
  it('finds the icon of a known stat through its rune', () => {
    expect(statIconAsset(125)).toBe('tx_vitality');
    expect(statIconAsset(118)).toBe('tx_strength');
  });

  it('answers nothing for a stat no rune carries, so the card shows the label alone', () => {
    expect(statIconAsset(999_999)).toBeUndefined();
  });
});
