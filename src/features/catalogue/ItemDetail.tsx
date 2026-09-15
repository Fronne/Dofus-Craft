import { getManifest } from '../../data/catalogue-repository';
import type { Category, Item, ItemStat, Recipe, Resource } from '../../domain/types';
import { ResourceDisplay } from './ResourceDisplay';

export type ItemDetailData = {
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

  const manifest = getManifest();
  const { item, category, recipe, resources, stats = [], panoplieName } = detail;

  return (
    <section className="card">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} />
      ) : (
        <div className="image-fallback" role="img" aria-label={`Visuel indisponible pour ${item.name}`}>
          {item.name}
        </div>
      )}
      <h2>{item.name}</h2>
      {onTogglePin && (
        <button type="button" className={`pin-item-button${isPinned ? ' pinned' : ''}`} onClick={onTogglePin}>
          <span aria-hidden="true">📌</span>
          {isPinned ? 'Désépingler' : 'Épingler'}
        </button>
      )}
      {panoplieName && <p className="item-set-name">Panoplie : {panoplieName}</p>}
      {item.level !== undefined && <p>Niveau : {item.level}</p>}
      {category && <p>Catégorie : {category.label}</p>}
      <section className="item-stats" aria-labelledby="item-stats-heading">
        <h3 id="item-stats-heading">Statistiques</h3>
        {stats.length ? (
          <ul>
            {stats.map((stat) => <li key={stat.id}>{stat.label}</li>)}
          </ul>
        ) : (
          <p className="muted">Aucune statistique fournie par DofusDB pour cet objet.</p>
        )}
      </section>
      {recipe ? (
        <section className="recipe" aria-labelledby="recipe-heading">
          <h3 id="recipe-heading">Recette</h3>
          <ul>
            {recipe.ingredients.map((ingredient) => {
              const resource = resources.find((candidate) => candidate.id === ingredient.resourceId);
              return (
                <li key={ingredient.resourceId}>
                  {resource ? (
                    <ResourceDisplay resource={resource} quantity={ingredient.quantity} />
                  ) : (
                    `${ingredient.resourceId} × ${ingredient.quantity}`
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p>Aucune recette disponible pour cet objet.</p>
      )}
      <section className="dofusdb-info" aria-labelledby="dofusdb-info-heading">
        <h3 id="dofusdb-info-heading">Informations DofusDB</h3>
        <p>
          Données : {manifest.sourceName}, version {manifest.catalogueVersion}
        </p>
        <small>Données issues de DofusDB. Utilisation soumise à la LPNC-IA 1.0.</small>
      </section>
    </section>
  );
}