import runeItems from '../../data/rune-items.json';
import { CHARACTERISTIC_ASSET_BY_ID } from '../../domain/characteristic-icons';

// specs/078-bons-plans-hdv: the icon of a stat line. The rune of a stat knows both its effect id (what the
// announcements carry) and its characteristic id (what the icons are filed under).
const CHARACTERISTIC_BY_EFFECT = new Map<number, number>();
for (const rune of (runeItems as { runes: { effectId: number; characteristicId: number | null }[] }).runes) {
  if (rune.characteristicId !== null && !CHARACTERISTIC_BY_EFFECT.has(rune.effectId)) {
    CHARACTERISTIC_BY_EFFECT.set(rune.effectId, rune.characteristicId);
  }
}

/** The icon file name of a stat, or undefined when none is known (the card then shows the label alone). */
export function statIconAsset(effectId: number): string | undefined {
  const characteristicId = CHARACTERISTIC_BY_EFFECT.get(effectId);
  return characteristicId === undefined ? undefined : CHARACTERISTIC_ASSET_BY_ID[characteristicId];
}
