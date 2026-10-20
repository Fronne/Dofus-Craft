import { useEffect, useMemo, useRef, useState } from 'react';
import runeItems from '../../data/rune-items.json';
import { useActiveServer } from '../../app/ServerContext';
import { Icon } from '../../components/Icon';
import { getItemEffectRanges } from '../../data/catalogue-repository';
import {
  analyzeBrisage,
  averageRoll,
  brisageStat,
  defaultBrisageSettings,
  MAX_COEFFICIENT,
  nextCoefficient,
  runeForStat,
  type BrisageOption,
} from '../../domain/brisage';
import type { RuneItemsData } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import type { Item } from '../../domain/types';
import { getStoredCoefficient, saveCoefficient, type StoredCoefficient } from '../../persistence/brisage-coefficients';
import { getBrisageSession, setBrisageSession, type BrisageSession, type PriceSource } from '../../persistence/brisage-session';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { MIN_QUERY_LENGTH, useEquipmentSearch } from '../forgemagie/useEquipmentSearch';
import { Kamas } from '../prices/PricesPage';
import { useItemCost } from './useItemCost';
import { useItemCraftCost } from './useItemCraftCost';
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
const shortRune = (option: BrisageOption) => (option.focusRuneName ?? '').replace('Rune ', '').trim();

/** The coefficients of the next breaks: each item broken lowers the coefficient (see nextCoefficient). */
function nextCoefficients(current: number, count: number): number[] {
  const list: number[] = [];
  let value = current;
  for (let i = 0; i < count; i += 1) {
    value = nextCoefficient(value);
    if (!(value > 0)) break;
    list.push(value);
  }
  return list;
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
  const [priceSource, setPriceSource] = useState<PriceSource>('hdv');
  const pickToken = useRef(0);

  /** Opens an item; `restore` brings back what was typed on it before a reload. */
  const openItem = (picked: PickedItem, restore?: Pick<BrisageSession, 'rolls' | 'coefficientText' | 'manualCost' | 'priceSource'>) => {
    const token = ++pickToken.current;
    setItem(picked);
    setQuery('');
    setRanges([]);
    setRolls(restore?.rolls ?? {});
    setCoefficientText(restore?.coefficientText ?? '');
    setManualCost(restore?.manualCost ?? '');
    // Picking another item keeps the chosen source; only a restored session brings its own back.
    if (restore) setPriceSource(restore.priceSource);
    setStored(serverId ? getStoredCoefficient(serverId, picked.id) : undefined);
    setLoadState('loading');
    getItemEffectRanges(picked.id)
      .then((result) => {
        if (pickToken.current !== token) return;
        setRanges(result);
        setLoadState('idle');
      })
      .catch(() => {
        if (pickToken.current === token) setLoadState('failed');
      });
  };

  const changeItem = () => {
    pickToken.current += 1;
    setItem(undefined);
    setRanges([]);
    setLoadState('idle');
  };

  const pick = (found: Item) => openItem({ id: found.id, name: found.name, level: found.level, imageUrl: found.imageUrl });

  // A reload brings back the item and what was typed on it; nothing is saved before this has run.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!serverId || restored) return;
    const session = getBrisageSession();
    if (session && session.serverId === serverId) openItem(session.item, session);
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, restored]);
  useEffect(() => {
    if (!restored || !serverId) return;
    setBrisageSession(item ? { serverId, item, rolls, coefficientText, manualCost, priceSource } : undefined);
  }, [restored, serverId, item, rolls, coefficientText, manualCost, priceSource]);

  const rememberCoefficient = () => {
    const value = parse(coefficientText);
    if (!serverId || !item || !(value > 0 && value <= MAX_COEFFICIENT)) return;
    setStored(saveCoefficient(serverId, item.id, value));
    setCoefficientText('');
  };

  // specs/062: the price of the item is the HDV price noted on Recherche or the cost of its craft chain.
  // The craft chain is only loaded when it is the chosen source. A typed price fills in when the chosen
  // source has none; a zero or negative price is never accepted.
  const hdvCost = useItemCost(serverId, item?.id, priceMode);
  const craftCost = useItemCraftCost(serverId, priceSource === 'craft' ? item?.id : undefined, priceMode);
  const priceState = priceSource === 'craft' ? craftCost : hdvCost;
  const typedPrice = parse(manualCost);
  const typedCoefficient = parse(coefficientText);
  const coefficient = typedCoefficient > 0 ? typedCoefficient : stored?.coefficient ?? NaN;
  const cost = priceState.costKamas ?? (typedPrice > 0 ? typedPrice : NaN);
  const priceOrigin = priceState.costKamas !== undefined
    ? (priceSource === 'craft' ? `Coût de la chaîne de craft (${priceMode === 'community' ? 'mode communautaire' : 'mode personnel'})` : 'Prix noté sur la page Recherche')
    : typedPrice > 0 ? 'Saisi à la main' : undefined;
  const noPriceReason = priceSource === 'craft'
    ? (craftCost.reason === 'no-recipe'
      ? 'Aucun craft n\'existe pour cet objet : saisissez son prix.'
      : 'Prix de craft incomplet (il manque le prix d\'une ressource) : saisissez le prix de l\'objet.')
    : 'Aucun prix disponible pour cet objet (page Recherche) : saisissez-le.';

  // Only the lines that break into a known rune are shown; the others are just counted.
  const breakable = mergeRanges(ranges.filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize)));
  const lines = breakable.map((range, index) => {
    const average = averageRoll(range.from, range.to);
    // A line with a single value (PO, Ga PA, Ga PM…) can still be typed over; only the Min / Max switch skips it.
    const fixed = range.from === range.to;
    const parsed = parse(rolls[index] ?? '');
    const typed = Number.isFinite(parsed) ? parsed : NaN;
    const invalid = parsed < 0 || parsed === Infinity;
    const modified = typed >= 0 && typed !== average;
    return { index, range, average, fixed, value: typed >= 0 ? typed : average, modified, invalid };
  });
  // The Min / Moyen / Max switch of the Jet column: which one all the free lines are set to, if any.
  const freeLines = lines.filter((line) => !line.fixed);
  const rollMode: 'min' | 'average' | 'max' | undefined = freeLines.length === 0 ? undefined
    : freeLines.every((line) => (rolls[line.index] ?? '') === '') ? 'average'
      : freeLines.every((line) => parse(rolls[line.index] ?? '') === line.range.from) ? 'min'
        : freeLines.every((line) => parse(rolls[line.index] ?? '') === line.range.to) ? 'max'
          : undefined;
  const setAllRolls = (mode: 'min' | 'average' | 'max') => setRolls(
    mode === 'average' ? {} : Object.fromEntries(freeLines.map((line) => [line.index, String(mode === 'min' ? line.range.from : line.range.to)])),
  );
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

  const analysis = item && ranges.length > 0 && priceState.status === 'ready'
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
  const currentGain = ok ? normal?.gainKamas : undefined;
  const nextGains = ok && normal?.gainKamas !== undefined && coefficient > 0
    ? nextCoefficients(coefficient, 3).map((next) => ({ coefficient: next, gain: (normal.valueKamas * next) / coefficient - cost }))
    : [];

  let verdict = { title: 'Prix manquants', hint: undefined as string | undefined, tone: 'neutral' as 'good' | 'bad' | 'neutral' };
  if (best && best.gainKamas! < 0) verdict = { title: 'Pas rentable', hint: 'Même le meilleur choix ne couvre pas le prix de l\'objet.', tone: 'bad' };
  else if (best?.kind === 'normal') verdict = { title: 'Rentable sans focus', hint: 'Le focus ne rapporte pas plus : brisez normalement.', tone: 'good' };
  else if (best) verdict = { title: `Rentable avec un focus ${shortRune(best)}`, hint: undefined, tone: 'good' };

  return (
    <>
      <header className="page-header">
        <h1>Brisage</h1>
        <p>Cet objet est-il rentable à briser ? Sur quelle rune faire un focus ?</p>
      </header>

      <section className="panel brisage-block" aria-labelledby="brisage-item">
        <h2 id="brisage-item" className={item ? 'visually-hidden' : undefined}>{item ? 'Objet à briser' : 'Choisissez un objet'}</h2>
        {!item && (
          <div className="search-input-wrap">
            <Icon name="search" size={18} className="search-input-icon" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Chercher un objet…" aria-label="Chercher un objet" />
          </div>
        )}
        {!item && query.trim().length >= MIN_QUERY_LENGTH && (
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
          <div className="item-head">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} />
            ) : (
              <div className="image-fallback" role="img" aria-label={`Visuel indisponible pour ${item.name}`}><Icon name="search" size={22} /></div>
            )}
            <div className="item-head-text">
              <h3>{item.name}</h3>
              {item.level !== undefined && <div className="item-head-tags"><p>Niveau : {item.level}</p></div>}
            </div>
            <div className="item-head-actions">
              <button type="button" className="pin-item-button item-history-button" onClick={changeItem}>Changer d'objet</button>
            </div>
          </div>
        )}
        {item && (
          <div className="brisage-item">
            <div className="brisage-field">
              <span className="brisage-field-label" id="brisage-price-label">Prix de l'objet</span>
              <div className="brisage-price-source" role="radiogroup" aria-labelledby="brisage-price-label">
                {(['hdv', 'craft'] as const).map((source) => (
                  <label key={source} className={priceSource === source ? 'is-selected' : undefined}>
                    <input className="visually-hidden" type="radio" name="brisage-price-source" value={source} checked={priceSource === source} onChange={() => setPriceSource(source)} />
                    <span>{source === 'hdv' ? 'Prix HDV' : 'Prix de craft'}</span>
                  </label>
                ))}
              </div>
              {priceState.status === 'loading' && <span className="fm-note">Calcul du prix en cours…</span>}
              {priceState.status === 'ready' && priceState.costKamas !== undefined && (
                <>
                  <span className="brisage-cost"><Kamas value={priceState.costKamas} /></span>
                  <span className="brisage-price-origin">{priceOrigin}</span>
                </>
              )}
              {priceState.status === 'ready' && priceState.costKamas === undefined && (
                <>
                  <label className="visually-hidden" htmlFor="brisage-cost-input">Prix de l'objet (kamas)</label>
                  <input id="brisage-cost-input" type="number" inputMode="numeric" min={1} value={manualCost} onChange={(event) => setManualCost(event.target.value)} />
                  <span className="fm-note">{noPriceReason}</span>
                  {priceOrigin && <span className="brisage-price-origin">{priceOrigin}</span>}
                </>
              )}
            </div>

            <div className="brisage-field">
              <label className="brisage-field-label" htmlFor="brisage-coefficient">
                {stored ? 'Coefficient de brisage (nouveau relevé)' : 'Coefficient relevé en jeu après un brisage (%)'}
              </label>
              <div className="brisage-coef">
                <input
                  id="brisage-coefficient"
                  type="number" inputMode="decimal" min={1} max={MAX_COEFFICIENT}
                  placeholder={stored ? String(stored.coefficient) : ''}
                  value={coefficientText}
                  onChange={(event) => setCoefficientText(event.target.value)}
                  onBlur={rememberCoefficient}
                />
                <span aria-hidden="true">%</span>
              </div>
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

              <section className="panel market-price-panel item-verdict-panel" aria-live="polite">
                <div className="market-price-summary">
                  <div className={`verdict brisage-verdict verdict--${verdict.tone === 'good' ? 'craft' : verdict.tone === 'bad' ? 'bad' : 'insufficient-data'}`}>
                    <div className="verdict-head">
                      <span className="verdict-icon" aria-hidden="true"><Icon name={verdict.tone === 'good' ? 'check' : 'info'} size={22} /></span>
                      <div className="verdict-text">
                        <span className="brisage-verdict-label">Verdict</span>
                        <p className="verdict-title">{verdict.title}</p>
                        {best && (
                          <p className="verdict-subtitle">
                            <Kamas value={Math.round(best.gainKamas!)} signed /> par objet
                            {focusWins && normal?.gainKamas !== undefined && (
                              <>{', contre '}<Kamas value={Math.round(normal.gainKamas)} signed /> sans focus</>
                            )}
                          </p>
                        )}
                        {verdict.hint && <p className="verdict-subtitle">{verdict.hint}</p>}
                      </div>
                    </div>
                    {analysis.thresholdCoefficient !== undefined && (
                      <dl className="brisage-facts">
                        <div><dt>Sans focus, rentable jusqu'à</dt><dd>{number.format(analysis.thresholdCoefficient)} %</dd></div>
                        <div><dt>Brisages possibles avant ce seuil</dt><dd>{analysis.itemsCount}</dd></div>
                      </dl>
                    )}
                  </div>
                </div>
              </section>

              <section className="panel brisage-block" aria-labelledby="brisage-lines-title">
                <div className="brisage-block-head">
                  <h2 id="brisage-lines-title">Lignes de l'objet</h2>
                </div>
                <div className="brisage-table-wrap">
                  <table className="brisage-table" role="table">
                    <caption className="visually-hidden">Runes obtenues, avec et sans focus, pour chaque ligne de l'objet</caption>
                    <thead>
                      <tr role="row">
                        <th scope="col" rowSpan={2}>Rune</th>
                        <th scope="col" rowSpan={2} className="brisage-jet-head">
                          <span className="brisage-jet-title">Jet</span>
                          <span className="brisage-seg" role="group" aria-label="Régler tous les jets">
                            {([['min', 'Min'], ['average', 'Moyen'], ['max', 'Max']] as const).map(([mode, text]) => (
                              <button key={mode} type="button" aria-pressed={rollMode === mode} className={rollMode === mode ? 'is-on' : undefined} onClick={() => setAllRolls(mode)}>{text}</button>
                            ))}
                          </span>
                        </th>
                        <th scope="col" rowSpan={2}>Prix unitaire</th>
                        <th scope="colgroup" colSpan={2} className="brisage-group brisage-group--plain"><span className="brisage-group-title">Sans focus</span></th>
                        <th scope="colgroup" colSpan={2} className="brisage-group brisage-group--focus"><span className="brisage-group-title">Avec focus</span></th>
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
                            <th scope="row" role="rowheader" data-label="Rune">
                              <span className="brisage-line-name" title={label}>
                                <ResourceDisplay resource={{ id: found.rune.id, name: found.rune.name, imageUrl: found.rune.imageUrl }} />
                                <span className="brisage-stat-name">{label}</span>
                                {isBest && <span className="brisage-badge">Meilleur focus</span>}
                              </span>
                            </th>
                            <td role="cell" data-label={line.modified ? 'Jet modifié' : 'Jet'}>
                              <>
                                  <span className="brisage-jet">
                                    {!line.fixed && <span className="brisage-bound">{line.range.from}</span>}
                                    <input
                                      type="number" inputMode="decimal" min={0}
                                      className={line.modified ? 'brisage-roll is-modified' : 'brisage-roll'}
                                      aria-label={`Jet de ${label}`}
                                      aria-invalid={line.invalid || undefined}
                                      placeholder={String(line.average)}
                                      value={rolls[line.index] ?? ''}
                                      onChange={(event) => setRolls({ ...rolls, [line.index]: event.target.value })}
                                    />
                                    {!line.fixed && <span className="brisage-bound">{line.range.to}</span>}
                                  </span>
                                  <span className="brisage-roll-state fm-note">{line.invalid ? 'jet invalide : moyen utilisé' : line.modified ? 'modifié' : line.fixed ? '' : 'moyen'}</span>
                              </>
                            </td>
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
                        <th scope="row" role="rowheader" colSpan={3}>Total de l'objet, prix déduit</th>
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
              </section>

              {nextGains.length > 0 && (
                <section className="panel brisage-block" aria-labelledby="brisage-gains-title">
                  <div className="brisage-block-head">
                    <h2 id="brisage-gains-title">Gain selon le coefficient</h2>
                  </div>
                  <div className="brisage-gains-layout">
                    <div className="brisage-gains-now">
                      <span className="brisage-gain-label">Coefficient actuel</span>
                      <span className="brisage-gain-coef">{number.format(coefficient)} %</span>
                      {currentGain !== undefined && currentGain > 0.5 && (
                        <span className="brisage-gain-value">
                          <Kamas value={Math.round(currentGain)} signed /> <span className="fm-note">sans focus</span>
                        </span>
                      )}
                      {focusWins && (
                        <span className="brisage-gain-value">
                          <Kamas value={Math.round(best!.gainKamas!)} signed /> <span className="fm-note">avec un focus {shortRune(best!)}</span>
                        </span>
                      )}
                    </div>
                    <div className="brisage-gains-next">
                      <span className="brisage-gain-label">3 prochains brisages (sans focus, estimation)</span>
                      <ul className="brisage-gains">
                        {nextGains.map((point) => (
                          <li key={point.coefficient}>
                            <span className="brisage-gain-label">à {number.format(point.coefficient)} %</span>
                            <span className={`brisage-gain-value${point.gain < -0.5 ? ' is-loss' : ''}`}>
                              <Kamas value={Math.round(point.gain)} signed />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
