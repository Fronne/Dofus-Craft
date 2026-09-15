import type { Item } from '../../domain/types';

export function PinnedItems({
  items,
  onSelect,
  onUnpin,
}: {
  items: Item[];
  onSelect: (id: string) => void;
  onUnpin: (id: string) => void;
}) {
  if (!items.length) return null;

  return (
    <section className="pinned-items" aria-labelledby="pinned-items-heading">
      <div className="pinned-items-heading">
        <h2 id="pinned-items-heading">Items épinglés</h2>
        <span aria-hidden="true">📌</span>
      </div>
      <div className="pinned-items-list">
        {items.map((item) => (
          <div className="pinned-item" key={item.id}>
            <button type="button" onClick={() => onSelect(item.id)}>
              {item.imageUrl && <img src={item.imageUrl} alt="" width="32" height="32" />}
              <span>{item.name}</span>
            </button>
            <button
              type="button"
              className="pinned-item-remove"
              aria-label={`Désépingler ${item.name}`}
              onClick={() => onUnpin(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
