import { useEffect, useState } from 'react';
import { MAX_COEFFICIENT } from '../../domain/brisage';
import { hasImportedCoefficients, listImportableCoefficients, markCoefficientsImported, removeStoredCoefficient, saveCoefficient, type StoredCoefficient } from '../../persistence/brisage-coefficients';
import { clearSharedCoefficients, MAX_ENTRIES_PER_SEND, submitCoefficients } from '../../services/brisage-coefficient-api';
import { parse, type PickedItem } from './brisageHelpers';
import { dropSharedCoefficient } from './use-shared-coefficients';
import { forgetCachedCoefficient } from './useRankingData';

/** The coefficient of the open item: noting it, forgetting it, and sending the old notes once (specs/069). */
export function useBrisageCoefficient(
  serverId: string | undefined,
  item: PickedItem | undefined,
  coefficientText: string,
  setCoefficientText: (text: string) => void,
  setStored: (stored: StoredCoefficient | undefined) => void,
) {
  const [, setClearedCount] = useState(0);

  // specs/069 (FR-006): the notes made before they were shared are sent once, with their original date; the flag is
  // set only once the server has them, so a failed send is tried again at the next visit.
  useEffect(() => {
    if (hasImportedCoefficients()) return;
    const notes = listImportableCoefficients();
    if (notes.length === 0) { markCoefficientsImported(); return; }
    (async () => {
      for (let start = 0; start < notes.length; start += MAX_ENTRIES_PER_SEND) {
        if (!(await submitCoefficients(notes.slice(start, start + MAX_ENTRIES_PER_SEND)))) return;
      }
      markCoefficientsImported();
    })();
  }, []);

  // « Coefficient unknown »: a note made by mistake is forgotten here and, for the players, hidden at the Worker (the notes
  // made before this moment are no longer given; a later note replaces it as usual).
  const forgetCoefficient = () => {
    if (!serverId || !item) return;
    removeStoredCoefficient(serverId, item.id);
    dropSharedCoefficient(serverId, item.id);
    forgetCachedCoefficient(serverId, item.id);
    setStored(undefined);
    setCoefficientText('');
    // The coefficient shown may have been a shared one only: nothing else changed, so the page is drawn again here.
    setClearedCount((count) => count + 1);
    void clearSharedCoefficients([{ serverId, itemId: item.id }]);
  };

  const rememberCoefficient = () => {
    const value = parse(coefficientText);
    if (!serverId || !item || !(value > 0 && value <= MAX_COEFFICIENT)) return;
    const saved = saveCoefficient(serverId, item.id, value);
    setStored(saved);
    // specs/069: shared with the players; if the server doesn't answer, the note stays on this device.
    if (saved) void submitCoefficients([{ serverId, itemId: item.id, coefficient: value, savedAt: saved.savedAt }]);
    setCoefficientText('');
  };

  return { forgetCoefficient, rememberCoefficient };
}
