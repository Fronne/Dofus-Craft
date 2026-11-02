import { DEFAULT_RANKING_VIEW, type RankingView } from '../../domain/brisage-ranking';
import type { PriceMode } from '../../domain/price-modes';
import { RankingFilters } from './RankingFilters';
import { RankingTable } from './RankingTable';
import { PAGE_SIZE, useRankingTab, type RankingOpenItem } from './useRankingTab';

// specs/072-classement-brisage: the « Classement » tab of the Brisage page. The items whose HDV price is known, from the
// most to the least worth breaking, with the same figures as the item page (analyzeBrisage / analyzeFocusAdvice at the
// average roll of each line). Everything shown is an ESTIMATE from unofficial formulas (specs/060).

export { forgetExoCache, forgetRankingPlace, type RankingOpenItem } from './useRankingTab';

export function RankingTab({ serverId, priceMode, view, onView, onOpen }: {
  serverId: string | undefined;
  priceMode: PriceMode;
  view: RankingView;
  onView: (view: RankingView) => void;
  onOpen: (item: RankingOpenItem) => void;
}) {
  const {
    data, categories, rows, shown, known, unknown, exosPending, limit, setLimit, hasMore, update, sortBy, rangeError, openRow,
  } = useRankingTab({ serverId, priceMode, view, onView, onOpen });

  return (
    <section className="panel ranking" aria-label="Classement des objets à briser">
      <h2 className="visually-hidden">Classement</h2>
      <p className="fm-note ranking-warning">
        Estimations d'après des formules non officielles : jet moyen de chaque ligne, prix de l'objet noté sur la page Recherche, prix des runes
        et dernier coefficient noté par les joueurs. Un objet sans coefficient connu est classé à part, selon le coefficient minimum requis.
      </p>
      {data.incomplete.length > 0 && (
        <p className="fm-error" role="status">Classement incomplet : {data.incomplete.join(', ')} indisponible(s).</p>
      )}

      <RankingFilters view={view} categories={categories} update={update} onView={onView} />
      {rangeError && <p className="fm-error" role="alert">{rangeError}</p>}

      {data.status === 'loading' && <p className="fm-note" role="status">Calcul du classement…</p>}
      {data.status === 'ready' && shown.length === 0 && (
        <p className="empty" role="status">
          {rows.every((row) => row.status === 'no-price')
            ? "Aucun prix d'objet connu sur ce serveur : notez des prix sur la page Recherche."
            : 'Aucun objet ne correspond à ces filtres.'}
          {' '}<button type="button" className="btn btn-secondary" onClick={() => onView(DEFAULT_RANKING_VIEW)}>Réinitialiser les filtres</button>
        </p>
      )}

      {shown.length > 0 && (
        <RankingTable view={view} known={known} unknown={unknown} limit={limit} exosPending={exosPending} sortBy={sortBy} openRow={openRow} />
      )}
      {hasMore && (
        <button type="button" className="btn btn-secondary ranking-more" onClick={() => setLimit(limit + PAGE_SIZE)}>
          Afficher plus ({PAGE_SIZE} lignes de plus par groupe)
        </button>
      )}
    </section>
  );
}
