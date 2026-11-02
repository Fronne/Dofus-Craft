import type { KeyboardEvent } from 'react';
import runeItems from '../../data/rune-items.json';
import { brisageStat, defaultBrisageSettings, nextCoefficient, type BrisageOption } from '../../domain/brisage';
import type { RuneItemsData } from '../../domain/forgemagie';

// Constants, types and small pure helpers shared by the item page of the Brisage tool (BrisagePage and its parts).

export const RUNES = (runeItems as RuneItemsData).runes;
export const SETTINGS = defaultBrisageSettings();
export const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export type PickedItem = { id: string; name: string; level?: number; imageUrl?: string };
export type Range = { effectId: number; from: number; to: number };

export const parse = (text: string): number => (text.trim() === '' ? NaN : Number(text.replace(/\s/g, '').replace(',', '.')));

export const statLabel = (effectId: number) => brisageStat(effectId)?.label ?? `Effet ${effectId}`;
export const shortRune = (option: BrisageOption) => (option.focusRuneName ?? '').replace('Rune ', '').trim();

/**
 * Enter goes down the column it was pressed in: from the price of a rune to the price of the one below, from a roll to the
 * roll below. A price field has already been left by then (RunePriceInput), which is what saves it; on the last line the
 * focus comes back to the field instead of being lost.
 */
export function enterToNextInColumn(event: KeyboardEvent<HTMLTableSectionElement>) {
  if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
  const column = event.target.classList.contains('brisage-price-input') ? 'input.brisage-price-input'
    : event.target.classList.contains('brisage-roll') ? 'input.brisage-roll' : undefined;
  if (!column) return;
  event.preventDefault();
  const fields = [...event.currentTarget.querySelectorAll<HTMLInputElement>(column)];
  const next = fields[fields.indexOf(event.target) + 1] ?? event.target;
  next.focus();
  next.select();
}

/** The coefficients of the next breaks: each item broken lowers the coefficient (see nextCoefficient). */
export function nextCoefficients(current: number, count: number): number[] {
  const list: number[] = [];
  let value = current;
  for (let i = 0; i < count; i += 1) {
    value = nextCoefficient(value);
    if (!(value > 0)) break;
    list.push(value);
  }
  return list;
}

/** Two lines of the same stat count as one (the analysis adds them up): one row, the ranges added. */
export function mergeRanges(ranges: Range[]): Range[] {
  const merged = new Map<number, Range>();
  for (const range of ranges) {
    const known = merged.get(range.effectId);
    merged.set(range.effectId, known ? { effectId: range.effectId, from: known.from + range.from, to: known.to + range.to } : range);
  }
  return [...merged.values()];
}
