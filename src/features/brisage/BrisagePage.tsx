import { useEffect, useMemo, useRef, useState } from 'react';
import runeItems from '../../data/rune-items.json';
import { useActiveServer } from '../../app/ServerContext';
import { Icon } from '../../components/Icon';
import { getItemEffectRanges } from '../../data/catalogue-repository';
import {
  analyzeBrisage,
  analyzeFocusAdvice,
  averageRoll,
  brisageStat,
  defaultBrisageSettings,
  BRISAGE_STATS,
  displayedCoefficient,
  lineValueLimit,
  MAX_COEFFICIENT,
  nextCoefficient,
  wholeRunes,
  runeForStat,
  type BrisageOption,
} from '../../domain/brisage';
import { resolveItemPrice } from '../../domain/brisage-price';
import type { RuneItemsData } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import { getStoredCoefficient, saveCoefficient, type StoredCoefficient } from '../../persistence/brisage-coefficients';
import { getBrisageExos, setBrisageExos } from '../../persistence/brisage-exos';
import { getBrisageSession, setBrisageSession, type BrisageSession, type PriceSource } from '../../persistence/brisage-session';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { Kamas } from '../prices/PricesPage';
import { ExoRow, type ExoEntry, type ExoRuneChoice } from './ExoRow';
import { ItemFinder } from './ItemFinder';
import { ItemHeader } from './ItemHeader';
import { useItemCost } from './useItemCost';
import { useItemCraftCost } from './useItemCraftCost';
import { useRunePrices } from './useRunePrices';

// specs/065-refonte-page-brisage: the page opens on the item search (ItemFinder: name, filters, cards), then the item
// header (ItemHeader), the table, and a compact line of side figures at the bottom.
// specs/061-simplification-page-brisage: pick an item, read the verdict. The cost comes from the price
// already noted on Recherche, the coefficient is remembered per item, each line starts at its average
// roll. Everything shown is an ESTIMATE from unofficial formulas (specs/060-page-brisage H1–H4).

const RUNES = (runeItems as RuneItemsData).runes;
const SETTINGS = defaultBrisageSettings();
const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

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
  const [item, setItem] = useState<PickedItem>();
  const [ranges, setRanges] = useState<Range[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [rolls, setRolls] = useState<Record<number, string>>({});
  // specs/066: the exos put on this item, the last added first (as in the game); kept per item.
  const [storedExos, setExos] = useState<ExoEntry[]>([]);
  // A restored exo only counts while its stat is still absent from the item and still has a rune; a new one has no rune yet.
  const exoEntries = storedExos.filter((exo) => exo.effectId === undefined
    || (runeForStat(RUNES, exo.effectId, SETTINGS.runeSize) && !ranges.some((range) => range.effectId === exo.effectId)));
  const exos = exoEntries.filter((exo): exo is { effectId: number; value: number } => exo.effectId !== undefined);
  const [stored, setStored] = useState<StoredCoefficient>();
  const [coefficientText, setCoefficientText] = useState('');
  const [manualCost, setManualCost] = useState('');
  // specs/065: a new item starts on Auto, the cheaper of the HDV price and the craft cost.
  const [priceSource, setPriceSource] = useState<PriceSource>('auto');
  const pickToken = useRef(0);

  /** Opens an item; `restore` brings back what was typed on it before a reload. */
  const openItem = (picked: PickedItem, restore?: Pick<BrisageSession, 'rolls' | 'coefficientText' | 'manualCost' | 'priceSource'>) => {
    // Clicking the item already open must not wipe what was typed on it.
    if (!restore && picked.id === item?.id) return;
    const token = ++pickToken.current;
    setItem(picked);
    setRanges([]);
    setExos(serverId ? getBrisageExos(serverId, picked.id) : []);
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

  const changeExos = (next: ExoEntry[]) => {
    setExos(next);
    if (serverId && item) setBrisageExos(serverId, item.id, next.filter((exo): exo is { effectId: number; value: number } => exo.effectId !== undefined));
  };

  const rememberCoefficient = () => {
    const value = parse(coefficientText);
    if (!serverId || !item || !(value > 0 && value <= MAX_COEFFICIENT)) return;
    setStored(saveCoefficient(serverId, item.id, value));
    setCoefficientText('');
  };

  // specs/062 + specs/065: the price of the item is the HDV price noted on Recherche, the cost of its craft chain, or
  // the cheaper of the two (Auto). Both are read as soon as an item is picked so they can be shown side by side. A
  // typed price fills in when the chosen source has none; a zero or negative price is never accepted.
  const hdvCost = useItemCost(serverId, item?.id, priceMode);
  const craftCost = useItemCraftCost(serverId, item?.id, priceMode);
  const priceLoading = (priceSource !== 'craft' && hdvCost.status === 'loading') || (priceSource !== 'hdv' && craftCost.status === 'loading');
  const priceReady = !priceLoading;
  const resolvedPrice = priceReady ? resolveItemPrice(hdvCost.costKamas, craftCost.costKamas, priceSource) : undefined;
  const typedPrice = parse(manualCost);
  const typedCoefficient = parse(coefficientText);
  const coefficient = typedCoefficient > 0 ? typedCoefficient : stored?.coefficient ?? NaN;
  const cost = resolvedPrice?.kamas ?? (typedPrice > 0 ? typedPrice : NaN);
  const priceOrigin = resolvedPrice
    ? (resolvedPrice.origin === 'craft' ? `Coût de la chaîne de craft (${priceMode === 'community' ? 'mode communautaire' : 'mode personnel'})` : 'Prix noté sur la page Recherche')
    : typedPrice > 0 ? 'Saisi à la main' : undefined;
  const noPriceReason = priceSource === 'craft'
    ? (craftCost.reason === 'no-recipe'
      ? 'Aucun craft n\'existe pour cet objet.'
      : 'Prix de craft incomplet (ressource sans prix).')
    : 'Aucun prix connu pour cet objet.';

  // Only the lines that break into a known rune are shown; the others are just counted.
  const breakable = mergeRanges(ranges.filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize)));
  const lines = breakable.map((range, index) => {
    const average = averageRoll(range.from, range.to);
    // A line with a single value (PO, Ga PA, Ga PM…) can still be typed over; only the Min / Max switch skips it.
    const fixed = range.from === range.to;
    const parsed = parse(rolls[index] ?? '');
    const typed = Number.isFinite(parsed) ? parsed : NaN;
    // specs/066: a roll above the line's maximum is an over, allowed up to the weight limit (or the natural maximum).
    const limit = lineValueLimit(range.effectId, SETTINGS, range.to);
    const tooHigh = typed > limit;
    const invalid = parsed < 0 || parsed === Infinity || tooHigh;
    const usable = typed >= 0 && !tooHigh;
    const modified = usable && typed !== average;
    const over = usable && typed > range.to;
    return { index, range, average, fixed, value: usable ? typed : average, modified, invalid, tooHigh, over, limit };
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
    for (const exo of storedExos) {
      const found = exo.effectId === undefined ? undefined : runeForStat(RUNES, exo.effectId, SETTINGS.runeSize);
      if (found) ids.add(found.rune.id);
    }
    return [...ids].sort();
  }, [ranges, storedExos]);
  const fetched = useRunePrices(serverId, priceMode, runeIds);

  const ready = item && ranges.length > 0 && priceReady;
  const lineInputs = [
    ...exos.map((exo) => ({ effectId: exo.effectId, value: exo.value, exo: true })),
    ...lines.map((line) => ({ effectId: line.range.effectId, value: line.value })),
  ];
  // specs/066: the runes offered as exo are those of the stats the item does not have; each one is taken once.
  const exoRunes: ExoRuneChoice[] = BRISAGE_STATS.flatMap((stat) => {
    const found = ranges.some((range) => range.effectId === stat.effectId) ? undefined : runeForStat(RUNES, stat.effectId, SETTINGS.runeSize);
    return found ? [{ effectId: stat.effectId, label: stat.label, runeName: found.rune.name, imageUrl: found.rune.imageUrl, max: lineValueLimit(stat.effectId, SETTINGS) }] : [];
  });
  const hasNewExo = exoEntries.some((exo) => exo.effectId === undefined);
  const analysis = ready && coefficient > 0
    ? analyzeBrisage({ level: item.level ?? NaN, lines: lineInputs, coefficient, itemCostKamas: cost }, RUNES, fetched.prices, SETTINGS)
    : undefined;
  // specs/063: without a coefficient the table and a focus advice are still shown (normal breaking at 100 %).
  const advice = ready && !(coefficient > 0)
    ? analyzeFocusAdvice({ level: item.level ?? NaN, lines: lineInputs }, RUNES, fetched.prices, SETTINGS)
    : undefined;
  const adviceOk = advice?.status === 'ok' ? advice : undefined;
  // specs/063: the value of the runes of one breaking, known before breaking anything: the lines (with the
  // rolls typed) and the rune prices are enough, the price of the item is not needed. Without a coefficient
  // it is the value at 100 %, the most the item can give.
  const estimateSource = advice ?? (ready ? analyzeFocusAdvice({ level: item.level ?? NaN, lines: lineInputs }, RUNES, fetched.prices, SETTINGS) : undefined);
  const estimateRef = estimateSource?.status === 'ok' && estimateSource.reference.missingRuneIds.length === 0 && !(coefficient > MAX_COEFFICIENT)
    ? estimateSource.reference
    : undefined;
  const runesValue = estimateRef ? estimateRef.valueKamas * (coefficient > 0 ? coefficient / 100 : 1) : undefined;
  const ok = analysis?.status === 'ok' ? analysis : undefined;
  const best = ok?.best;
  const normal = ok ? ok.options.find((option) => option.kind === 'normal') : adviceOk?.reference;
  const focusOptions = ok ? ok.options.filter((option) => option.kind === 'focus') : adviceOk?.focusOptions ?? [];
  const bestFocus = ok ? focusOptions.find((option) => option.gainKamas !== undefined) : adviceOk?.bestFocus;
  // A focus is only worth showing when it pays more than breaking normally (FR-013).
  const focusWins = best?.kind === 'focus' && best.gainKamas! >= 0;
  const noCoefficient = adviceOk !== undefined;
  const costKnown = Number.isFinite(cost);
  /** Gain of the item for an option; without a coefficient, the item price is only deducted when known. */
  const gainOf = (option: BrisageOption | undefined): number | undefined => {
    if (!option) return undefined;
    if (!noCoefficient) return option.gainKamas;
    if (option.missingRuneIds.length > 0) return undefined;
    return costKnown ? option.valueKamas - cost : option.valueKamas;
  };
  const highlightedEffectId = noCoefficient ? bestFocus?.focusEffectId : focusWins ? best?.focusEffectId : undefined;
  const currentGain = ok ? normal?.gainKamas : undefined;
  const nextGains = ok && normal?.gainKamas !== undefined && coefficient > 0
    ? nextCoefficients(coefficient, 3).map((next) => ({ coefficient: next, gain: (normal.valueKamas * next) / coefficient - cost }))
    : [];

  let verdict = { title: 'Prix manquants', hint: undefined as string | undefined, tone: 'neutral' as 'good' | 'bad' | 'neutral' };
  if (best && best.gainKamas! < 0) verdict = { title: 'Pas rentable', hint: 'Même le meilleur choix ne couvre pas le prix de l\'objet.', tone: 'bad' };
  else if (best?.kind === 'normal') verdict = { title: 'Rentable sans focus', hint: 'Le focus ne rapporte pas plus : brisez normalement.', tone: 'good' };
  else if (best) verdict = { title: `Rentable avec un focus ${shortRune(best)}`, hint: undefined, tone: 'good' };

  const invalidReason = analysis?.status === 'invalid' ? analysis.reason : advice?.status === 'invalid' ? advice.reason : undefined;
  // specs/063: the advice shown while the coefficient is unknown.
  const switchCoefficient = adviceOk?.switchCoefficient;
  const adviceTitle = adviceOk?.bestFocus && switchCoefficient !== undefined
    ? `Focus ${shortRune(adviceOk.bestFocus)} sous ${number.format(switchCoefficient)} %`
    : adviceOk?.bestFocus ? `Focus ${shortRune(adviceOk.bestFocus)}` : 'Prix manquants';
  const adviceHint = adviceOk?.bestFocus && switchCoefficient !== undefined
    ? `Au-dessus de ce coefficient, brisez sans focus.${switchCoefficient > 100 ? ' Le focus reste conseillé sur les coefficients courants.' : ''}`
    : adviceOk?.bestFocus ? 'Le brisage normal ne vaut rien à 100 % : pas de coefficient de bascule.' : 'Notez les prix des runes pour obtenir un conseil.';

  return (
    <>
      <h1 className="visually-hidden">Brisage</h1>

      <ItemFinder
        runes={RUNES}
        settings={SETTINGS}
        serverId={serverId}
        priceMode={priceMode}
        selectedId={item?.id}
        onPick={(found) => openItem(found)}
      />

      {!item && <p className="fm-note brisage-invite">Choisissez un objet ci-dessus pour voir son brisage.</p>}
      {item && (
        <section className="panel brisage-unit" aria-label="Objet à briser">
        <div className="brisage-block">
          <ItemHeader
            item={item}
            priceSource={priceSource}
            onPriceSource={setPriceSource}
            loading={priceLoading}
            hdvKamas={hdvCost.costKamas}
            craftKamas={craftCost.costKamas}
            resolved={resolvedPrice}
            originText={priceOrigin}
            manualCost={manualCost}
            onManualCost={setManualCost}
            noPriceReason={noPriceReason}
            stored={stored}
            coefficientText={coefficientText}
            onCoefficientText={setCoefficientText}
            onRememberCoefficient={rememberCoefficient}
          />
          {loadState === 'loading' && <p className="fm-note" role="status">Lecture des stats…</p>}
          {loadState === 'failed' && <p className="fm-error" role="alert">Les stats de cet objet n'ont pas pu être lues.</p>}
          {loadState === 'idle' && ranges.length === 0 && <p className="fm-note">Cet objet n'a aucune ligne à briser.</p>}
        </div>

      {(analysis || advice) && (
        <div className="brisage-results" role="group" aria-labelledby="brisage-results-title">
          <h2 id="brisage-results-title" className="visually-hidden">Résultat</h2>
          {invalidReason !== undefined ? (
            <p className="empty" role="status">{invalidReason}</p>
          ) : (
            <>
              {adviceOk && (
                <section className="brisage-part market-price-panel item-verdict-panel" aria-live="polite">
                  <div className="market-price-summary">
                    <div className={`verdict brisage-verdict verdict--${adviceOk.bestFocus && switchCoefficient !== undefined ? 'craft' : 'insufficient-data'}`}>
                      <div className="verdict-head">
                        <span className="verdict-icon" aria-hidden="true"><Icon name={adviceOk.bestFocus && switchCoefficient !== undefined ? 'check' : 'info'} size={22} /></span>
                        <div className="verdict-text">
                          <span className="brisage-verdict-label">Conseil</span>
                          <p className="verdict-title">{adviceTitle}</p>
                          <p className="verdict-subtitle">{adviceHint}</p>
                          <p className="verdict-subtitle">Coefficient inconnu : indiquez-le (relevé en jeu) pour un verdict précis.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {ok && (
              <section className="brisage-part market-price-panel item-verdict-panel" aria-live="polite">
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
                    {ok.thresholdCoefficient !== undefined && (
                      <dl className="brisage-facts">
                        <div><dt>Sans focus, rentable jusqu'à</dt><dd>{number.format(ok.thresholdCoefficient)} %</dd></div>
                        <div><dt>Brisages possibles avant ce seuil</dt><dd>{ok.itemsCount}</dd></div>
                      </dl>
                    )}
                  </div>
                </div>
              </section>
              )}

              <section className="brisage-part brisage-block" aria-labelledby="brisage-lines-title">
                <div className="brisage-block-head">
                  <h2 id="brisage-lines-title">Lignes de l'objet</h2>
                  {ranges.length > 0 && (
                    <button
                      type="button" className="btn btn-secondary brisage-exo-add" disabled={hasNewExo || exoRunes.length === 0}
                      onClick={() => changeExos([{ value: 1 }, ...exoEntries])}
                    >+ Exo</button>
                  )}
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
                        <th scope="colgroup" colSpan={2} className="brisage-group brisage-group--plain"><span className="brisage-group-title">{noCoefficient ? 'Sans focus (à 100 % : référence)' : 'Sans focus'}</span></th>
                        <th scope="colgroup" colSpan={2} className="brisage-group brisage-group--focus"><span className="brisage-group-title">Avec focus</span></th>
                      </tr>
                      <tr role="row">
                        <th scope="col">Runes</th><th scope="col">Valeur des runes</th><th scope="col">Runes</th><th scope="col">Valeur des runes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exoEntries.map((entry) => {
                        const plain = entry.effectId === undefined ? undefined : normal?.yields.find((y) => y.effectId === entry.effectId);
                        const taken = (effectId: number) => exos.some((other) => other.effectId === effectId && other.effectId !== entry.effectId);
                        return (
                          <ExoRow
                            key={`exo-${entry.effectId ?? 'new'}`}
                            entry={entry}
                            choices={exoRunes.filter((choice) => !taken(choice.effectId))}
                            plain={plain}
                            onPick={(effectId) => {
                              const max = exoRunes.find((choice) => choice.effectId === effectId)?.max ?? 1;
                              changeExos(exoEntries.map((other) => (other === entry ? { effectId, value: Math.min(Math.max(entry.value, 1), max) } : other)));
                            }}
                            onValue={(value) => changeExos(exoEntries.map((other) => (other === entry ? { ...entry, value } : other)))}
                            onRemove={() => changeExos(exoEntries.filter((other) => other !== entry))}
                          />
                        );
                      })}
                      {lines.map((line) => {
                        const found = runeForStat(RUNES, line.range.effectId, SETTINGS.runeSize)!;
                        const plain = normal?.yields.find((y) => y.effectId === line.range.effectId);
                        const focus = focusOptions.find((option) => option.focusEffectId === line.range.effectId);
                        const focusYield = focus?.yields.find((y) => y.effectId === line.range.effectId);
                        const isBest = highlightedEffectId === line.range.effectId;
                        const focusValue = focus && focus.missingRuneIds.length === 0 ? focus.valueKamas : undefined;
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
                            <td role="cell" data-label={line.over ? 'Jet over' : line.modified ? 'Jet modifié' : 'Jet'}>
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
                                  <span className="brisage-roll-state fm-note">{line.tooHigh ? `jet maximal ${line.limit} : moyen utilisé` : line.invalid ? 'jet invalide : moyen utilisé' : line.over ? 'over' : line.modified ? 'modifié' : line.fixed ? '' : 'moyen'}</span>
                              </>
                            </td>
                            <td role="cell" data-label="Prix de la rune">{plain?.unitPriceKamas !== undefined ? <Kamas value={plain.unitPriceKamas} /> : <span className="fm-note">prix manquant</span>}</td>
                            <td role="cell" data-label="Sans focus : runes">{plain ? number.format(wholeRunes(plain.count)) : '—'}</td>
                            <td role="cell" data-label="Sans focus : valeur des runes">{plain?.valueKamas !== undefined ? <Kamas value={Math.round(plain.valueKamas)} /> : <span className="fm-note">—</span>}</td>
                            <td role="cell" data-label="Focus : runes">{focusYield ? number.format(wholeRunes(focusYield.count)) : '—'}</td>
                            <td role="cell" data-label="Focus : valeur des runes">{focusValue !== undefined ? <Kamas value={Math.round(focusValue)} /> : <span className="fm-note">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr role="row">
                        <th scope="row" role="rowheader" colSpan={3}>{noCoefficient && !costKnown ? 'Total des runes' : "Total de l'objet, prix déduit"}</th>
                        <td />
                        <td role="cell" data-label="Sans focus : total">{gainOf(normal) !== undefined ? <Kamas value={Math.round(gainOf(normal)!)} signed={!noCoefficient || costKnown} /> : '—'}</td>
                        <td />
                        <td role="cell" data-label="Meilleur focus : total">{gainOf(bestFocus) !== undefined ? <Kamas value={Math.round(gainOf(bestFocus)!)} signed={!noCoefficient || costKnown} /> : '—'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="fm-note brisage-exo-note">Exo : calcul estimé, repris de DoFocus. Une ligne exo compte comme une ligne de plus, sans focus possible ; poids maximal 101.</p>
                {ignoredCount > 0 && (
                  <p className="fm-note">{ignoredCount} ligne(s) sans poids ni rune connus ne sont pas comptées.</p>
                )}
              </section>

            </>
          )}
          {(runesValue !== undefined || nextGains.length > 0) && (
            <section className="brisage-part brisage-footline" aria-label="Informations annexes">
              {runesValue !== undefined && (
                <section className="brisage-estimate" aria-labelledby="brisage-estimate-title">
                  <h2 id="brisage-estimate-title" className="brisage-gain-label">Valeur estimée des runes</h2>
                  <p className="brisage-estimate-value">
                    <Kamas value={Math.round(runesValue)} />{' '}
                    <span className="fm-note">
                      {coefficient > 0 ? `par brisage à ${displayedCoefficient(coefficient)} %` : 'par brisage à 100 % (maximum : le coefficient est inconnu)'}
                    </span>
                  </p>
                </section>
              )}
              {nextGains.length > 0 && (
                <section className="brisage-gains-layout" aria-labelledby="brisage-gains-title">
                  <h2 id="brisage-gains-title" className="visually-hidden">Gain selon le coefficient</h2>
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
                    <span className="brisage-gain-label">Après 1, 2, 3 brisages (sans focus, estimation)</span>
                    <ul className="brisage-gains">
                      {nextGains.map((point, index) => (
                        <li key={index}>
                          <span className="brisage-gain-label">à {displayedCoefficient(point.coefficient)} %</span>
                          <span className={`brisage-gain-value${point.gain < -0.5 ? ' is-loss' : ''}`}>
                            <Kamas value={Math.round(point.gain)} signed />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}
            </section>
          )}
        </div>
      )}
        </section>
      )}
    </>
  );
}
