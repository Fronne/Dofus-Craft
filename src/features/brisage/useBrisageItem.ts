import { useEffect, useRef, useState } from 'react';
import { getItemEffectRanges, getItemNegativeRanges } from '../../data/catalogue-repository';
import { getStoredCoefficient, type StoredCoefficient } from '../../persistence/brisage-coefficients';
import { getBrisageExos } from '../../persistence/brisage-exos';
import { getBrisageSession, setBrisageSession, type BrisageSession, type PriceSource } from '../../persistence/brisage-session';
import type { ExoEntry } from './ExoRow';
import type { PickedItem, Range } from './brisageHelpers';
import { useSharedCoefficients } from './use-shared-coefficients';

/**
 * The item open on the page and what was typed on it: its ranges, rolls, exos, coefficient, price. Opening an item reads
 * its lines; a reload brings back the item and what was typed (the session).
 */
export function useBrisageItem(serverId: string | undefined) {
  const [item, setItem] = useState<PickedItem>();
  const [ranges, setRanges] = useState<Range[]>([]);
  // specs/067: the negative lines (maluses) of the item, read apart from the positive ones.
  const [negativeRanges, setNegativeRanges] = useState<Range[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [rolls, setRolls] = useState<Record<number, string>>({});
  // specs/066: the exos put on this item, the last added first (as in the game); kept per item.
  const [storedExos, setExos] = useState<ExoEntry[]>([]);
  const [stored, setStored] = useState<StoredCoefficient>();
  // specs/069: the coefficient shown is the more recent of the one noted on this device and the one shared by the players.
  const sharedCoefficientOf = useSharedCoefficients(serverId, item ? [item.id] : []);
  const shownCoefficient = item ? sharedCoefficientOf(item.id, stored) : stored;
  const [coefficientText, setCoefficientText] = useState('');
  const [manualCost, setManualCost] = useState('');
  // A new item starts with no source chosen ('auto'): the button of the cheaper of the HDV price and the craft cost is lit.
  const [priceSource, setPriceSource] = useState<PriceSource>('auto');
  const pickToken = useRef(0);

  /** Opens an item; `restore` brings back what was typed on it before a reload. */
  const openItem = (picked: PickedItem, restore?: Pick<BrisageSession, 'rolls' | 'coefficientText' | 'manualCost' | 'priceSource'>) => {
    // Clicking the item already open must not wipe what was typed on it.
    if (!restore && picked.id === item?.id) return;
    const token = ++pickToken.current;
    setItem(picked);
    setRanges([]);
    setNegativeRanges([]);
    setExos(serverId ? getBrisageExos(serverId, picked.id).map((exo) => ({ ...exo, id: `exo-${exo.effectId}` })) : []);
    setRolls(restore?.rolls ?? {});
    setCoefficientText(restore?.coefficientText ?? '');
    setManualCost(restore?.manualCost ?? '');
    // Another item starts on the cheaper source again; a restored session brings its own back.
    setPriceSource(restore?.priceSource ?? 'auto');
    setStored(serverId ? getStoredCoefficient(serverId, picked.id) : undefined);
    setLoadState('loading');
    Promise.all([getItemEffectRanges(picked.id), getItemNegativeRanges(picked.id)])
      .then(([result, negatives]) => {
        if (pickToken.current !== token) return;
        setRanges(result);
        setNegativeRanges(negatives);
        setLoadState('idle');
      })
      .catch(() => {
        if (pickToken.current === token) setLoadState('failed');
      });
  };

  // A reload brings back the item and what was typed on it; nothing is saved before this has run.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!serverId || restored) return;
    const session = getBrisageSession();
    if (session && session.serverId === serverId) openItem(session.item, session);
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, restored]);
  useEffect(() => {
    if (!restored || !serverId) return;
    setBrisageSession(item ? { serverId, item, rolls, coefficientText, manualCost, priceSource } : undefined);
  }, [restored, serverId, item, rolls, coefficientText, manualCost, priceSource]);

  return {
    item, ranges, negativeRanges, loadState, rolls, setRolls, storedExos, setExos, setStored, shownCoefficient,
    coefficientText, setCoefficientText, manualCost, setManualCost, priceSource, setPriceSource, openItem,
  };
}
