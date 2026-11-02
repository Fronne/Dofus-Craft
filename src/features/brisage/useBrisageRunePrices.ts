import { useMemo, useState } from 'react';
import { runeForStat } from '../../domain/brisage';
import { exoCandidates } from '../../domain/brisage-ranking';
import type { PriceMode } from '../../domain/price-modes';
import type { ExoEntry } from './ExoRow';
import { RUNES, SETTINGS, type Range } from './brisageHelpers';
import { useRunePrices } from './useRunePrices';

/** The prices of the runes of the open item (and of the exos that could be put on it), with the ones typed in the table. */
export function useBrisageRunePrices(
  serverId: string | undefined,
  priceMode: PriceMode,
  ranges: Range[],
  negativeRanges: Range[],
  storedExos: ExoEntry[],
) {
  const runeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const range of ranges) {
      const found = runeForStat(RUNES, range.effectId, SETTINGS.runeSize);
      if (found) ids.add(found.rune.id);
    }
    // specs/067: the price of a malus' rune is shown (and used once a roll turns the line positive).
    for (const range of negativeRanges) {
      const found = runeForStat(RUNES, range.effectId, SETTINGS.runeSize);
      if (found) ids.add(found.rune.id);
    }
    for (const exo of storedExos) {
      const found = exo.effectId === undefined ? undefined : runeForStat(RUNES, exo.effectId, SETTINGS.runeSize);
      if (found) ids.add(found.rune.id);
    }
    // The prices of the runes that could be put on the item as an exo, to find the best one.
    for (const { found } of exoCandidates(new Set([...ranges, ...negativeRanges].map((range) => range.effectId)), RUNES, SETTINGS)) ids.add(found.rune.id);
    return [...ids].sort();
  }, [ranges, negativeRanges, storedExos]);
  const fetched = useRunePrices(serverId, priceMode, runeIds);
  // specs/067: a price typed in the table is used at once, before the carnet is read again; one entry per server and mode.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});
  const overrideKey = (runeId: string) => `${serverId}:${priceMode}:${runeId}`;
  const prices: Record<string, number | undefined> = { ...fetched.prices };
  for (const runeId of runeIds) {
    const typedPrice = priceOverrides[overrideKey(runeId)];
    if (typedPrice !== undefined) prices[runeId] = typedPrice;
  }
  const saveOverride = (id: string, amount: number) => {
    setPriceOverrides((known) => ({ ...known, [overrideKey(id)]: amount }));
    setDateOverrides((known) => ({ ...known, [overrideKey(id)]: new Date().toISOString() }));
  };

  return { prices, fetched, dateOverrides, overrideKey, saveOverride };
}
