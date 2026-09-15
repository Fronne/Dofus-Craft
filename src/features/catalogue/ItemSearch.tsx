import type { Category } from '../../domain/types';
import { CategoryFilter } from './CategoryFilter';
import { Icon } from '../../components/Icon';

export function ItemSearch({
  query,
  setQuery,
  category,
  setCategory,
  levelMin,
  setLevelMin,
  levelMax,
  setLevelMax,
  onReset,
  categories,
}: {
  query: string;
  setQuery: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  levelMin: string;
  setLevelMin: (value: string) => void;
  levelMax: string;
  setLevelMax: (value: string) => void;
  onReset: () => void;
  categories: Category[];
}) {
  const hasActiveFilters = Boolean(query || category || levelMin || levelMax);
  return (
    <div className="search">
      <label className="search-primary">
        <span className="search-label">Rechercher un objet ou une panoplie</span>
        <span className="search-input-wrap">
          <Icon name="search" size={20} className="search-input-icon" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un objet ou une panoplie..."
          />
        </span>
      </label>
      <fieldset className="filters-panel">
        <legend>Filtres</legend>
        <CategoryFilter categories={categories} value={category} onChange={setCategory} />
        <div className="level-range">
          <label>
            Niveau min
            <input
              type="number"
              min="1"
              max="200"
              inputMode="numeric"
              value={levelMin}
              onChange={(event) => setLevelMin(event.target.value)}
              placeholder="Min"
            />
          </label>
          <label>
            Niveau max
            <input
              type="number"
              min="1"
              max="200"
              inputMode="numeric"
              value={levelMax}
              onChange={(event) => setLevelMax(event.target.value)}
              placeholder="Max"
            />
          </label>
        </div>
        {hasActiveFilters && (
          <button type="button" className="reset-filters" onClick={onReset}>
            Réinitialiser les filtres
          </button>
        )}
      </fieldset>
    </div>
  );
}
