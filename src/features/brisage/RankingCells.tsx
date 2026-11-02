import runeItems from '../../data/rune-items.json';
import { Icon } from '../../components/Icon';
import { MAX_COEFFICIENT } from '../../domain/brisage';
import { ageInDays, freshnessOf, type RankingExo, type RankingRow } from '../../domain/brisage-ranking';
import type { RuneItemsData } from '../../domain/forgemagie';
import { Kamas } from '../prices/PricesPage';
import { number } from './brisageHelpers';

// specs/072-classement-brisage: the cells of a row of the ranking table.

const RUNES = (runeItems as RuneItemsData).runes;
const percent = number;

const shortRune = (name: string | undefined) => (name ?? '').replace('Rune ', '').trim();

/** « il y a 3 j » with a mark when the date is stale (text and icon, not only a colour). */
export function Age({ date, what }: { date: string | undefined; what: string }) {
  const level = freshnessOf(date);
  const days = ageInDays(date);
  const text = days === undefined ? 'date inconnue' : days === 0 ? "aujourd'hui" : `il y a ${days} j`;
  return (
    <span className={`ranking-age ranking-age--${level}`} title={`${what} : ${text}`}>
      {level === 'stale' && <Icon name="info" size={12} />}
      {text}{level === 'stale' ? ' (périmé)' : ''}
    </span>
  );
}

const RUNE_IMAGES = new Map(RUNES.map((rune) => [rune.name, rune.imageUrl]));

/** The icon of the rune of an exo, in front of its stat. */
function RuneIcon({ name }: { name: string }) {
  const url = RUNE_IMAGES.get(name);
  return url ? <img className="ranking-rune-icon" src={url} alt="" loading="lazy" width="20" height="20" /> : null;
}

export function BestChoice({ row }: { row: RankingRow }) {
  if (row.status === 'no-price') return <span className="fm-note">Prix de l'objet inconnu</span>;
  if (row.status === 'no-breakable-line') return <span className="fm-note">Aucune ligne à briser</span>;
  if (row.status === 'missing-rune-price') return <span className="fm-note">Prix de rune manquant</span>;
  return row.best?.kind === 'focus' ? `Focus ${shortRune(row.best.focusRuneName)}` : 'Sans focus';
}

export function GainCell({ row }: { row: RankingRow }) {
  if (row.status !== 'ok' || row.gainKamas === undefined) return <span className="fm-note">—</span>;
  const gain = Math.round(row.gainKamas);
  return <span className={gain < 0 ? 'brisage-total-loss' : gain > 0 ? 'brisage-total-gain' : undefined}><Kamas value={gain} signed /></span>;
}

export function ThresholdCell({ row }: { row: RankingRow }) {
  if (row.status !== 'ok') return <span className="fm-note">—</span>;
  if (row.unreachable) return <span className="fm-note">au-delà de {percent.format(MAX_COEFFICIENT)} %</span>;
  return row.thresholdCoefficient === undefined ? <span className="fm-note">—</span> : <>{percent.format(row.thresholdCoefficient)} %</>;
}

export function ExoCell({ row, exo, pending }: { row: RankingRow; exo: RankingExo | undefined; pending: boolean }) {
  if (row.status !== 'ok') return <span className="fm-note">—</span>;
  if (!exo) return <span className="fm-note">{pending ? 'calcul…' : '—'}</span>;
  if (row.group === 'unknown') return <><RuneIcon name={exo.runeName} /><strong>{exo.runeName}</strong> : {percent.format(exo.thresholdCoefficient!)} %</>;
  return <><RuneIcon name={exo.runeName} /><strong>{exo.runeName}</strong> : +<Kamas value={Math.round(exo.improvementKamas!)} /></>;
}
