import type { ReactNode } from 'react';
import type { Comparison, Item } from '../../domain/types';
import { ItemDetail, type ItemDetailData } from '../catalogue/ItemDetail';
import { PriceHistoryButton } from '../comparison/PriceHistoryButton';
import { MarketPriceInput } from '../comparison/MarketPriceInput';
import { ComparisonVerdict } from '../comparison/ComparisonResult';
import type { SharedItemPriceState } from '../comparison/useSharedItemPrice';

// The chosen item and, right under its name, whether to craft or buy it.
export function ItemVerdictPanel({
  detail,
  selected,
  selectedItem,
  isPinned,
  onTogglePin,
  community,
  serverId,
  result,
  market,
  sharedItemPrice,
  onMarketChange,
  onMarketCommit,
  onMarketUnloadCommit,
  onMarketTypingChange,
  marketError,
  marketOutlierDialog,
}: {
  detail: ItemDetailData;
  selected: string;
  selectedItem: Item | undefined;
  isPinned: (itemId: string) => boolean;
  onTogglePin: (() => void) | undefined;
  community: boolean;
  serverId: string | undefined;
  result: Comparison | undefined;
  market: string;
  sharedItemPrice: SharedItemPriceState;
  onMarketChange: (value: string) => void;
  onMarketCommit: (value: string) => Promise<'accepted' | 'rejected' | void>;
  onMarketUnloadCommit: (value: string) => void;
  onMarketTypingChange: (typing: boolean) => void;
  marketError: string;
  marketOutlierDialog: ReactNode;
}) {
  return (
    <section className="panel market-price-panel item-verdict-panel">
      <ItemDetail
        part="header"
        detail={detail}
        isPinned={selected ? isPinned(selected) : false}
        history={community && selectedItem && serverId
          ? <PriceHistoryButton key={serverId} kind="item" id={selectedItem.id} name={selectedItem.name} serverId={serverId} label="Historique" className="pin-item-button item-history-button" />
          : undefined}
        onTogglePin={onTogglePin}
      />
      {detail.recipe && result && (
      <div className="market-price-summary" data-tour="recommendation">
        <ComparisonVerdict
          result={result}
          marketPriceField={(
            <div className="verdict-market-field">
              <label htmlFor="market-price-input" className="market-price-label">Prix HDV</label>
              <MarketPriceInput
                value={market}
                updatedAt={community && sharedItemPrice.kind === 'found' ? sharedItemPrice.price.contributedAt : undefined}
                updatedBy={community && sharedItemPrice.kind === 'found' ? sharedItemPrice.price.author : undefined}
                onCommit={community ? onMarketCommit : undefined}
                onUnloadCommit={community ? onMarketUnloadCommit : undefined}
                onTypingChange={onMarketTypingChange}
                onChange={onMarketChange}
              />
            </div>
          )}
        />
      </div>
      )}
      {marketError && <p className="field-status field-status--error" role="alert">{marketError}</p>}
      {marketOutlierDialog}
    </section>
  );
}
