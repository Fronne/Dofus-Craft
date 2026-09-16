import type { Category, Item, ItemStat, Recipe, Resource } from '../../domain/types';
import { Icon } from '../../components/Icon';
import { CharacteristicIcon } from '../../components/CharacteristicIcon';
import { CategoryIcon } from '../../components/CategoryIcon';

type ItemDetailData = {
  item: Item;
  category?: Category;
  recipe?: Recipe;
  resources: Resource[];
  stats?: ItemStat[];
  panoplieName?: string;
};

export function ItemDetail({
  detail,
  isPinned = false,
  onTogglePin,
}: {
  detail?: ItemDetailData;
  isPinned?: boolean;
  onTogglePin?: () => void;
}) {
  if (!detail) {
    return <section className="card"><p>Sélectionnez un objet pour voir ses détails.</p></section>;
  }

  const { item, category, recipe, stats = [], panoplieName } = detail;

  return (
    <section className="card item-detail-card">
      {onTogglePin && (
        <button type="button" className={`pin-item-button${isPinned ? ' pinned' : ''}`} onClick={onTogglePin}>
          <Icon name={isPinned ? 'pin-filled' : 'pin'} size={18} />
          {isPinned ? 'Désépingler' : 'Épingler'}
        </button>
      )}
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} />
      ) : (
        <div className="image-fallback" role="img" aria-label={`Visuel indisponible pour ${item.name}`}>
          {item.name}
        </div>
      )}
      <h2>{item.name}</h2>
      {panoplieName && <p className="item-set-name">Panoplie : {panoplieName}</p>}
      {item.level !== undefined && <p>Niveau : {item.level}</p>}
      {category && (
        <p className="item-category">
          Catégorie : <CategoryIcon categoryId={category.id} size={18} /> {category.label}
        </p>
      )}
      <section className="item-stats" aria-labelledby="item-stats-heading">
        <h3 id="item-stats-heading">Effets</h3>
        {stats.length ? (
          <ul>
            {stats.map((stat) => (
              <li key={stat.id} className={stat.positive ? 'stat-positive' : 'stat-negative'}>
                {stat.icon && <CharacteristicIcon asset={stat.icon} size={26} />}
                {stat.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aucune statistique fournie par DofusDB pour cet objet.</p>
        )}
      </section>
      {!recipe && <p>Aucune recette disponible pour cet objet.</p>}
    </section>
  );
}