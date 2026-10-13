import type { ReactNode } from 'react';
import type { Category, Item, ItemStat, Recipe, Resource } from '../../domain/types';
import { Icon } from '../../components/Icon';
import { statTone } from './stat-tones';
import { CategoryIcon } from '../../components/CategoryIcon';

type ItemDetailData = {
  item: Item;
  category?: Category;
  recipe?: Recipe;
  resources: Resource[];
  stats?: ItemStat[];
  panoplieName?: string;
  isWeapon?: boolean;
};

function StatList({ stats }: { stats: ItemStat[] }) {
  return (
    <ul>
      {stats.map((stat) => (
        <li key={stat.id} className={stat.positive ? 'stat-positive' : 'stat-negative'}>
          {/* The diamond only adds a color: the characteristic stays written in the label. */}
          <span className={`stat-diamond stat-diamond--${statTone(stat.icon)}`} aria-hidden="true" />
          {stat.label}
        </li>
      ))}
    </ul>
  );
}

export function ItemDetail({
  detail,
  isPinned = false,
  onTogglePin,
  history,
  pending = false,
}: {
  detail?: ItemDetailData;
  isPinned?: boolean;
  onTogglePin?: () => void;
  // specs/017: the price-history button, in the card's top-left corner. Only passed in Mode communautaire.
  history?: ReactNode;
  // The recipe and effects are still loading, or could not be loaded: « no recipe » and « no effect »
  // would be wrong then, so neither is said.
  pending?: boolean;
}) {
  if (!detail) {
    return <section className="card"><p>Sélectionnez un objet pour voir ses détails.</p></section>;
  }

  const { item, category, recipe, stats = [], panoplieName, isWeapon } = detail;

  return (
    <section className="card item-detail-card" data-tour="item-detail">
      {onTogglePin && (
        <button type="button" className={`pin-item-button${isPinned ? ' pinned' : ''}`} aria-pressed={isPinned} onClick={onTogglePin}>
          <Icon name={isPinned ? 'bookmark-filled' : 'bookmark'} size={18} />
          {isPinned ? 'Ne plus suivre' : 'Suivre'}
        </button>
      )}
      {history}
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
      {isWeapon ? (
        <>
          {stats.some((stat) => stat.isWeaponEffect) && (
            <section className="item-stats" aria-labelledby="weapon-stats-heading">
              <h3 id="weapon-stats-heading">Effets de l'arme</h3>
              <StatList stats={stats.filter((stat) => stat.isWeaponEffect)} />
            </section>
          )}
          {stats.some((stat) => !stat.isWeaponEffect) && (
            <section className="item-stats" aria-labelledby="item-stats-heading">
              <h3 id="item-stats-heading">Effets</h3>
              <StatList stats={stats.filter((stat) => !stat.isWeaponEffect)} />
            </section>
          )}
        </>
      ) : (
        <section className="item-stats" aria-labelledby="item-stats-heading">
          <h3 id="item-stats-heading">Effets</h3>
          {stats.length ? (
            <StatList stats={stats} />
          ) : pending ? (
            <span className="skeleton-block skeleton-line item-stats-skeleton" aria-hidden="true" />
          ) : (
            <p className="muted">Aucune statistique fournie par DofusDB pour cet objet.</p>
          )}
        </section>
      )}
      {!recipe && !pending && <p>Aucune recette disponible pour cet objet.</p>}
    </section>
  );
}
