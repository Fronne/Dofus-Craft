import { Link } from 'react-router-dom';
import { useActiveServer } from '../../app/ServerContext';
import { ROUTES } from '../../app/router';
import { StatTile } from '../../components/StatTile';
import { Icon } from '../../components/Icon';
import { usePinnedItems } from '../catalogue/usePinnedItems';
import { priceModes } from '../../domain/price-modes';
import type { PriceMode } from '../../domain/price-modes';

export function AccueilPage({ priceMode }: { priceMode: PriceMode }) {
  const { servers, serverId } = useActiveServer();
  const { pinnedItems } = usePinnedItems();
  const activeServer = servers.find((server) => server.id === serverId);
  const activeModeLabel = priceModes.find((mode) => mode.id === priceMode)?.label ?? '';
  const recentPinned = pinnedItems.slice(-4).reverse();

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-content">
          <span className="eyebrow">Bienvenue</span>
          <h1>Analysez vos crafts en un coup d'œil</h1>
          <p>
            Comparez le coût de fabrication d'un objet à son prix à l'hôtel de vente et sachez
            immédiatement si le craft est rentable.
          </p>
          <Link to={ROUTES.search} className="btn btn-primary home-hero-cta">
            <Icon name="search" size={18} />
            Rechercher un objet
          </Link>
        </div>
      </section>

      <div className="stat-tile-row">
        <StatTile
          icon="server"
          label="Serveur actif"
          value={activeServer?.name ?? '—'}
        />
        <StatTile
          icon="pin"
          label="Objets épinglés"
          value={String(pinnedItems.length)}
        />
        <StatTile
          icon="coins"
          label="Mode de prix"
          value={activeModeLabel}
        />
      </div>

      <section className="panel home-pinned-preview">
        <div className="page-section-heading">
          <h2>Épinglés récents</h2>
        </div>
        {recentPinned.length === 0 ? (
          <p className="empty">
            Épinglez un objet depuis la recherche pour le retrouver ici.
          </p>
        ) : (
          <div className="pinned-grid" aria-label="Épinglés récents">
            {recentPinned.map((entry) => (
              <Link
                key={entry.item.id}
                to={`${ROUTES.search}?item=${entry.item.id}`}
                className="pinned-card pinned-card-main"
              >
                {entry.item.imageUrl ? (
                  <img src={entry.item.imageUrl} alt="" width="40" height="40" />
                ) : (
                  <span className="pinned-card-fallback" aria-hidden="true">
                    {entry.item.name.slice(0, 1)}
                  </span>
                )}
                <span className="pinned-card-info">
                  <span className="pinned-card-name">{entry.item.name}</span>
                  {entry.item.level !== undefined && (
                    <span className="pinned-card-level">Niveau {entry.item.level}</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
        {pinnedItems.length > 0 && (
          <div className="home-pinned-preview-footer">
            <Link to={ROUTES.pinned} className="btn btn-secondary btn-small">
              Voir tout
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
