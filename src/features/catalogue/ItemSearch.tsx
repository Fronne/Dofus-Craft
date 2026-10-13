import { useState } from 'react';
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = (category ? 1 : 0) + (levelMin || levelMax ? 1 : 0);
  // specs/051-site-visual-refresh (FR-020): the filters applied stay readable while the panel is
  // folded, each as a chip that removes it in one click.
  const categoryName = category ? categories.find((entry) => entry.id === category)?.label ?? 'Catégorie' : '';
  const levelLabel = levelMin || levelMax
    ? (levelMin || '1') === (levelMax || '200') ? `Niveau ${levelMin}` : `Niveau ${levelMin || '1'} – ${levelMax || '200'}`
    : '';
  return (
    <div className="search">
      <div className="search-row" data-tour="search">
        <label className="search-primary">
          <span className="search-label">Rechercher un objet ou une panoplie</span>
          <span className="search-input-wrap">
            <Icon name="search" size={22} className="search-input-icon" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // Down or Enter leaves the field for the first result, without a detour through the filters.
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'Enter') return;
                const first = document.querySelector<HTMLElement>('.results > button');
                if (!first) return;
                event.preventDefault();
                first.focus();
              }}
              placeholder="Rechercher un objet ou une panoplie..."
            />
          </span>
        </label>
        {/* The filters stay folded until asked for; the count says some are applied while they are hidden. */}
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="search-filters-panel"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <Icon name="filter" size={18} />
          <span>Filtres</span>
          {activeFilterCount > 0 && (
            <span className="filters-toggle-count" aria-label={`${activeFilterCount} actif${activeFilterCount > 1 ? 's' : ''}`}>
              {activeFilterCount}
            </span>
          )}
          <Icon name="chevron-down" size={16} className="filters-toggle-chevron" />
        </button>
      </div>
      {/* Kept mounted while folded: a level change still waiting for its delay is not lost. */}
      <fieldset className="filters-panel" id="search-filters-panel" hidden={!filtersOpen}>
        <legend>Filtres</legend>
        <CategoryFilter categories={categories} value={category} onChange={setCategory} />
        <div className="level-filters">
          <fieldset className="level-filter">
            <legend>Niveau</legend>
            <LevelRangeSlider levelMin={levelMin} setLevelMin={setLevelMin} levelMax={levelMax} setLevelMax={setLevelMax} />
          </fieldset>
        </div>
      </fieldset>
      {/* Last, so it shares its line with the results count (ItemResults) on a wide screen. */}
      {hasActiveFilters && (
        <div className="filters-bar">
          {categoryName && (
            <button type="button" className="filter-chip" aria-label={`Retirer le filtre ${categoryName}`} onClick={() => setCategory('')}>
              <span className="filter-chip-body">
                <span>{categoryName}</span>
                <Icon name="close" size={14} />
              </span>
            </button>
          )}
          {levelLabel && (
            <button
              type="button"
              className="filter-chip"
              aria-label={`Retirer le filtre ${levelLabel}`}
              onClick={() => {
                setLevelMin('');
                setLevelMax('');
              }}
            >
              <span className="filter-chip-body">
                <span>{levelLabel}</span>
                <Icon name="close" size={14} />
              </span>
            </button>
          )}
          <button type="button" className="reset-filters" onClick={onReset}>
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </div>
  );
}
