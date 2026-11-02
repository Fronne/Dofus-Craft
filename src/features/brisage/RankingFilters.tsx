import { DEFAULT_RANKING_VIEW, type RankingView } from '../../domain/brisage-ranking';
import type { Category } from '../../domain/types';

const parseNumber = (text: string): number | undefined => {
  const value = Number(text.replace(/\s/g, '').replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : undefined;
};

/** The filters of the ranking: levels, category, minimum gain and the two « Masquer » boxes. */
export function RankingFilters({ view, categories, update, onView }: {
  view: RankingView;
  categories: Category[];
  update: (change: Partial<RankingView>) => void;
  onView: (view: RankingView) => void;
}) {
  return (
    <form className="ranking-filters" onSubmit={(event) => event.preventDefault()} aria-label="Filtres du classement">
      <label>Niveau minimum
        <input type="number" min={1} inputMode="numeric" value={view.minLevel ?? ''} onChange={(event) => update({ minLevel: parseNumber(event.target.value) })} />
      </label>
      <label>Niveau maximum
        <input type="number" min={1} inputMode="numeric" value={view.maxLevel ?? ''} onChange={(event) => update({ maxLevel: parseNumber(event.target.value) })} />
      </label>
      <label>Catégorie
        <select value={view.categoryId ?? ''} onChange={(event) => update({ categoryId: event.target.value || undefined })}>
          <option value="">Toutes</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
        </select>
      </label>
      <label>Gain minimum (kamas)
        <input type="number" inputMode="numeric" value={view.minGainKamas ?? ''} onChange={(event) => update({ minGainKamas: parseNumber(event.target.value) })} />
      </label>
      <label className="ranking-check">
        <input type="checkbox" checked={view.hideWithoutPrice} onChange={(event) => update({ hideWithoutPrice: event.target.checked })} />
        Masquer les objets sans prix
      </label>
      <label className="ranking-check">
        <input type="checkbox" checked={view.hideWithoutCoefficient} onChange={(event) => update({ hideWithoutCoefficient: event.target.checked })} />
        Masquer les objets sans coefficient
      </label>
      <button type="button" className="btn btn-secondary" onClick={() => onView(DEFAULT_RANKING_VIEW)}>Réinitialiser les filtres</button>
    </form>
  );
}
