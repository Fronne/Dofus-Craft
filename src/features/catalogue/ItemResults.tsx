import type { Item } from '../../domain/types';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCard } from '../../components/SkeletonCard';

export function ItemResults({
  items,
  selected,
  onSelect,
  loading,
  total,
  isInitial,
  resultLimit,
  setResultLimit,
}: {
  items: Item[];
  selected?: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  total: number;
  isInitial?: boolean;
  resultLimit: number;
  setResultLimit: (value: number) => void;
}) {
  if (loading) return <SkeletonCard count={resultLimit > 12 ? 12 : resultLimit} />;
  if (!items.length) {
    return (
      <EmptyState
        icon="search"
        title="Aucun objet ne correspond à votre recherche"
        description="Essayez d'élargir vos filtres ou de vérifier l'orthographe de votre recherche."
      />
    );
  }
  return (
    <div>
      <div className="results-meta">
        <span>
          {isInitial
            ? 'Premiers objets craftables'
            : `${total} ${total === 1 ? 'objet trouvé' : 'objets trouvés'}`}
        </span>
        <label>
          Afficher :
          <select value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))}>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={96}>96</option>
          </select>
        </label>
      </div>
      <div className="results" aria-label="Résultats de recherche">
        {items.map((item) => (
          <button className={selected === item.id ? 'selected' : ''} onClick={() => onSelect(item.id)} key={item.id}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" loading="lazy" width="32" height="32" />
            ) : (
              <span className="result-image-fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
            )}
            <span className="result-item-info">
              <span className="result-item-name">{item.name}</span>
              {item.level !== undefined && <span className="result-item-level"> Niveau {item.level}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
