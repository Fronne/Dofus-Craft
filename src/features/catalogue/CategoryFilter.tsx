import type { Category } from '../../domain/types';
import { Icon } from '../../components/Icon';
import { CATEGORY_ICON_PATHS } from '../../components/CategoryIcon';

export function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}) {
const equipmentCategories = categories.filter((category) => category.kind === 'Equipment');
return (
  <fieldset className="filter category-filter" disabled={!equipmentCategories.length}>
    <legend>Catégorie</legend>
    <div className="category-icons" role="list">
      <button
        type="button"
        className={!value ? 'selected' : ''}
        aria-pressed={!value}
        onClick={() => onChange('')}
      >
        <span className="category-icon" aria-hidden="true">
          <Icon name="grid" size={19} />
        </span>
        <span>Tous les équipements</span>
      </button>
      {equipmentCategories.map((category) => (
        <button
          type="button"
          className={value === category.id ? 'selected' : ''}
          aria-pressed={value === category.id}
          key={category.id}
          onClick={() => onChange(category.id)}
        >
          <span className="category-icon" aria-hidden="true">
            {CATEGORY_ICON_PATHS[category.id] ? (
              <span
                className="category-icon-glyph"
                style={{
                  WebkitMaskImage: `url(${CATEGORY_ICON_PATHS[category.id]})`,
                  maskImage: `url(${CATEGORY_ICON_PATHS[category.id]})`,
                }}
              />
            ) : (
              <Icon name="package" size={19} />
            )}
          </span>
          <span>{category.label}</span>
        </button>
      ))}
    </div>
  </fieldset>
);
}
