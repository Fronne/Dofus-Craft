import { useMemo, useRef, useState } from 'react';
import runeItems from '../../data/rune-items.json';
import { useActiveServer } from '../../app/ServerContext';
import { Icon } from '../../components/Icon';
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
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { MIN_QUERY_LENGTH, useEquipmentSearch } from '../forgemagie/useEquipmentSearch';
import { Kamas } from '../prices/PricesPage';
import { useItemCost } from './useItemCost';
import { useRunePrices } from './useRunePrices';

// specs/061-simplification-page-brisage: pick an item, read the verdict. The cost comes from the price
// already noted on Recherche, the coefficient is remembered per item, each line starts at its average
// roll. Everything shown is an ESTIMATE from unofficial formulas (specs/060-page-brisage H1–H4).

const RUNES = (runeItems as RuneItemsData).runes;
const SETTINGS = defaultBrisageSettings();
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

type PickedItem = { id: string; name: string; level?: number; imageUrl?: string };
type Range = { effectId: number; from: number; to: number };

const parse = (text: string): number => (text.trim() === '' ? NaN : Number(text.replace(/\s/g, '').replace(',', '.')));

const statLabel = (effectId: number) => brisageStat(effectId)?.label ?? `Effet ${effectId}`;
const rangeText = (range: Range) => (range.from === range.to ? `${range.from}` : `${range.from} à ${range.to}`);
const shortRune = (option: BrisageOption) => (option.focusRuneName ?? '').replace('Rune ', '').trim();

/** The coefficients the gain strip shows: a bit above the current one, the current one, halfway to the threshold, the threshold, below it. */
function strip(current: number, threshold: number): { coefficient: number; role?: 'current' | 'threshold' }[] {
  const points: { coefficient: number; role?: 'current' | 'threshold' }[] = [
    { coefficient: Math.min(100, Math.round(current * 1.3)) },
    { coefficient: current, role: 'current' },
    { coefficient: Math.round((current + threshold) / 2) },
    { coefficient: threshold, role: 'threshold' },
    { coefficient: Math.round(threshold * 0.75) },
  ];
  const seen = new Set<number>();
  // The points that carry a role come first, so a plain point never hides « actuel » or « seuil » at the same value.
  return points
    .filter((point) => point.coefficient >= 1 && point.coefficient <= 100)
    .sort((a, b) => Number(b.role !== undefined) - Number(a.role !== undefined))
    .filter((point) => {
      const key = Math.round(point.coefficient * 10);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.coefficient - a.coefficient);
}

/** Two lines of the same stat count as one (the analysis adds them up): one row, the ranges added. */
function mergeRanges(ranges: Range[]): Range[] {
  const merged = new Map<number, Range>();
  for (const range of ranges) {
    const known = merged.get(range.effectId);
    merged.set(range.effectId, known ? { effectId: range.effectId, from: known.from + range.from, to: known.to + range.to } : range);
  }
  return [...merged.values()];
}

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
    setItem({ id: found.id, name: found.name, level: found.level, imageUrl: found.imageUrl });
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
  const breakable = mergeRanges(ranges.filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize)));
  const lines = breakable.map((range, index) => {
    const average = averageRoll(range.from, range.to);
    const typed = parse(rolls[index] ?? '');
    const invalid = typed < 0;
    const modified = typed >= 0 && typed !== average;
    return { index, range, average, value: typed >= 0 ? typed : average, modified, invalid };
  });
  const ignoredCount = ranges.length - ranges.filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize)).length;
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
  const ok = analysis?.status === 'ok' ? analysis : undefined;
  const best = ok?.best;
  const normal = ok?.options.find((option) => option.kind === 'normal');
  const focusOptions = ok?.options.filter((option) => option.kind === 'focus') ?? [];
  const bestFocus = focusOptions.find((option) => option.gainKamas !== undefined);
  // A focus is only worth showing when it pays more than breaking normally (FR-013).
  const focusWins = best?.kind === 'focus' && best.gainKamas! >= 0;
  const missingNames = ok ? [...new Set(ok.options.flatMap((o) => o.missingRuneIds))].map((id) => RUNES.find((r) => r.id === id)?.name ?? id) : [];
  const unconfirmed = breakable.map((range) => brisageStat(range.effectId)).filter((stat) => stat && !stat.confirmed).map((stat) => stat!.label);
  const gains = ok && normal?.gainKamas !== undefined && ok.thresholdCoefficient !== undefined
    ? strip(coefficient, ok.thresholdCoefficient).map((point) => ({
      ...point,
      gain: (normal.valueKamas * point.coefficient) / coefficient - cost,
    }))
    : [];

  let verdict = { title: 'Prix manquants', hint: undefined as string | undefined, tone: 'neutral' as 'good' | 'bad' | 'neutral' };
  if (best && best.gainKamas! < 0) verdict = { title: 'Pas rentable', hint: 'Même le meilleur choix ne couvre pas le coût de l\'objet.', tone: 'bad' };
  else if (best?.kind === 'normal') verdict = { title: 'Rentable sans focus', hint: 'Le focus ne rapporte pas plus : brisez normalement.', tone: 'good' };
  else if (best) verdict = { title: `Rentable avec un focus ${shortRune(best)}`, hint: undefined, tone: 'good' };

  return (
    <>
      <header className="page-header">
        <h1>Brisage</h1>
        <p>Cet objet est-il rentable à briser ? Sur quelle rune faire un focus ?</p>
      </header>

      <section className="panel brisage-block" aria-labelledby="brisage-item">
        <h2 id="brisage-item">{item ? 'Objet à briser' : 'Choisissez un objet'}</h2>
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

        {item && (
          <div className="brisage-item">
            <div className="brisage-item-id">
              <ResourceDisplay resource={{ id: item.id, name: item.name, imageUrl: item.imageUrl }} />
              {item.level !== undefined && <span className="fm-note">Niveau {item.level}</span>}
            </div>

            <div className="brisage-field">
              <span className="brisage-field-label">Coût de l'objet</span>
              {itemCost.status === 'ready' && itemCost.costKamas !== undefined && (
                <>
                  <span className="brisage-cost"><Kamas value={itemCost.costKamas} /></span>
                  <span className="fm-note">Prix noté sur la page Recherche</span>
                </>
              )}
              {itemCost.status === 'ready' && itemCost.costKamas === undefined && (
                <>
                  <label className="visually-hidden" htmlFor="brisage-cost-input">Coût de l'objet (kamas)</label>
                  <input id="brisage-cost-input" type="number" inputMode="numeric" min={0} value={manualCost} onChange={(event) => setManualCost(event.target.value)} />
                  <span className="fm-note">Aucun prix disponible pour cet objet (page Recherche) : saisissez-le.</span>
                </>
              )}
            </div>

            <div className="brisage-field">
              <label className="brisage-field-label" htmlFor="brisage-coefficient">
                {stored ? 'Coefficient de brisage (nouveau relevé)' : 'Coefficient relevé en jeu après un brisage (%)'}
              </label>
              <input
                id="brisage-coefficient"
                type="number" inputMode="decimal" min={1} max={100}
                placeholder={stored ? String(stored.coefficient) : ''}
                value={coefficientText}
                onChange={(event) => setCoefficientText(event.target.value)}
                onBlur={rememberCoefficient}
              />
              {stored ? (
                <span className="fm-note" id="brisage-last">
                  Dernier coefficient : <b>{number.format(stored.coefficient)} %</b> ({date.format(new Date(stored.savedAt))})
                </span>
              ) : (
                <span className="fm-note">Cet objet n'a pas encore été brisé ici : brisez-le en jeu, puis notez son coefficient.</span>
              )}
            </div>
          </div>
        )}
        {loadState === 'loading' && <p className="fm-note" role="status">Lecture des stats…</p>}
        {loadState === 'failed' && <p className="fm-error" role="alert">Les stats de cet objet n'ont pas pu être lues.</p>}
        {item && loadState === 'idle' && ranges.length === 0 && <p className="fm-note">Cet objet n'a aucune ligne à briser.</p>}
      </section>

      {item && analysis && (
        <section className="brisage-results" aria-labelledby="brisage-results-title">
          <h2 id="brisage-results-title" className="visually-hidden">Résultat</h2>
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

              <div className={`pet-podium-card brisage-verdict brisage-verdict--${verdict.tone}`} aria-live="polite">
                <span className="brisage-verdict-label">Verdict</span>
                <p className="brisage-verdict-title">{verdict.title}</p>
                {best && (
                  <p className="brisage-verdict-gain">
                    <Kamas value={Math.round(best.gainKamas!)} signed /> par objet
                    {focusWins && normal?.gainKamas !== undefined && (
                      <>{', contre '}<Kamas value={Math.round(normal.gainKamas)} signed /> sans focus</>
                    )}
                  </p>
                )}
                {verdict.hint && <p className="fm-note">{verdict.hint}</p>}
                {analysis.thresholdCoefficient !== undefined && (
                  <dl className="brisage-facts">
                    <div><dt>Sans focus, rentable jusqu'à</dt><dd>{number.format(analysis.thresholdCoefficient)} %</dd></div>
                    <div><dt>Brisages possibles avant ce seuil</dt><dd>{analysis.itemsCount}</dd></div>
                  </dl>
                )}
              </div>

              <section className="panel brisage-block" aria-labelledby="brisage-lines-title">
                <div className="brisage-block-head">
                  <h2 id="brisage-lines-title">Lignes de l'objet</h2>
                  <span className="fm-note">Le jet moyen est proposé : tapez un jet pour le remplacer</span>
                </div>
                <div className="brisage-table-wrap">
                  <table className="brisage-table" role="table">
                    <caption className="visually-hidden">Runes obtenues, avec et sans focus, pour chaque ligne de l'objet</caption>
                    <thead>
                      <tr role="row">
                        <th scope="col" rowSpan={2}>Ligne</th>
                        <th scope="col" rowSpan={2}>Jet</th>
                        <th scope="col" rowSpan={2}>Rune</th>
                        <th scope="col" rowSpan={2}>Prix de la rune</th>
                        <th scope="colgroup" colSpan={2} className="brisage-group">Sans focus</th>
                        <th scope="colgroup" colSpan={2} className="brisage-group brisage-group--focus">Focus sur cette rune</th>
                      </tr>
                      <tr role="row">
                        <th scope="col">Runes</th><th scope="col">Valeur</th><th scope="col">Runes</th><th scope="col">Gain de l'objet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const found = runeForStat(RUNES, line.range.effectId, SETTINGS.runeSize)!;
                        const plain = normal?.yields.find((y) => y.effectId === line.range.effectId);
                        const focus = focusOptions.find((option) => option.focusEffectId === line.range.effectId);
                        const focusYield = focus?.yields.find((y) => y.effectId === line.range.effectId);
                        const isBest = focusWins && best?.focusEffectId === line.range.effectId;
                        const label = statLabel(line.range.effectId);
                        return (
                          <tr role="row" key={line.index} className={isBest ? 'brisage-best' : undefined}>
                            <th scope="row" role="rowheader" data-label="Ligne">
                              <span className="brisage-line-name">
                                {label} <span className="fm-note">{rangeText(line.range)}</span>
                                {isBest && <span className="brisage-badge">Meilleur focus</span>}
                              </span>
                            </th>
                            <td role="cell" data-label={line.modified ? 'Jet modifié' : 'Jet'}>
                              <input
                                type="number" inputMode="decimal" min={0}
                                className={line.modified ? 'brisage-roll is-modified' : 'brisage-roll'}
                                aria-label={`Jet de ${label}`}
                                aria-invalid={line.invalid || undefined}
                                placeholder={String(line.average)}
                                value={rolls[line.index] ?? ''}
                                onChange={(event) => setRolls({ ...rolls, [line.index]: event.target.value })}
                              />
                              <span className="brisage-roll-state fm-note">{line.invalid ? 'jet invalide : moyen utilisé' : line.modified ? 'modifié' : 'moyen'}</span>
                            </td>
                            <td role="cell" data-label="Rune"><ResourceDisplay resource={{ id: found.rune.id, name: found.rune.name, imageUrl: found.rune.imageUrl }} /></td>
                            <td role="cell" data-label="Prix de la rune">{plain?.unitPriceKamas !== undefined ? <Kamas value={plain.unitPriceKamas} /> : <span className="fm-note">prix manquant</span>}</td>
                            <td role="cell" data-label="Sans focus : runes">{plain ? number.format(plain.count) : '—'}</td>
                            <td role="cell" data-label="Sans focus : valeur">{plain?.valueKamas !== undefined ? <Kamas value={Math.round(plain.valueKamas)} /> : <span className="fm-note">—</span>}</td>
                            <td role="cell" data-label="Focus : runes">{focusYield ? number.format(focusYield.count) : '—'}</td>
                            <td role="cell" data-label="Focus : gain de l'objet">{focus?.gainKamas !== undefined ? <Kamas value={Math.round(focus.gainKamas)} signed /> : <span className="fm-note">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr role="row">
                        <th scope="row" role="rowheader" colSpan={4}>Total de l'objet, coût déduit</th>
                        <td />
                        <td role="cell" data-label="Sans focus : total">{normal?.gainKamas !== undefined ? <Kamas value={Math.round(normal.gainKamas)} signed /> : '—'}</td>
                        <td />
                        <td role="cell" data-label="Meilleur focus : total">{bestFocus ?<Kamas value={Math.round(bestFocus.gainKamas!)} signed /> : '—'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {ignoredCount > 0 && (
                  <p className="fm-note">{ignoredCount} ligne(s) sans poids ni rune connus ne sont pas comptées.</p>
                )}
                {unconfirmed.length > 0 && <p className="fm-note">Poids à confirmer par un relevé : {[...new Set(unconfirmed)].join(', ')}.</p>}
              </section>

              {gains.length > 0 && (
                <section className="panel brisage-block" aria-labelledby="brisage-gains-title">
                  <div className="brisage-block-head">
                    <h2 id="brisage-gains-title">Gain sans focus selon le coefficient</h2>
                    <span className="fm-note">Le coefficient baisse à chaque brisage</span>
                  </div>
                  <ul className="brisage-gains">
                    {gains.map((point) => (
                      <li key={point.coefficient} className={point.role ? `is-${point.role}` : undefined}>
                        <span className="brisage-gain-label">
                          à {number.format(point.coefficient)} %{point.role === 'current' ? ' · actuel' : point.role === 'threshold' ? ' · seuil' : ''}
                        </span>
                        <span className={`brisage-gain-value${point.gain < -0.5 ? ' is-loss' : ''}`}>
                          <Kamas value={Math.round(point.gain)} signed />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </section>
      )}

      <div className="panel brisage-estimate" role="note">
        <Icon name="info" size={18} />
        <p>
          <b>Tout est une estimation.</b> Le coefficient descend selon une formule mesurée sur des objets de niveau 40 ; le
          calcul du focus est une <b>hypothèse non officielle</b>, à confirmer en jeu. Prix des runes : {priceMode === 'community' ? 'prix partagés' : 'vos prix enregistrés'}.
        </p>
      </div>
    </>
  );
}
