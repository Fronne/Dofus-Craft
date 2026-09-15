import type { Category } from '../../domain/types';

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
        <span className="category-icon-fallback" aria-hidden="true">ALL</span>
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
            {category.iconUrl ? (
              <img src={category.iconUrl} alt="" width="24" height="24" />
            ) : (
              <span className="category-icon-fallback">{category.label.slice(0, 1)}</span>
            )}
          </span>
          <span>{category.label}</span>
        </button>
      ))}
    </div>
  </fieldset>
);
}
