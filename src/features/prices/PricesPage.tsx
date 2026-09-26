import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActiveServer } from '../../app/ServerContext';
import { ROUTES } from '../../app/router';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import type { PriceMode } from '../../domain/price-modes';
import { formatKamas } from '../../domain/kamas';
import { classifyPriceAge } from '../../domain/price-age';
import { formatRelativeTime } from '../../domain/time';
import { filterProfitRows, sortProfitRows, type CraftProfitRow, type ProfitSort } from '../../domain/craft-profit';
import { useCraftProfits } from './useCraftProfits';

// specs/019-craft-profit-list (contracts/prices-page-ui.md): the items of the active server whose HDV
// price is known and whose craft cost is complete, with the profit of crafting them — computed like
// the Recherche page in « Auto ». Replaces the former lists of item and resource prices (FR-001).

const DISPLAY_LIMIT_OPTIONS = [10, 25, 50, 100];

function signedKamas(value: number) {
  return value > 0 ? `+${formatKamas(value)}` : value < 0 ? `−${formatKamas(-value)}` : formatKamas(0);
}

function signedPercent(value: number) {
  return value > 0 ? `+${value} %` : value < 0 ? `−${-value} %` : '0 %';
}

function ProfitLine({ row, onOpen }: { row: CraftProfitRow; onOpen: () => void }) {
  const tone = row.profitKamas > 0 ? 'positive' : row.profitKamas < 0 ? 'negative' : 'neutral';
  const age = classifyPriceAge(row.marketPriceDate);
  const ageClass = age === 'stale' ? ' market-date--stale' : age === 'expired' ? ' market-date--expired' : '';
  return (
    <li className="profit-row">
      <button type="button" className="profit-row-main" onClick={onOpen}>
        <ResourceDisplay resource={{ id: row.item.id, name: row.item.name, imageUrl: row.item.imageUrl }} />
      </button>
      <dl className="profit-row-figures">
        <div>
          <dt>Prix HDV</dt>
          <dd>
            {formatKamas(row.marketPriceKamas)}
            <small className={`market-date${ageClass}`}>{formatRelativeTime(row.marketPriceDate)}</small>
          </dd>
        </div>
        <div>
          <dt>Coût de craft</dt>
          <dd>{formatKamas(row.craftCostKamas)}</dd>
        </div>
        <div className={`profit-value profit-value--${tone}`}>
          <dt>Bénéfice</dt>
          <dd>
            {signedKamas(row.profitKamas)}
            {row.marginPercent !== undefined && <small>{signedPercent(row.marginPercent)}</small>}
          </dd>
        </div>
      </dl>
    </li>
  );
}

export function PricesPage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId, servers } = useActiveServer();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ProfitSort>('kamas');
  const [limit, setLimit] = useState(DISPLAY_LIMIT_OPTIONS[0]);
  const { status, rows, done, total } = useCraftProfits(serverId, priceMode);
  const serverName = servers.find((server) => server.id === serverId)?.name;

  const filtered = sortProfitRows(filterProfitRows(rows, query), sort);
  const visible = filtered.slice(0, limit);
  const modeLabel = priceMode === 'community' ? 'Mode communautaire' : 'Mode personnel';

  return (
    <>
      <header className="page-header">
        <h1>Prix</h1>
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
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un objet..."
                  aria-label="Rechercher un objet"
                />
              </div>
              <label>
                Trier par :
                <select value={sort} onChange={(event) => setSort(event.target.value as ProfitSort)}>
                  <option value="kamas">Bénéfice (kamas)</option>
                  <option value="percent">Marge (%)</option>
                </select>
              </label>
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
                  <label>
                    Afficher :
                    <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
                      {DISPLAY_LIMIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                </div>
                <ul className="profit-list">
                  {visible.map((row) => (
                    <ProfitLine key={row.item.id} row={row} onOpen={() => navigate(`${ROUTES.search}?item=${row.item.id}`)} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
