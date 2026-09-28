import type { ReactNode } from 'react';
import type { Resource, ResourcePrice } from '../../domain/types';
import { parseKamas } from '../../domain/kamas';
import type { PriceMode } from '../../domain/price-modes';
import { ResourcePriceInput } from './ResourcePriceInput';
import { CommunityResourcePriceRow } from './CommunityResourcePriceRow';

// One resource price field, the same on every page that edits the carnet (Recherche, HDV —
// specs/023 FR-006): same carnet, same Mode personnel / communautaire rules. The value being typed
// is owned by the caller (`input` / `onInput`), since the Recherche page recomputes its craft cost
// from it on every keystroke.
export function PriceEntryField({
  resource,
  quantity,
  priceMode,
  serverId,
  input,
  onInput,
  carnet,
  retained,
  subtotalKamas,
  caption,
  onSaved,
}: {
  resource: Resource;
  quantity: number;
  priceMode: PriceMode;
  serverId: string | undefined;
  /** The value typed and not yet saved, if any. */
  input: string | undefined;
  onInput: (value: string) => void;
  carnet: {
    data: Record<string, ResourcePrice>;
    save: (resourceId: string, price: number) => Promise<unknown>;
    remove: (resourceId: string) => Promise<unknown>;
    loaded: boolean;
  };
  retained?: ReactNode;
  subtotalKamas?: number | null;
  /** Shown instead of « × quantity » (HDV page: the item type). */
  caption?: ReactNode;
  /** Called once a price has been written to, or removed from, the carnet. */
  onSaved?: (resourceId: string) => void;
}) {
  const resourceId = resource.id;
  const { data, loaded } = carnet;
  const value = input ?? data[resourceId]?.unitPriceKamas?.toString() ?? '';
  const save = (price: number) => {
    void carnet.save(resourceId, price).then(() => onSaved?.(resourceId));
  };
  // Writes the field to the carnet once the player is done typing, and only if the value actually
  // changed since what's persisted — a no-op blur (click in, click out) must not touch `updatedAt`
  // either.
  const onBlur = (finalValue: string) => {
    const price = parseKamas(finalValue);
    const persisted = data[resourceId]?.unitPriceKamas;
    if (price === persisted) return;
    if (price === undefined) {
      void carnet.remove(resourceId).then(() => onSaved?.(resourceId));
    } else {
      save(price);
    }
  };
  if (priceMode === 'community' && serverId) {
    return (
      <CommunityResourcePriceRow
        resource={resource}
        quantity={quantity}
        serverId={serverId}
        value={value}
        hasCarnetEntry={data[resourceId] !== undefined || input !== undefined}
        pricesLoaded={loaded}
        updatedAt={data[resourceId]?.updatedAt}
        onChange={onInput}
        onPersist={save}
        onPrefill={save}
        retained={retained}
        subtotalKamas={subtotalKamas}
        caption={caption}
      />
    );
  }
  return (
    <ResourcePriceInput
      resource={resource}
      quantity={quantity}
      value={value}
      updatedAt={data[resourceId]?.updatedAt}
      onChange={onInput}
      onBlur={onBlur}
      retained={retained}
      subtotalKamas={subtotalKamas}
      caption={caption}
    />
  );
}
