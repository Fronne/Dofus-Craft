import type { ReactNode } from 'react';
import { runeForStat } from '../../domain/brisage';
import type { BrisageAnalysis } from './brisageAnalysis';
import { RUNES, SETTINGS } from './brisageHelpers';
import { ExoRow, type ExoEntry } from './ExoRow';

/** The exos put on the item, one row each (the last added first). */
export function BrisageExoRows({ exoEntries, exos, exoRunes, normal, changeExos, removeExo, runePriceCell }: {
  exoEntries: ExoEntry[];
  exos: (ExoEntry & { effectId: number })[];
  exoRunes: BrisageAnalysis['exoRunes'];
  normal: BrisageAnalysis['normal'];
  changeExos: (next: ExoEntry[]) => void;
  removeExo: (entry: ExoEntry) => void;
  runePriceCell: (runeId: string, runeName: string) => ReactNode;
}) {
  return (
    <>
      {exoEntries.map((entry) => {
        const plain = entry.effectId === undefined ? undefined : normal?.yields.find((y) => y.effectId === entry.effectId);
        const taken = (effectId: number) => exos.some((other) => other.effectId === effectId && other.effectId !== entry.effectId);
        return (
          <ExoRow
            key={entry.id}
            entry={entry}
            choices={exoRunes.filter((choice) => !taken(choice.effectId))}
            plain={plain}
            priceCell={(() => {
              const exoRune = entry.effectId === undefined ? undefined : runeForStat(RUNES, entry.effectId, SETTINGS.runeSize);
              return exoRune ? runePriceCell(exoRune.rune.id, exoRune.rune.name) : undefined;
            })()}
            onPick={(effectId) => {
              const max = exoRunes.find((choice) => choice.effectId === effectId)?.max ?? 1;
              changeExos(exoEntries.map((other) => (other === entry ? { id: entry.id, effectId, value: Math.min(Math.max(entry.value, 1), max) } : other)));
            }}
            onValue={(value) => changeExos(exoEntries.map((other) => (other === entry ? { ...entry, value } : other)))}
            onRemove={() => removeExo(entry)}
          />
        );
      })}
    </>
  );
}
