import { useNavigate } from 'react-router-dom';
import { usePinnedItems } from './usePinnedItems';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { ROUTES } from '../../app/router';

export function EpinglesPage() {
  const { pinnedItems, unpin } = usePinnedItems();
  const navigate = useNavigate();

  return (
    <>
      <header className="page-header">
        <h1>Épinglés</h1>
        <p>Retrouvez rapidement vos objets suivis, sans refaire de recherche.</p>
      </header>
      {pinnedItems.length === 0 ? (
        <EmptyState
          icon="pin"
          title="Aucun objet épinglé"
          description="Épinglez un objet depuis la recherche pour le retrouver ici, quel que soit le serveur actif."
        />
      ) : (
        <div className="pinned-grid" aria-label="Objets épinglés">
          {pinnedItems.map((entry) => (
            <div className="pinned-card" key={entry.item.id}>
              <button
                type="button"
                className="pinned-card-main"
                onClick={() => navigate(`${ROUTES.search}?item=${entry.item.id}`)}
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
              </button>
              <button
                type="button"
                className="icon-button pinned-card-remove"
                aria-label={`Désépingler ${entry.item.name}`}
                onClick={() => unpin(entry.item.id)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
