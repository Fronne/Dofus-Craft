import { useMemo, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { CharacteristicIcon } from '../../components/CharacteristicIcon';
import { EmptyState } from '../../components/EmptyState';
import { BRISAGE_STATS } from '../../domain/brisage';
import { DEAL_SORTS, jetCardLines, selectGoodDeals, type DealSort } from '../../domain/good-deals';
import { formatKamas } from '../../domain/kamas';
import { formatRelativeTime } from '../../domain/time';
import { GoodDealBadge } from './GoodDealBadge';
import { statIconAsset } from './stat-icons';
import { useGoodDeals, type Deal } from './useGoodDeals';

// specs/078-bons-plans-hdv (US2): every good deal of the active server, with the sort and the filters of the spec.

const PAGE_SIZE = 40;

// One card per announcement: the item, the −40 % tag, each line of the roll with its stat icon, the price.
function DealCard({ deal }: { deal: Deal }) {
  return (
    <li className="good-deal-card">
      <div className="good-deal-head">
        <div className="good-deal-main">
          <span className="good-deal-name">{deal.itemName}</span>
          {deal.hasExo && <span className="good-deal-exo">Exo</span>}
        </div>
        <span className="good-deal-tag"><GoodDealBadge deal={deal} compact /></span>
      </div>
      <ul className="good-deal-jet" aria-label="Jet de l'annonce">
        {jetCardLines(deal.listing.stats, deal.itemEffects).map((line) => {
          const asset = statIconAsset(line.iconEffectId);
          return (
            <li key={line.effectId} className={`good-deal-line good-deal-line-${line.tone}`}>
              {asset ? <CharacteristicIcon asset={asset} size={18} /> : <span className="good-deal-icon-gap" aria-hidden="true" />}
              <span>
                {line.text}
                {line.range && <> <span className="good-deal-range" aria-label={`jet théorique ${line.range}`}>[{line.range}]</span></>}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="good-deal-foot">
        <div className="good-deal-prices">
          <strong className="good-deal-price">{formatKamas(deal.priceKamas)}</strong>
          {deal.referencePriceKamas !== undefined && <s className="good-deal-reference">{formatKamas(deal.referencePriceKamas)}</s>}
        </div>
        {deal.listing.lastSeenAt && <span className="good-deal-age">vu {formatRelativeTime(deal.listing.lastSeenAt)}</span>}
      </div>
    </li>
  );
}

export function BonsPlansPage() {
  const { serverId, servers } = useActiveServer();
  const state = useGoodDeals(serverId);
  const [sort, setSort] = useState<DealSort>('savingKamas');
  const [exoOnly, setExoOnly] = useState(false);
  const [effectId, setEffectId] = useState<number | undefined>(undefined);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const serverName = servers.find((server) => server.id === serverId)?.name ?? serverId;
  const deals = useMemo(
    () => (state.status === 'ready' ? selectGoodDeals(state.deals, { sort, exoOnly, effectId }) : []),
    [state, sort, exoOnly, effectId],
  );

  return (
    <>
      <header className="page-header">
        <h1>Bons plans</h1>
        <p className="page-subtitle">
          Équipements de l'HDV{serverName ? ` (${serverName})` : ''} au moins {state.status === 'ready' ? state.thresholdPercent : 25} % moins chers
          que des exemplaires de jet proche, vus il y a moins de 24 h.
        </p>
      </header>

      {!serverId && <EmptyState icon="server" title="Choisissez un serveur" description="Les bons plans dépendent du serveur." />}

      {serverId && state.status === 'loading' && <p role="status">Chargement des annonces…</p>}

      {serverId && state.status === 'error' && (
        <EmptyState icon="info" title="Annonces indisponibles" description="Impossible de lire les annonces pour le moment. Réessayez plus tard." />
      )}

      {serverId && state.status === 'ready' && (
        <>
          <div className="good-deal-controls">
            <label>
              Trier par{' '}
              <select value={sort} onChange={(event) => { setSort(event.target.value as DealSort); setVisible(PAGE_SIZE); }}>
                {DEAL_SORTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <label>
              Jet{' '}
              <select
                value={effectId ?? ''}
                onChange={(event) => { setEffectId(event.target.value === '' ? undefined : Number(event.target.value)); setVisible(PAGE_SIZE); }}
              >
                <option value="">Tous</option>
                {BRISAGE_STATS.map((stat) => <option key={stat.effectId} value={stat.effectId}>{stat.label}</option>)}
              </select>
            </label>
            <label>
              <input type="checkbox" checked={exoOnly} onChange={(event) => { setExoOnly(event.target.checked); setVisible(PAGE_SIZE); }} /> Exo uniquement
            </label>
          </div>

          {deals.length === 0 ? (
            <EmptyState
              icon="coins"
              title="Aucun bon plan pour le moment"
              description={state.deals.length === 0
                ? "Aucune annonce récente n'a été relevée sur ce serveur."
                : 'Aucune annonce ne passe le seuil avec ces filtres.'}
            />
          ) : (
            <>
              <p role="status">{deals.length} bon{deals.length > 1 ? 's' : ''} plan{deals.length > 1 ? 's' : ''}</p>
              <ul className="good-deal-list">
                {deals.slice(0, visible).map((deal) => <DealCard key={deal.listingId} deal={deal} />)}
              </ul>
              {visible < deals.length && (
                <button type="button" className="btn btn-secondary" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
                  Afficher plus
                </button>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
