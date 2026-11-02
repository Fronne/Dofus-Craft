import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Item } from '../../domain/types';
import { recipeRefreshIds, recipeRefreshMessage } from '../../domain/recipe-refresh';
import { refreshRecipePrices } from '../../services/community-price-api';

export function useRecipeRefresh({ serverId, selected, selectedItem, ids, setReload }: {
  serverId: string | undefined;
  selected: string;
  selectedItem: Item | undefined;
  ids: string[];
  setReload: Dispatch<SetStateAction<number>>;
}) {
  // What « Actualiser les prix » is doing or last said, for the server and item it was clicked on: shown
  // for those only, so another item or server starts without a message (FR-006).
  const refreshKey = `${serverId}:${selected}`;
  const [refreshState, setRefreshState] = useState<{ key: string; busy: boolean; message?: string }>({ key: '', busy: false });
  const refresh = refreshState.key === refreshKey ? refreshState : { busy: false, message: undefined };

  // specs/047 (FR-002 to FR-005): one request for the item and the resources of its whole craft chain.
  const refreshPrices = async () => {
    if (!serverId || !selectedItem) return;
    setRefreshState({ key: refreshKey, busy: true });
    const outcome = await refreshRecipePrices(serverId, selectedItem.id, recipeRefreshIds(selectedItem.id, ids));
    if (outcome.status === 'ok') setReload((count) => count + 1);
    setRefreshState({ key: refreshKey, busy: false, message: recipeRefreshMessage(outcome) });
  };

  return { refresh, refreshPrices };
}
