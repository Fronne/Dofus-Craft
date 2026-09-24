import type { Category } from '../../domain/types';
import { CategoryFilter } from './CategoryFilter';
import { LevelRangeSlider } from './LevelRangeSlider';
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
    <div className="search" data-tour="search">
      <label className="search-primary">
        <span className="search-label">Rechercher un objet ou une panoplie</span>
        <span className="search-input-wrap">
          <Icon name="search" size={22} className="search-input-icon" />
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
        <div className="level-filters">
          <fieldset className="level-filter">
            <legend>Niveau</legend>
            <LevelRangeSlider levelMin={levelMin} setLevelMin={setLevelMin} levelMax={levelMax} setLevelMax={setLevelMax} />
          </fieldset>
          {hasActiveFilters && (
            <button type="button" className="reset-filters" onClick={onReset}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      </fieldset>
    </div>
  );
}
