import { useMemo, useRef, useState } from 'react';
import runeItems from '../../data/rune-items.json';
import { useActiveServer } from '../../app/ServerContext';
import { Icon } from '../../components/Icon';
import { StatTile } from '../../components/StatTile';
import { getItemEffectRanges } from '../../data/catalogue-repository';
import {
  analyzeBrisage,
  averageRoll,
  brisageStat,
  defaultBrisageSettings,
  runeForStat,
  type BrisageOption,
} from '../../domain/brisage';
import type { RuneItemsData } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import type { Item } from '../../domain/types';
import { getStoredCoefficient, saveCoefficient, type StoredCoefficient } from '../../persistence/brisage-coefficients';
import { MIN_QUERY_LENGTH, useEquipmentSearch } from '../forgemagie/useEquipmentSearch';
import { useItemCost } from './useItemCost';
import { useRunePrices } from './useRunePrices';

// specs/061-simplification-page-brisage: pick an item, read the verdict. The cost comes from the price
// already noted on Recherche, the coefficient is remembered per item, each line starts at its average
// roll. Everything shown is an ESTIMATE from unofficial formulas (specs/060-page-brisage H1–H4).

const RUNES = (runeItems as RuneItemsData).runes;
const SETTINGS = defaultBrisageSettings();
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

type PickedItem = { id: string; name: string; level?: number };
type Range = { effectId: number; from: number; to: number };

const parse = (text: string): number => (text.trim() === '' ? NaN : Number(text.replace(/\s/g, '').replace(',', '.')));

function optionLabel(option: BrisageOption): string {
  return option.kind === 'normal' ? 'Pas de focus' : `Focus ${(option.focusRuneName ?? '').replace('Rune ', '')}`.trim();
}

const statLabel = (effectId: number) => brisageStat(effectId)?.label ?? `Effet ${effectId}`;
const rangeText = (range: Range) => (range.from === range.to ? `${range.from}` : `${range.from} à ${range.to}`);

export function BrisagePage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId } = useActiveServer();
  const [query, setQuery] = useState('');
  const search = useEquipmentSearch(query);
  const [item, setItem] = useState<PickedItem>();
  const [ranges, setRanges] = useState<Range[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [rolls, setRolls] = useState<Record<number, string>>({});
  const [stored, setStored] = useState<StoredCoefficient>();
  const [coefficientText, setCoefficientText] = useState('');
  const [manualCost, setManualCost] = useState('');
  const pickToken = useRef(0);

  const pick = (found: Item) => {
    const token = ++pickToken.current;
    setItem({ id: found.id, name: found.name, level: found.level });
    setQuery('');
    setRanges([]);
    setRolls({});
    setCoefficientText('');
    setManualCost('');
    setStored(serverId ? getStoredCoefficient(serverId, found.id) : undefined);
    setLoadState('loading');
    getItemEffectRanges(found.id)
      .then((result) => {
        if (pickToken.current !== token) return;
        setRanges(result);
        setLoadState('idle');
      })
      .catch(() => {
        if (pickToken.current === token) setLoadState('failed');
      });
  };

  const rememberCoefficient = () => {
    const value = parse(coefficientText);
    if (!serverId || !item || !(value > 0 && value <= 100)) return;
    setStored(saveCoefficient(serverId, item.id, value));
    setCoefficientText('');
  };

  const itemCost = useItemCost(serverId, item?.id, priceMode);
  const typedCoefficient = parse(coefficientText);
  const coefficient = typedCoefficient > 0 ? typedCoefficient : stored?.coefficient ?? NaN;
  const cost = itemCost.costKamas ?? parse(manualCost);

  // Only the lines that break into a known rune are shown; the others are just counted.
  const breakable = ranges.filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize));
  const lines = breakable.map((range, index) => {
    const average = averageRoll(range.from, range.to);
    const typed = parse(rolls[index] ?? '');
    const modified = typed >= 0 && typed !== average;
    return { index, range, average, value: typed >= 0 ? typed : average, modified };
  });
  const runeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const range of ranges) {
      const found = runeForStat(RUNES, range.effectId, SETTINGS.runeSize);
      if (found) ids.add(found.rune.id);
    }
    return [...ids].sort();
  }, [ranges]);
  const fetched = useRunePrices(serverId, priceMode, runeIds);

  const analysis = item && ranges.length > 0 && itemCost.status === 'ready'
    ? analyzeBrisage(
      { level: item.level ?? NaN, lines: lines.map((line) => ({ effectId: line.range.effectId, value: line.value })), coefficient, itemCostKamas: cost },
      RUNES,
      fetched.prices,
      SETTINGS,
    )
    : undefined;
  const best = analysis?.status === 'ok' ? analysis.best : undefined;
  const missingNames = analysis?.status === 'ok'
    ? [...new Set(analysis.options.flatMap((o) => o.missingRuneIds))].map((id) => RUNES.find((r) => r.id === id)?.name ?? id)
    : [];
  const unconfirmed = breakable.map((range) => brisageStat(range.effectId)).filter((stat) => stat && !stat.confirmed).map((stat) => stat!.label);

  return (
    <>
      <header className="page-header">
        <h1>Brisage</h1>
        <p>Briser cet objet est-il rentable ? Sur quelle rune faire un focus ?</p>
      </header>

      <div className="panel brisage-estimate" role="note">
        <Icon name="info" size={18} />
        <p>
          <b>Tout est une estimation.</b> Le coefficient descend selon une formule mesurée sur des objets de niveau 40, et
          le calcul du focus est une <b>hypothèse non officielle</b> : à confirmer en jeu.
        </p>
      </div>

      <section className="panel brisage-block" aria-labelledby="brisage-item">
        <h2 id="brisage-item">Objet à briser</h2>
        <div className="search-input-wrap">
          <Icon name="search" size={18} className="search-input-icon" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chercher un objet…" aria-label="Chercher un objet" />
        </div>
        {query.trim().length >= MIN_QUERY_LENGTH && (
          <div>
            {search.status === 'searching' && <p className="fm-note" role="status">Recherche…</p>}
            {search.status === 'unavailable' && <p className="fm-error" role="alert">Le catalogue est indisponible pour le moment.</p>}
            {search.status === 'ready' && search.items.length === 0 && <p className="fm-note">Aucun objet ne correspond.</p>}
            {search.status === 'ready' && (
              <ul className="fm-picker-results">
                {search.items.map((found) => (
                  <li key={found.id}>
                    <button type="button" className="fm-picker-result" onClick={() => pick(found)}>
                      <span>{found.name}</span>
                      {found.level !== undefined && <span className="fm-note">Niv. {found.level}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!item && <p className="fm-note">Choisissez l'objet que vous voulez briser.</p>}
      </section>

      {item && (
        <section className="panel brisage-block" aria-labelledby="brisage-details">
          <h2 id="brisage-details">{item.name}{item.level !== undefined ? ` (niveau ${item.level})` : ''}</h2>

          {itemCost.status === 'ready' && itemCost.costKamas !== undefined && (
            <p className="brisage-picked">Coût de l'objet : <b>{number.format(itemCost.costKamas)} kamas</b></p>
          )}
          {itemCost.status === 'ready' && itemCost.costKamas === undefined && (
            <>
              <label className="pet-level-field">Coût de l'objet (kamas)
                <input type="number" inputMode="numeric" min={0} value={manualCost} onChange={(event) => setManualCost(event.target.value)} />
              </label>
              <p className="fm-note">Aucun prix disponible pour cet objet (page Recherche) : saisissez-le.</p>
            </>
          )}

          {stored ? (
            <p className="brisage-picked">
              Dernier coefficient : <b>{number.format(stored.coefficient)} %</b> ({date.format(new Date(stored.savedAt))})
            </p>
          ) : (
            <p className="fm-note">Cet objet n'a pas encore été brisé ici : brisez-le en jeu, puis notez son coefficient.</p>
          )}
          <label className="pet-level-field">
            {stored ? 'Nouveau coefficient relevé (%)' : 'Coefficient relevé en jeu après un brisage (%)'}
            <input
              type="number" inputMode="decimal" min={1} max={100}
              value={coefficientText}
              onChange={(event) => setCoefficientText(event.target.value)}
              onBlur={rememberCoefficient}
            />
          </label>

          <h3>Lignes de l'objet</h3>
          {loadState === 'loading' && <p className="fm-note" role="status">Lecture des stats…</p>}
          {loadState === 'failed' && <p className="fm-error" role="alert">Les stats de cet objet n'ont pas pu être lues.</p>}
          {loadState === 'idle' && ranges.length === 0 && <p className="fm-note">Cet objet n'a aucune ligne à briser.</p>}
          {lines.length > 0 && (
            <>
              <p className="fm-note">Chaque ligne part de son jet moyen ; saisissez un jet pour le remplacer.</p>
              <ul className="brisage-lines">
                {lines.map((line) => (
                  <li key={line.index}>
                    <span className="brisage-line-label">{statLabel(line.range.effectId)} <span className="fm-note">({rangeText(line.range)})</span></span>
                    <input
                      type="number" inputMode="decimal" min={0}
                      aria-label={`Jet de ${statLabel(line.range.effectId)}`}
                      placeholder={String(line.average)}
                      value={rolls[line.index] ?? ''}
                      onChange={(event) => setRolls({ ...rolls, [line.index]: event.target.value })}
                    />
                    <span className="fm-note">{line.modified ? 'modifié' : 'moyen'}</span>
                  </li>
                ))}
              </ul>
              {ranges.length > breakable.length && (
                <p className="fm-note">{ranges.length - breakable.length} ligne(s) sans poids ni rune connus ne sont pas comptées.</p>
              )}
              {unconfirmed.length > 0 &&<p className="fm-note">Poids à confirmer par un relevé : {[...new Set(unconfirmed)].join(', ')}.</p>}
            </>
          )}
        </section>
      )}

      {item && analysis && (
        <section className="brisage-results" aria-labelledby="brisage-results-title">
          <h2 id="brisage-results-title">Résultat</h2>
          {analysis.status === 'invalid' ? (
            <p className="empty" role="status">
              {!(coefficient > 0) ? "Indiquez le coefficient de l'objet pour voir le résultat." : analysis.reason}
            </p>
          ) : (
            <>
              {fetched.communityUnavailable && <p className="fm-note" role="status">Les prix partagés sont injoignables : seuls vos prix enregistrés sont utilisés.</p>}
              {missingNames.length > 0 && (
                <p className="fm-note" role="status">
                  Prix manquant pour : {missingNames.join(', ')}. Notez-les sur la page Prix : aucun prix n'est inventé.
                </p>
              )}
              <div className="stat-tile-row" aria-live="polite">
                <StatTile
                  icon="check"
                  label="Verdict"
                  value={best ? (best.gainKamas! < 0 ? 'Pas rentable' : best.kind === 'focus' ? 'Rentable avec focus' : 'Rentable') : 'Prix manquants'}
                  hint={best ? `${best.gainKamas! >= 0 ? '+' : '−'}${number.format(Math.abs(Math.round(best.gainKamas!)))} kamas par objet` : undefined}
                />
                <StatTile
                  icon="package"
                  label="Brisages avant le seuil"
                  value={analysis.itemsCount === undefined ? '—' : String(analysis.itemsCount)}
                  hint="Brisage normal ; le coefficient baisse à chaque brisage"
                />
                <StatTile
                  icon="anvil"
                  label="Coefficient minimal rentable"
                  value={analysis.thresholdCoefficient === undefined ? '—' : `${number.format(analysis.thresholdCoefficient)} %`}
                />
                <StatTile
                  icon="rune"
                  label="Meilleure rune à focus"
                  value={best ? optionLabel(best) : '—'}
                  hint="Estimation non officielle"
                />
              </div>
            </>
          )}
        </section>
      )}
    </>
  );
}
