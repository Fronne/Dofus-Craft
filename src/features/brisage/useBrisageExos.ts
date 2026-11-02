import { useEffect, useRef, useState } from 'react';
import { runeForStat } from '../../domain/brisage';
import { setBrisageExos } from '../../persistence/brisage-exos';
import type { ExoEntry } from './ExoRow';
import { RUNES, SETTINGS, type PickedItem, type Range } from './brisageHelpers';

/** The exos put on the open item: the list kept per item, adding, removing and the « Annuler » that puts one back. */
export function useBrisageExos(
  serverId: string | undefined,
  item: PickedItem | undefined,
  ranges: Range[],
  negativeRanges: Range[],
  storedExos: ExoEntry[],
  setExos: (exos: ExoEntry[]) => void,
) {
  const newExoCount = useRef(0);
  // A restored exo only counts while its stat is still absent from the item and still has a rune; a new one has no rune yet.
  const exoEntries = storedExos.filter((exo) => exo.effectId === undefined
    || (runeForStat(RUNES, exo.effectId, SETTINGS.runeSize) && ![...ranges, ...negativeRanges].some((range) => range.effectId === exo.effectId)));
  const exos = exoEntries.filter((exo): exo is ExoEntry & { effectId: number } => exo.effectId !== undefined);

  const changeExos = (next: ExoEntry[]) => {
    setExos(next);
    if (serverId && item) setBrisageExos(serverId, item.id, next.flatMap((exo) => (exo.effectId === undefined ? [] : [{ effectId: exo.effectId, value: exo.value }])));
  };

  /** Adds an exo at the top: an empty one to fill in, or one already set on `effectId`. */
  const addExo = (effectId?: number) => {
    newExoCount.current += 1;
    changeExos([effectId === undefined ? { id: `new-${newExoCount.current}`, value: 1 } : { id: `new-${newExoCount.current}`, effectId, value: 1 }, ...exoEntries]);
  };

  // An exo taken off is kept a few seconds, so « Annuler » puts it back where it was.
  const [removedExo, setRemovedExo] = useState<{ entry: ExoEntry; index: number }>();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const removeExo = (entry: ExoEntry) => {
    const index = exoEntries.indexOf(entry);
    changeExos(exoEntries.filter((other) => other !== entry));
    clearTimeout(undoTimer.current);
    if (entry.effectId === undefined) { setRemovedExo(undefined); return; }
    setRemovedExo({ entry, index });
    undoTimer.current = setTimeout(() => setRemovedExo(undefined), 6000);
  };
  const undoRemoveExo = () => {
    if (!removedExo) return;
    clearTimeout(undoTimer.current);
    // The same rune was put again in the meantime: nothing to bring back.
    if (exos.some((exo) => exo.effectId === removedExo.entry.effectId)) { setRemovedExo(undefined); return; }
    const next = [...exoEntries];
    next.splice(Math.min(removedExo.index, next.length), 0, removedExo.entry);
    changeExos(next);
    setRemovedExo(undefined);
  };
  useEffect(() => { clearTimeout(undoTimer.current); setRemovedExo(undefined); }, [item?.id]);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  return { exoEntries, exos, changeExos, addExo, removedExo, removeExo, undoRemoveExo };
}
