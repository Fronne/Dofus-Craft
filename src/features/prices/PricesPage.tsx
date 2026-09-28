import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActiveServer } from '../../app/ServerContext';
import { ROUTES } from '../../app/router';
import { BackToTopButton } from '../../components/BackToTopButton';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import type { PriceMode } from '../../domain/price-modes';
import { KAMAS_ICON_URL } from '../../domain/kamas';
import { classifyPriceAge } from '../../domain/price-age';
import { formatRelativeTime } from '../../domain/time';
import { DEFAULT_PROFIT_SORT, filterProfitRows, sortProfitRows, type CraftProfitRow, type ProfitSort, type ProfitSortKey } from '../../domain/craft-profit';
import { useCraftProfits } from './useCraftProfits';
import { useLoadMoreOnScroll } from '../../hooks/useLoadMoreOnScroll';

// specs/019-craft-profit-list (contracts/prices-page-ui.md): the items of the active server whose HDV
// price is known and whose craft cost is complete, with the profit of crafting them — computed like
// the Recherche page in « Auto ». Replaces the former lists of item and resource prices (FR-001).

const kamasNumber = new Intl.NumberFormat('fr-FR');

// An amount followed by the in-game kamas icon instead of the word « kamas », to keep the lines light.
// The icon's alt text keeps the unit for screen readers.
export function Kamas({ value, signed = false }: { value: number; signed?: boolean }) {
  const sign = signed && value > 0 ? '+' : value < 0 ? '−' : '';
  return (
    <span className="kamas-amount">
      {sign}{kamasNumber.format(Math.abs(value))}
      <img src={KAMAS_ICON_URL} alt=" kamas" className="kamas-amount-icon" width={14} height={14} />
    </span>
  );
}

function signedPercent(value: number) {
  return value > 0 ? `+${value} %` : value < 0 ? `−${-value} %` : '0 %';
}

// One grid shared by the header and every line, so the amounts line up from row to row; the labels
// are shown once above the list, and repeated inside each line only on a phone (CSS).
function ProfitLine({ row, onOpen }: { row: CraftProfitRow; onOpen: () => void }) {
  const tone = row.profitKamas > 0 ? 'positive' : row.profitKamas < 0 ? 'negative' : 'neutral';
  const age = classifyPriceAge(row.marketPriceDate);
  const ageClass = age === 'stale' ? ' market-date--stale' : age === 'expired' ? ' market-date--expired' : '';
  return (
    <li className="profit-row">
      <button type="button" className="profit-row-main" onClick={onOpen}>
        <ResourceDisplay resource={{ id: row.item.id, name: row.item.name, imageUrl: row.item.imageUrl }} />
      </button>
      <div className="profit-cell">
        <span className="profit-cell-label">Prix HDV</span>
        <b><Kamas value={row.marketPriceKamas} /></b>
        <small className={`market-date${ageClass}`}>{formatRelativeTime(row.marketPriceDate)}</small>
      </div>
      <div className="profit-cell">
        <span className="profit-cell-label">Coût de craft</span>
        <b><Kamas value={row.craftCostKamas} /></b>
      </div>
      <div className={`profit-cell profit-value profit-value--${tone}`}>
        <span className="profit-cell-label">Bénéfice</span>
        <b><Kamas value={row.profitKamas} signed /></b>
      </div>
      <div className={`profit-cell profit-value profit-value--${tone}`}>
        <span className="profit-cell-label">Marge</span>
        <b>{row.marginPercent !== undefined ? signedPercent(row.marginPercent) : '—'}</b>
      </div>
    </li>
  );
}

const COLUMNS: { key: ProfitSortKey; label: string }[] = [
  { key: 'name', label: 'Nom' },
  { key: 'market', label: 'Prix HDV' },
  { key: 'cost', label: 'Coût de craft' },
  { key: 'kamas', label: 'Bénéfice' },
  { key: 'percent', label: 'Marge' },
];

// FR-006 (revised): the list is sorted only by clicking a column header — first click from the
// largest (A → Z for the name), second click the other way round.
function SortHeader({ sort, onSort }: { sort: ProfitSort; onSort: (sort: ProfitSort) => void }) {
  return (
    <div className="profit-head" role="group" aria-label="Trier la liste">
      {COLUMNS.map((column) => {
        const active = sort.key === column.key;
        const first = column.key === 'name' ? 'asc' : 'desc';
        return (
          <button
            key={column.key}
            type="button"
            className={`profit-sort${active ? ' profit-sort--active' : ''}`}
            aria-pressed={active}
            aria-label={`Trier par ${column.label}`}
            onClick={() => onSort({
              key: column.key,
              direction: active ? (sort.direction === 'asc' ? 'desc' : 'asc') : first,
            })}
          >
            {column.label}
            {active && <span aria-hidden="true">{sort.direction === 'desc' ? ' ↓' : ' ↑'}</span>}
          </button>
        );
      })}
    </div>
  );
}

// The Recherche page only keeps a deep-linked item if it's among its results (or pinned): the item's
// name goes along as the search so it is, and stays selected.
export function PricesPage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId, servers } = useActiveServer();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ProfitSort>(DEFAULT_PROFIT_SORT);
  const { status, rows, done, total } = useCraftProfits(serverId, priceMode);
  const serverName = servers.find((server) => server.id === serverId)?.name;

  const filtered = sortProfitRows(filterProfitRows(rows, query), sort);
  // Infinite scroll (FR-007, revised): the next lines appear as the end of the list comes into view.
  const { visible, endRef, loadingMore, reset: resetShown } = useLoadMoreOnScroll(filtered);
  const modeLabel = priceMode === 'community' ? 'Mode communautaire' : 'Mode personnel';

  return (
    <>
      <header className="page-header">
        <h1>Rentabilité</h1>
        <p>
          Bénéfice si vous craftez{serverName ? `, serveur ${serverName}` : ''}, {modeLabel}.
        </p>
      </header>

      <section className="panel profit-panel">
        {!serverId ? (
          <EmptyState icon="coins" title="Aucun serveur choisi" description="Choisissez un serveur pour voir le bénéfice de craft des objets." />
        ) : status === 'unavailable' ? (
          <p className="warning">Impossible de charger les prix partagés pour le moment.</p>
        ) : (
          <>
            <div className="profit-toolbar">
              <div className="search-input-wrap prices-search">
                <Icon name="search" size={18} className="search-input-icon" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    resetShown();
                  }}
                  placeholder="Rechercher un objet..."
                  aria-label="Rechercher un objet"
                />
              </div>
            </div>
            {status === 'loading' && (
              <p className="empty" role="status">Calcul en cours… ({done} / {total})</p>
            )}
            {status === 'ready' && rows.length === 0 ? (
              <>
                <EmptyState
                  icon="coins"
                  title="Aucun objet calculable"
                  description="Il faut un prix HDV et le prix de toutes ses ressources."
                />
                <p className="profit-empty-link"><Link to={ROUTES.search}>Aller à la page Recherche</Link></p>
              </>
            ) : rows.length > 0 && filtered.length === 0 ? (
              <EmptyState icon="search" title="Aucun objet ne correspond à votre recherche" description="Essayez un autre nom d'objet." />
            ) : rows.length > 0 && (
              <>
                <div className="results-meta">
                  <span>{filtered.length} {filtered.length === 1 ? 'objet' : 'objets'}</span>
                </div>
                <SortHeader sort={sort} onSort={(next) => {
                  setSort(next);
                  resetShown();
                }} />
                <ul className="profit-list">
                  {visible.map((row) => (
                    <ProfitLine key={row.item.id} row={row} onOpen={() => navigate(`${ROUTES.search}?${new URLSearchParams({ q: row.item.name, item: row.item.id })}`)} />
                  ))}
                </ul>
                {visible.length < filtered.length && (
                  <div ref={endRef} className="profit-list-end" role="status">
                    {loadingMore && 'Chargement…'}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
      <BackToTopButton />
    </>
  );
}
