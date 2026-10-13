// specs/051-site-visual-refresh (FR-023): the color of the diamond drawn in front of an effect, by
// characteristic. Presentation only: the key is the characteristic's icon name (see
// domain/characteristic-icons.ts), the value the suffix of a `--stat-*` token of theme.css.
export type StatTone = 'vitality' | 'earth' | 'fire' | 'water' | 'air' | 'wisdom' | 'critical' | 'range' | 'neutral';

const TONE_BY_ICON: Record<string, StatTone> = {
  tx_vitality: 'vitality',
  tx_lifePoints: 'vitality',
  tx_heal: 'vitality',
  tx_strength: 'earth',
  tx_strengthRes: 'earth',
  tx_intelligence: 'fire',
  tx_intelligenceRes: 'fire',
  tx_chance: 'water',
  tx_chanceRes: 'water',
  tx_agility: 'air',
  tx_agilityRes: 'air',
  tx_wisdom: 'wisdom',
  tx_crit: 'critical',
  tx_criticalDamage: 'critical',
  tx_criticalReduction: 'critical',
  tx_range: 'range',
};

// A characteristic without a color of its own (or without an icon at all) gets the neutral one.
export function statTone(icon?: string): StatTone {
  return icon && Object.hasOwn(TONE_BY_ICON, icon) ? TONE_BY_ICON[icon] : 'neutral';
}
