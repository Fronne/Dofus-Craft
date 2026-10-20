import { useMemo } from 'react';
import { brisageStat } from '../../domain/brisage';
import { statGroup, type StatGroup } from '../../domain/brisage-search';
import type { BrisageStat } from '../../domain/brisage';
import type { Category } from '../../domain/types';
import { CategoryFilter } from '../catalogue/CategoryFilter';
import { LevelRangeSlider } from '../catalogue/LevelRangeSlider';

// specs/065-refonte-page-brisage (US4): the filters of the Brisage search, laid out like the Recherche page —
// category, level — then the stats the item carries, in three columns.

const GROUPS: { id: StatGroup; label: string }[] = [
  { id: 'caracteristiques', label: 'Caractéristiques' },
  { id: 'degats', label: 'Dommages' },
  { id: 'resistances', label: 'Résistances' },
];

export function ItemFilters({ id, hidden, categories, categoryId, onCategory, levelMin, levelMax, onLevelMin, onLevelMax, levelError, stats, chosen, onToggleStat }: {
  id: string;
  hidden: boolean;
  categories: Category[];
  categoryId: string;
  onCategory: (id: string) => void;
  levelMin: string;
  levelMax: string;
  onLevelMin: (value: string) => void;
  onLevelMax: (value: string) => void;
  levelError: string | undefined;
  stats: BrisageStat[];
  chosen: number[];
  onToggleStat: (effectId: number) => void;
}) {
  const columns = useMemo(
    () => GROUPS.map((group) => ({ ...group, stats: stats.filter((stat) => statGroup(stat.effectId) === group.id) })),
    [stats],
  );
  return (
    <fieldset className="filters-panel brisage-filters" id={id} hidden={hidden}>
      <legend>Filtres</legend>
      <CategoryFilter categories={categories} value={categoryId} onChange={onCategory} />
      <div className="level-filters">
        <fieldset className="level-filter">
          <legend>Niveau</legend>
          <LevelRangeSlider levelMin={levelMin} setLevelMin={onLevelMin} levelMax={levelMax} setLevelMax={onLevelMax} />
        </fieldset>
      </div>
      {levelError && <p className="fm-error" role="alert">{levelError}</p>}
      <fieldset className="brisage-stat-filter">
        <legend>Stats présentes sur l'objet</legend>
        <div className="brisage-stat-columns">
          {columns.map((column) => (
            <div key={column.id} className={`brisage-stat-column brisage-stat-column--${column.id}`}>
              <h3>{column.label}</h3>
              <ul>
                {column.stats.map((stat) => {
                  const on = chosen.includes(stat.effectId);
                  return (
                    <li key={stat.effectId}>
                      <button type="button" className={on ? 'brisage-search-stat is-selected' : 'brisage-search-stat'} aria-pressed={on} onClick={() => onToggleStat(stat.effectId)}>
                        {/* Room for the icon of the stat, to come; empty for now. */}
                        <span className="brisage-stat-icon" aria-hidden="true" />
                        {stat.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </fieldset>
    </fieldset>
  );
}

/** Label of a chosen stat for its removable chip. */
export const statChipLabel = (effectId: number): string => brisageStat(effectId)?.label ?? String(effectId);
