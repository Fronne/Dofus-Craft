import { Link } from 'react-router-dom';
import { ROUTES } from '../../app/router';
import { EmptyState } from '../../components/EmptyState';
import type { ServerId } from '../../domain/types';

interface PetPriceStateInput {
  serverId: ServerId | undefined;
  status: 'loading' | 'ready';
  hasAnyPrice: boolean;
  communityUnavailable: boolean;
  hdvPageEnabled: boolean;
  onRetry: () => void;
}

// While no price can be shown, one message stands in for the podium and the table (022 messages).
// A function rather than a component: `undefined` (prices are there) tells the page to show them.
export function petPriceState({ serverId, status, hasAnyPrice, communityUnavailable, hdvPageEnabled, onRetry }: PetPriceStateInput) {
  return !serverId ? (
    <EmptyState icon="coins" title="Aucun serveur choisi" description="Choisissez un serveur pour voir le prix des ressources." />
  ) : status === 'loading' ? (
    <p className="empty" role="status">Chargement des prix…</p>
  ) : !hasAnyPrice && communityUnavailable ? (
    // An unreachable service is not « no price »: it says so and offers to ask again.
    <div role="alert">
      <EmptyState icon="info" title="Prix partagés indisponibles" description="Le service des prix partagés ne répond pas pour le moment.">
        <button type="button" className="btn btn-primary" onClick={onRetry}>Réessayer</button>
      </EmptyState>
    </div>
  ) : !hasAnyPrice ? (
    <EmptyState
      icon="coins"
      title="Aucune recommandation sans prix"
      description={hdvPageEnabled
        ? 'Saisissez le prix de ces ressources dans la page HDV, onglet Animaux, pour voir les moins chères.'
        : "Aucun prix n'est encore connu pour ces ressources sur ce serveur."}
    >
      {hdvPageEnabled && <Link to={ROUTES.hdv} className="btn btn-primary">Saisir des prix dans la page HDV</Link>}
    </EmptyState>
  ) : undefined;
}
