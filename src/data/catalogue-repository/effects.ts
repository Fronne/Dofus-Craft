import { cached } from '../catalogue-cache';
import { getDofusDbEffects, getDofusDbItem } from '../../services/dofusdb-api';
import type { ItemStat } from '../../domain/types';
import type { DofusDbEffect, DofusDbItemEffect } from '../../services/dofusdb-types';
import { CHARACTERISTIC_ASSET_BY_ID, ELEMENT_ASSET_BY_ID } from '../../domain/characteristic-icons';
import { negativeStatId } from '../../domain/brisage';

/** The icon of a characteristic; damage/steal effects (characteristic 0) use their element instead. */
function characteristicIcon(characteristicId: number | undefined, elementId: number | undefined, category: number | undefined): string | undefined {
  return characteristicId === 0 && elementId !== undefined
    ? (elementId === -1 ? (category === 2 ? CHARACTERISTIC_ASSET_BY_ID[16] : undefined) : ELEMENT_ASSET_BY_ID[elementId])
    : characteristicId !== undefined ? CHARACTERISTIC_ASSET_BY_ID[characteristicId] : undefined;
}

// Long enough to gather what several items ask around the same moment, too short to be seen.
const EFFECT_GATHERING_MS = 20;

type WaitingEffect = { resolve: (effect: DofusDbEffect | null) => void; reject: (reason: unknown) => void };
const waitingEffects = new Map<number, WaitingEffect[]>();

function askWaitingEffects() {
  const batch = new Map(waitingEffects);
  waitingEffects.clear();
  getDofusDbEffects([...batch.keys()]).then((effects) => {
    const byId = new Map(effects.map((effect) => [effect.id, effect]));
    batch.forEach((waiting, effectId) => waiting.forEach(({ resolve }) => resolve(byId.get(effectId) ?? null)));
  }, (error: unknown) => batch.forEach((waiting) => waiting.forEach(({ reject }) => reject(error))));
}

/** Several items open at once share their effects: what is asked in the same moment goes out in one request. */
function loadEffect(effectId: number): Promise<DofusDbEffect | null> {
  return new Promise((resolve, reject) => {
    if (waitingEffects.size === 0) setTimeout(askWaitingEffects, EFFECT_GATHERING_MS);
    waitingEffects.set(effectId, [...(waitingEffects.get(effectId) ?? []), { resolve, reject }]);
  });
}

export async function mapItemStats(
  item: Awaited<ReturnType<typeof getDofusDbItem>>,
  signal?: AbortSignal,
): Promise<ItemStat[]> {
  const effects = (item.effects ?? []).filter((effect) =>
    typeof effect.effectId === 'number' && typeof effect.from === 'number' && typeof effect.to === 'number');
  if (!effects.length) return [];
  const metadata = (await Promise.all(
    [...new Set(effects.map((effect) => effect.effectId!))].map((effectId) => cached(`effect:${effectId}`, () => loadEffect(effectId))),
  )).filter((effect) => effect !== null);
  signal?.throwIfAborted();
  const descriptions = new Map(metadata.map((effect) => [effect.id, effect.description?.fr]));
  const characteristics = new Map(metadata.map((effect) => [effect.id, effect.characteristic]));
  const elements = new Map(metadata.map((effect) => [effect.id, effect.elementId]));
  return effects
    .map((effect, index) => {
      const characteristicId = characteristics.get(effect.effectId!);
      const elementId = elements.get(effect.effectId!);
      // Damage/steal effects report characteristic 0, which coincides with the
      // real "Points de vie" characteristic id: use their element instead. Some of them (e.g.
      // "dommages/vol du meilleur/pire élément") have no fixed element (elementId -1) and use the
      // generic "Dommage" icon in the game's own tooltip instead of an elemental one.
      const icon = characteristicIcon(characteristicId, elementId, effect.category);
      return {
        id: `${effect.effectId}-${index}`,
        label: formatEffectDescription(descriptions.get(effect.effectId!), effect.from!, effect.to!),
        icon,
        positive: effect.from! >= 0 && effect.to! >= 0,
        isWeaponEffect: effect.category === 2,
      };
    })
    .sort((a, b) => Number(!a.positive) - Number(!b.positive));
}

function formatEffectDescription(template: string | undefined, from: number, to: number): string {
  const values = getDisplayedEffectValues(from, to);
  if (!template) {
    return values.fixed
      ? `Effet ${values.minimum}`
      : `Effet ${values.minimum} à ${values.maximum}`;
  }
  const formatted = template
    .replace(/\{\{~1~2([^}]*)\}\}/g, values.fixed ? '' : '$1')
    .replace(/#1/g, values.fixed ? '' : String(values.minimum))
    .replace(/#2/g, String(values.maximum))
    .replace(/\{\{~[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/--/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return formatted;
}

function getDisplayedEffectValues(from: number, to: number): {
  minimum: number;
  maximum: number;
  fixed: boolean;
} {
  if (from === to) return { minimum: from, maximum: to, fixed: true };
  if (to === 0) return { minimum: from, maximum: from, fixed: true };
  if (from === 0) return { minimum: to, maximum: to, fixed: true };
  return { minimum: from, maximum: to, fixed: false };
}

// specs/060-page-brisage (FR-002, FR-008): the numeric lines of an item, for the breaking estimate.
// Weapon effects and negative or empty lines can't be broken into runes and are left out; a line
// that rolls between two values keeps its maximum.
export async function getItemEffectLines(id: string): Promise<{ effectId: number; value: number }[]> {
  const item = await cached(`item:${id}`, () => getDofusDbItem(id));
  const lines: { effectId: number; value: number }[] = [];
  for (const effect of item.effects ?? []) {
    if (typeof effect.effectId !== 'number' || typeof effect.from !== 'number' || typeof effect.to !== 'number') continue;
    if (effect.category === 2) continue;
    const value = Math.max(effect.from, effect.to);
    if (value > 0 && effect.from >= 0 && effect.to >= 0) lines.push({ effectId: effect.effectId, value });
  }
  return lines;
}

// specs/061-simplification-page-brisage (FR-006): the same lines with their roll range, so the page can
// start from the average roll. DofusDB writes a fixed effect as `to: 0`: that is a range of one value.
type EffectRange = { effectId: number; from: number; to: number };

// specs/064-recherche-objets-par-stats (T001): the rule that turns DofusDB effect lines into rolls, shared by
// the Brisage page and by the index of items scripts/build-brisage-items.mjs writes (which repeats it —
// keep both in step).
export function effectRangesOf(effects: DofusDbItemEffect[] | undefined): EffectRange[] {
  const ranges: EffectRange[] = [];
  for (const effect of effects ?? []) {
    if (typeof effect.effectId !== 'number' || typeof effect.from !== 'number' || typeof effect.to !== 'number') continue;
    if (effect.category === 2) continue;
    if (!(Math.max(effect.from, effect.to) > 0 && effect.from >= 0 && effect.to >= 0)) continue;
    ranges.push(effect.to === 0
      ? { effectId: effect.effectId, from: effect.from, to: effect.from }
      : { effectId: effect.effectId, from: Math.min(effect.from, effect.to), to: Math.max(effect.from, effect.to) });
  }
  return ranges;
}

export async function getItemEffectRanges(id: string): Promise<EffectRange[]> {
  const item = await cached(`item:${id}`, () => getDofusDbItem(id));
  return effectRangesOf(item.effects);
}

// specs/067-brisage-lignes-negatives: the negative lines (maluses) of an item, kept apart from effectRangesOf so the
// search index (spec 064) and scripts/build-brisage-items.mjs still see positive rolls only.
export function negativeRangesOf(effects: DofusDbItemEffect[] | undefined): EffectRange[] {
  const ranges: EffectRange[] = [];
  for (const effect of effects ?? []) {
    if (typeof effect.effectId !== 'number' || typeof effect.from !== 'number' || typeof effect.to !== 'number') continue;
    if (effect.category === 2) continue;
    if (!(Math.min(effect.from, effect.to) < 0 && effect.from <= 0 && effect.to <= 0)) continue;
    // The id is the one of the stat the malus takes away (-Force 157 → Force 118), so the page finds its weight and rune.
    const effectId = negativeStatId(effect.effectId);
    ranges.push(effect.to === 0
      ? { effectId, from: effect.from, to: effect.from }
      : { effectId, from: Math.min(effect.from, effect.to), to: Math.max(effect.from, effect.to) });
  }
  return ranges;
}

export async function getItemNegativeRanges(id: string): Promise<EffectRange[]> {
  const item = await cached(`item:${id}`, () => getDofusDbItem(id));
  return negativeRangesOf(item.effects);
}
