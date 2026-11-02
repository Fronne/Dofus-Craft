import { useMemo, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { CharacteristicIcon } from '../../components/CharacteristicIcon';
import { EmptyState } from '../../components/EmptyState';
import runeItems from '../../data/rune-items.json';
import { BRISAGE_STATS, defaultBrisageSettings, runeForStat } from '../../domain/brisage';
import type { RuneItem } from '../../domain/forgemagie';
import { DEAL_SORTS, exoEffectIdsOf, jetCardLines, selectGoodDeals, type DealCalibration, type DealSort } from '../../domain/good-deals';
import { formatKamas } from '../../domain/kamas';
import { formatRelativeTime } from '../../domain/time';
import { RunePicker, type RuneChoice } from '../brisage/ExoRow';
import { CalibrationPanel } from './CalibrationPanel';
import { readCalibration, writeCalibration } from './deal-calibration';
import { GoodDealBadge } from './GoodDealBadge';
import { statIconAsset } from './stat-icons';
import { useGoodDeals, type Deal } from './useGoodDeals';

// specs/078-bons-plans-hdv (US2): every good deal of the active server, with the sort and the filters of the spec.

const PAGE_SIZE = 40;

// specs/080: the exo filter shows the rune of each stat, as the page Brisage does.
const RUNES = (runeItems as { runes: RuneItem[] }).runes;
const RUNE_SIZE = defaultBrisageSettings().runeSize;
const RUNE_CHOICES: RuneChoice[] = BRISAGE_STATS.flatMap((stat) => {
  const found = runeForStat(RUNES, stat.effectId, RUNE_SIZE);
  return found ? [{ effectId: stat.effectId, label: stat.label, runeName: found.rune.name, imageUrl: found.rune.imageUrl }] : [];
});

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
  const [calibration, setCalibration] = useState<DealCalibration>(readCalibration);
  const state = useGoodDeals(serverId, calibration);
  const [sort, setSort] = useState<DealSort>('savingKamas');
  const [exoId, setExoId] = useState<number | undefined>(undefined);
  const [exoValue, setExoValue] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const serverName = servers.find((server) => server.id === serverId)?.name ?? serverId;
  const deals = useMemo(() => {
    if (state.status !== 'ready') return [];
    const exo = exoId === undefined ? undefined : { effectId: exoId, value: exoValue === '' ? undefined : Number(exoValue) };
    return selectGoodDeals(state.deals, { sort, exo });
  }, [state, sort, exoId, exoValue]);
  const exoChoices = useMemo(() => {
    const present = new Set(state.status === 'ready' ? exoEffectIdsOf(state.deals) : []);
    return RUNE_CHOICES.filter((choice) => present.has(choice.effectId));
  }, [state]);
  const calibrate = (next: DealCalibration) => {
    setCalibration(next);
    writeCalibration(next);
    setVisible(PAGE_SIZE);
  };

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
            <span className="good-deal-exo-filter">
              Exo{' '}
              <RunePicker
                chosen={RUNE_CHOICES.find((choice) => choice.effectId === exoId)} choices={exoChoices} placeholder="Tous les exos"
                onPick={(effectId) => { setExoId(effectId); setExoValue(''); setVisible(PAGE_SIZE); }}
              />
            </span>
            {exoId !== undefined && (
              <>
                <label>
                  Valeur{' '}
                  <input
                    type="number" min="1" step="1" className="good-deal-exo-value" placeholder="Toutes" value={exoValue}
                    onChange={(event) => { setExoValue(event.target.value); setVisible(PAGE_SIZE); }}
                  />
                </label>
                <button type="button" className="btn btn-secondary" onClick={() => { setExoId(undefined); setExoValue(''); setVisible(PAGE_SIZE); }}>
                  Retirer l'exo
                </button>
              </>
            )}
          </div>

          <CalibrationPanel calibration={calibration} defaultThreshold={state.adminThresholdPercent} onChange={calibrate} />

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
