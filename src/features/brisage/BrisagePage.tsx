import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import runeItems from '../../data/rune-items.json';
import { useActiveServer } from '../../app/ServerContext';
import { Icon } from '../../components/Icon';
import { getItemEffectRanges, getItemNegativeRanges } from '../../data/catalogue-repository';
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
import { DEFAULT_RANKING_VIEW, type RankingView } from '../../domain/brisage-ranking';
import { useSiteSettings } from '../../app/useSiteSettings';
import { applyRankingAccessFromSearch,withoutRankingParameter } from '../../persistence/brisage-ranking-access';
import type { RuneItemsData } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import { getStoredCoefficient, hasImportedCoefficients, listImportableCoefficients, markCoefficientsImported, removeStoredCoefficient, saveCoefficient, type StoredCoefficient } from '../../persistence/brisage-coefficients';
import { clearSharedCoefficients, MAX_ENTRIES_PER_SEND, submitCoefficients } from '../../services/brisage-coefficient-api';
import { getBrisageExos, setBrisageExos } from '../../persistence/brisage-exos';
import { getBrisageSession, setBrisageSession, type BrisageSession, type PriceSource } from '../../persistence/brisage-session';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { Kamas } from '../prices/PricesPage';
import { ExoRow, type ExoEntry, type ExoRuneChoice } from './ExoRow';
import { ItemFinder } from './ItemFinder';
import { ItemHeader } from './ItemHeader';
import { useItemCost } from './useItemCost';
import { dropSharedCoefficient, useSharedCoefficients } from './use-shared-coefficients';
import { forgetCachedCoefficient } from './useRankingData';
import { useItemCraftCost } from './useItemCraftCost';
import { CraftPricesDialog } from './CraftPricesDialog';
import { RankingTab } from './RankingTab';
import { RunePriceInput } from './RunePriceInput';
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

/**
 * Enter goes down the column it was pressed in: from the price of a rune to the price of the one below, from a roll to the
 * roll below. A price field has already been left by then (RunePriceInput), which is what saves it; on the last line the
 * focus comes back to the field instead of being lost.
 */
function enterToNextInColumn(event: KeyboardEvent<HTMLTableSectionElement>) {
  if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return;
  const column = event.target.classList.contains('brisage-price-input') ? 'input.brisage-price-input'
    : event.target.classList.contains('brisage-roll') ? 'input.brisage-roll' : undefined;
  if (!column) return;
  event.preventDefault();
  const fields = [...event.currentTarget.querySelectorAll<HTMLInputElement>(column)];
  const next = fields[fields.indexOf(event.target) + 1] ?? event.target;
  next.focus();
  next.select();
}

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
  // specs/072-classement-brisage (US6): the Classement tab exists only for the owner, who opens it with `?classement=1`.
  // The owner can also open it to everyone with the shared `brisageRanking` setting (administration page).
  const [localRankingAccess] = useState(() => {
    const { access, touched } = applyRankingAccessFromSearch(window.location.search);
    if (touched) window.history.replaceState(window.history.state, '', withoutRankingParameter(window.location));
    return access;
  });
  const { settings: siteSettings } = useSiteSettings();
  const rankingAccess = localRankingAccess || siteSettings.brisageRanking;
  const [tab, setTab] = useState<'sheet' | 'ranking'>('sheet');
  // The sort and filters of the ranking live here so they survive a trip to the item page (FR-010).
  const [rankingView, setRankingView] = useState<RankingView>(DEFAULT_RANKING_VIEW);
  const [item, setItem] = useState<PickedItem>();
  const [ranges, setRanges] = useState<Range[]>([]);
  // specs/067: the negative lines (maluses) of the item, read apart from the positive ones.
  const [negativeRanges, setNegativeRanges] = useState<Range[]>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [rolls, setRolls] = useState<Record<number, string>>({});
  // specs/066: the exos put on this item, the last added first (as in the game); kept per item.
  const [storedExos, setExos] = useState<ExoEntry[]>([]);
  const newExoCount = useRef(0);
  // A restored exo only counts while its stat is still absent from the item and still has a rune; a new one has no rune yet.
  const exoEntries = storedExos.filter((exo) => exo.effectId === undefined
    || (runeForStat(RUNES, exo.effectId, SETTINGS.runeSize) && ![...ranges, ...negativeRanges].some((range) => range.effectId === exo.effectId)));
  const exos = exoEntries.filter((exo): exo is ExoEntry & { effectId: number } => exo.effectId !== undefined);
  const [stored, setStored] = useState<StoredCoefficient>();
  // specs/069: the coefficient shown is the more recent of the one noted on this device and the one shared by the players.
  const sharedCoefficientOf = useSharedCoefficients(serverId, item ? [item.id] : []);
  const shownCoefficient = item ? sharedCoefficientOf(item.id, stored) : stored;
  const [coefficientText, setCoefficientText] = useState('');
  const [, setClearedCount] = useState(0);
  const [manualCost, setManualCost] = useState('');
  // A new item starts with no source chosen ('auto'): the button of the cheaper of the HDV price and the craft cost is lit.
  const [priceSource, setPriceSource] = useState<PriceSource>('auto');
  const pickToken = useRef(0);

  /** Opens an item; `restore` brings back what was typed on it before a reload. */
  const openItem = (picked: PickedItem, restore?: Pick<BrisageSession, 'rolls' | 'coefficientText' | 'manualCost' | 'priceSource'>) => {
    // Clicking the item already open must not wipe what was typed on it.
    if (!restore && picked.id === item?.id) return;
    const token = ++pickToken.current;
    setItem(picked);
    setRanges([]);
    setNegativeRanges([]);
    setExos(serverId ? getBrisageExos(serverId, picked.id).map((exo) => ({ ...exo, id: `exo-${exo.effectId}` })) : []);
    setRolls(restore?.rolls ?? {});
    setCoefficientText(restore?.coefficientText ?? '');
    setManualCost(restore?.manualCost ?? '');
    // Another item starts on the cheaper source again; a restored session brings its own back.
    setPriceSource(restore?.priceSource ?? 'auto');
    setStored(serverId ? getStoredCoefficient(serverId, picked.id) : undefined);
    setLoadState('loading');
    Promise.all([getItemEffectRanges(picked.id), getItemNegativeRanges(picked.id)])
      .then(([result, negatives]) => {
        if (pickToken.current !== token) return;
        setRanges(result);
        setNegativeRanges(negatives);
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
    if (serverId && item) setBrisageExos(serverId, item.id, next.flatMap((exo) => (exo.effectId === undefined ? [] : [{ effectId: exo.effectId, value: exo.value }])));
  };

  // specs/069 (FR-006): the notes made before they were shared are sent once, with their original date; the flag is
  // set only once the server has them, so a failed send is tried again at the next visit.
  useEffect(() => {
    if (hasImportedCoefficients()) return;
    const notes = listImportableCoefficients();
    if (notes.length === 0) { markCoefficientsImported(); return; }
    (async () => {
      for (let start = 0; start < notes.length; start += MAX_ENTRIES_PER_SEND) {
        if (!(await submitCoefficients(notes.slice(start, start + MAX_ENTRIES_PER_SEND)))) return;
      }
      markCoefficientsImported();
    })();
  }, []);

  // « Coefficient unknown »: a note made by mistake is forgotten here and, for the players, hidden at the Worker (the notes
  // made before this moment are no longer given; a later note replaces it as usual).
  const forgetCoefficient = () => {
    if (!serverId || !item) return;
    removeStoredCoefficient(serverId, item.id);
    dropSharedCoefficient(serverId, item.id);
    forgetCachedCoefficient(serverId, item.id);
    setStored(undefined);
    setCoefficientText('');
    // The coefficient shown may have been a shared one only: nothing else changed, so the page is drawn again here.
    setClearedCount((count) => count + 1);
    void clearSharedCoefficients([{ serverId, itemId: item.id }]);
  };

  const rememberCoefficient = () => {
    const value = parse(coefficientText);
    if (!serverId || !item || !(value > 0 && value <= MAX_COEFFICIENT)) return;
    const saved = saveCoefficient(serverId, item.id, value);
    setStored(saved);
    // specs/069: shared with the players; if the server doesn't answer, the note stays on this device.
    if (saved) void submitCoefficients([{ serverId, itemId: item.id, coefficient: value, savedAt: saved.savedAt }]);
    setCoefficientText('');
  };

  // specs/062 + specs/065: the price of the item is the HDV price noted on Recherche, the cost of its craft chain, or
  // the cheaper of the two (Auto). Both are read as soon as an item is picked so they can be shown side by side. A
  // typed price fills in when the chosen source has none; a zero or negative price is never accepted.
  const hdvCost = useItemCost(serverId, item?.id, priceMode);
  // specs/070-atelier-prix-craft-brisage: the craft prices window writes to the carnets; closing it reads them again.
  const [craftPricesOpen, setCraftPricesOpen] = useState(false);
  const [craftReloadKey, setCraftReloadKey] = useState(0);
  const craftPricesButton = useRef<HTMLButtonElement>(null);
  const craftCost = useItemCraftCost(serverId, item?.id, priceMode, craftReloadKey);
  const hdvPending = hdvCost.status === 'loading';
  const craftPending = craftCost.status === 'loading';
  const isKnown = (kamas: number | undefined) => kamas !== undefined && kamas > 0;
  // No button chosen yet: the cheaper of the two (the HDV on a tie, or when neither price is known).
  const cheaperSource = isKnown(craftCost.costKamas) && (!isKnown(hdvCost.costKamas) || craftCost.costKamas! < hdvCost.costKamas!) ? 'craft' : 'hdv';
  const source: Exclude<PriceSource, 'auto'> = priceSource === 'auto' ? cheaperSource : priceSource;
  const priceLoading = priceSource === 'auto' ? hdvPending || craftPending : source === 'hdv' ? hdvPending : source === 'craft' ? craftPending : false;
  const resolvedPrice = !priceLoading && source !== 'custom' ? resolveItemPrice(hdvCost.costKamas, craftCost.costKamas, source) : undefined;
  const typedPrice = parse(manualCost);
  const typedCoefficient = parse(coefficientText);
  const coefficient = typedCoefficient > 0 ? typedCoefficient : shownCoefficient?.coefficient ?? NaN;
  const cost = resolvedPrice?.kamas ?? (typedPrice > 0 ? typedPrice : NaN);
  const priceOrigin = resolvedPrice
    ? (resolvedPrice.origin === 'craft' ? `Coût de la chaîne de craft (${priceMode === 'community' ? 'mode communautaire' : 'mode personnel'})` : 'Prix noté sur la page Recherche')
    : typedPrice > 0 ? (source === 'custom' ? 'Prix personnalisé' : 'Saisi à la main') : undefined;
  const noPriceReason = source === 'custom' ? 'Saisis le prix à utiliser.' : source === 'craft'
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
  // specs/067: a malus is listed after the positive lines (its roll index follows theirs). Its roll is a negative number
  // inside its own range (it gives no rune), or a whole positive number up to the weight limit when forgemagie turned
  // the line positive: then it counts as an exo. Anything else is refused and the average is used.
  const negativeLines = negativeRanges
    .filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize))
    .map((range, position) => {
      const index = breakable.length + position;
      const average = averageRoll(range.from, range.to);
      const parsed = parse(rolls[index] ?? '');
      const limit = lineValueLimit(range.effectId, SETTINGS);
      const inRange = Number.isFinite(parsed) && parsed >= range.from && parsed <= range.to;
      const flipped = Number.isInteger(parsed) && parsed >= 1 && parsed <= limit;
      const usable = inRange || flipped;
      return {
        index, range, average, limit, fixed: range.from === range.to, value: usable ? parsed : average,
        modified: usable && parsed !== average, flipped, tooHigh: parsed > limit,
        invalid: Number.isFinite(parsed) && !usable,
      };
    });
  const flippedLines = negativeLines.filter((line) => line.flipped);
  // The Min / Moyen / Max switch of the Jet column: which one all the free lines are set to, if any.
  const freeLines = [...lines, ...negativeLines].filter((line) => !line.fixed);
  const rollMode: 'min' | 'average' | 'max' | undefined = freeLines.length === 0 ? undefined
    : freeLines.every((line) => (rolls[line.index] ?? '') === '') ? 'average'
      : freeLines.every((line) => parse(rolls[line.index] ?? '') === line.range.from) ? 'min'
        : freeLines.every((line) => parse(rolls[line.index] ?? '') === line.range.to) ? 'max'
          : undefined;
  const setAllRolls = (mode: 'min' | 'average' | 'max') => setRolls(
    mode === 'average' ? {} : Object.fromEntries(freeLines.map((line) => [line.index, String(mode === 'min' ? line.range.from : line.range.to)])),
  );
  const ignoredCount = ranges.length - ranges.filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize)).length
    + negativeRanges.length - negativeLines.length;
  const runeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const range of ranges) {
      const found = runeForStat(RUNES, range.effectId, SETTINGS.runeSize);
      if (found) ids.add(found.rune.id);
    }
    // specs/067: the price of a malus' rune is shown (and used once a roll turns the line positive).
    for (const range of negativeRanges) {
      const found = runeForStat(RUNES, range.effectId, SETTINGS.runeSize);
      if (found) ids.add(found.rune.id);
    }
    for (const exo of storedExos) {
      const found = exo.effectId === undefined ? undefined : runeForStat(RUNES, exo.effectId, SETTINGS.runeSize);
      if (found) ids.add(found.rune.id);
    }
    return [...ids].sort();
  }, [ranges, negativeRanges, storedExos]);
  const fetched = useRunePrices(serverId, priceMode, runeIds);
  // specs/067: a price typed in the table is used at once, before the carnet is read again; one entry per server and mode.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const overrideKey = (runeId: string) => `${serverId}:${priceMode}:${runeId}`;
  const prices: Record<string, number | undefined> = { ...fetched.prices };
  for (const runeId of runeIds) {
    const typedPrice = priceOverrides[overrideKey(runeId)];
    if (typedPrice !== undefined) prices[runeId] = typedPrice;
  }
  /** The price of a rune: typed in the table when a server is chosen, else only shown. */
  const runePriceCell = (runeId: string, runeName: string) => (serverId
    ? (
      <RunePriceInput
        key={runeId} runeId={runeId} runeName={runeName} serverId={serverId} priceMode={priceMode} price={prices[runeId]}
        onSaved={(id, amount) => setPriceOverrides((known) => ({ ...known, [overrideKey(id)]: amount }))}
      />
    )
    : typeof prices[runeId] === 'number' ? <Kamas value={prices[runeId]!} /> : <span className="fm-note">prix manquant</span>);

  const ready = item && (ranges.length > 0 || flippedLines.length > 0) && !priceLoading;
  const lineInputs = [
    ...exos.map((exo) => ({ effectId: exo.effectId, value: exo.value, exo: true })),
    ...lines.map((line) => ({ effectId: line.range.effectId, value: line.value })),
    // specs/067: a malus turned positive by forgemagie counts like an exo.
    ...flippedLines.map((line) => ({ effectId: line.range.effectId, value: line.value, exo: true })),
  ];
  const negativeInputs = negativeLines.filter((line) => !line.flipped).map((line) => ({ effectId: line.range.effectId, value: line.value }));
  // specs/066: the runes offered as exo are those of the stats the item does not have; each one is taken once.
  const exoRunes: ExoRuneChoice[] = BRISAGE_STATS.flatMap((stat) => {
    const found = [...ranges, ...negativeRanges].some((range) => range.effectId === stat.effectId) ? undefined : runeForStat(RUNES, stat.effectId, SETTINGS.runeSize);
    return found ? [{ effectId: stat.effectId, label: stat.label, runeName: found.rune.name, imageUrl: found.rune.imageUrl, max: lineValueLimit(stat.effectId, SETTINGS) }] : [];
  });
  const hasNewExo = exoEntries.some((exo) => exo.effectId === undefined);
  const analysis = ready && coefficient > 0
    ? analyzeBrisage({ level: item.level ?? NaN, lines: lineInputs, negatives: negativeInputs, coefficient, itemCostKamas: cost }, RUNES, prices, SETTINGS)
    : undefined;
  // specs/063: without a coefficient the table and a focus advice are still shown (normal breaking at 100 %).
  const advice = ready && !(coefficient > 0)
    ? analyzeFocusAdvice({ level: item.level ?? NaN, lines: lineInputs, negatives: negativeInputs, itemCostKamas: Number.isFinite(cost) ? cost : undefined }, RUNES, prices, SETTINGS)
    : undefined;
  const adviceOk = advice?.status === 'ok' ? advice : undefined;
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
  /** Value of the runes of an option, without the price of the item; unknown while a rune has no price. */
  const runesTotal = (option: BrisageOption | undefined): number | undefined => (
    option && option.missingRuneIds.length === 0 ? option.valueKamas : undefined
  );
  /** Green for a positive total, red for a negative one; nothing while the total is unknown or zero. */
  const totalTone = (amount: number | undefined) => (
    amount === undefined || Math.round(amount) === 0 ? undefined : amount > 0 ? 'brisage-total-gain' : 'brisage-total-loss'
  );
  const highlightedEffectId = noCoefficient ? (adviceOk?.focusBeatsNormal ? bestFocus?.focusEffectId : undefined) : best?.kind === 'focus' ? best.focusEffectId : undefined; // the best focus is shown even when the item is a loss
  const nextGains = ok && normal?.gainKamas !== undefined && coefficient > 0
    ? nextCoefficients(coefficient, 3).map((next) => ({ coefficient: next, gain: (normal.valueKamas * next) / coefficient - cost }))
    : [];

  let verdict = { title: 'Prix manquants', hint: undefined as string | undefined, tone: 'neutral' as 'good' | 'bad' | 'neutral' };
  if (best && best.gainKamas! < 0) verdict = { title: 'Pas rentable', hint: 'Même le meilleur choix ne couvre pas le prix de l\'objet.', tone: 'bad' };
  else if (best?.kind === 'normal') verdict = { title: 'Rentable sans focus', hint: 'Le focus ne rapporte pas plus : brisez normalement.', tone: 'good' };
  else if (best) verdict = { title: `Rentable avec un focus ${shortRune(best)}`, hint: undefined, tone: 'good' };

  const invalidReason = analysis?.status === 'invalid' ? analysis.reason : advice?.status === 'invalid' ? advice.reason : undefined;
  // specs/063: the advice shown while the coefficient is unknown.
  // DoFocus model: focus and normal breaking both scale with the coefficient, so the better one does not depend on it.
  const adviceKnown = adviceOk?.bestFocus !== undefined && adviceOk.focusBeatsNormal !== undefined;
  const adviceTitle = !adviceKnown ? 'Prix manquants' : adviceOk.focusBeatsNormal ? `Focus ${shortRune(adviceOk.bestFocus!)}` : 'Brisez sans focus';
  const adviceHint = !adviceKnown
    ? 'Notez les prix des runes pour obtenir un conseil.'
    : adviceOk.focusBeatsNormal ? 'Le focus rapporte plus que le brisage normal.' : 'Aucun focus ne rapporte plus que le brisage normal.';
  const breakEvenValue = adviceKnown ? (adviceOk.focusBeatsNormal ? adviceOk.focusBreakEven : adviceOk.normalBreakEven) : undefined;
  const adviceBreakEven = breakEvenValue !== undefined && breakEvenValue > 0 ? breakEvenValue : undefined;

  return (
    <>
      <h1 className="visually-hidden">Brisage</h1>

      {rankingAccess && (
        <div className="brisage-tabs" role="tablist" aria-label="Vue de la page Brisage">
          {([['sheet', 'Fiche'], ['ranking', 'Classement']] as const).map(([id, text]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : undefined} onClick={() => setTab(id)}>{text}</button>
          ))}
        </div>
      )}

      {rankingAccess && tab === 'ranking' ? (
        <RankingTab
          serverId={serverId}
          priceMode={priceMode}
          view={rankingView}
          onView={setRankingView}
          onOpen={(picked) => { openItem(picked); setTab('sheet'); }}
        />
      ) : (
      <>
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
            priceSource={source}
            onPriceSource={(next) => {
              // Perso starts from the price that was kept, so it only has to be adjusted.
              if (next === 'custom' && !manualCost.trim() && resolvedPrice) setManualCost(String(Math.round(resolvedPrice.kamas)));
              setPriceSource(next);
            }}
            loading={priceLoading}
            hdvKamas={hdvCost.costKamas}
            craftKamas={craftCost.costKamas}
            resolved={resolvedPrice}
            originText={priceOrigin}
            manualCost={manualCost}
            onManualCost={setManualCost}
            noPriceReason={noPriceReason}
            stored={shownCoefficient}
            coefficientText={coefficientText}
            onCoefficientText={setCoefficientText}
            onRememberCoefficient={rememberCoefficient}
            onForgetCoefficient={forgetCoefficient}
            canEditCraftPrices={craftCost.reason !== 'no-recipe'}
            onOpenCraftPrices={() => setCraftPricesOpen(true)}
            craftPricesButtonRef={craftPricesButton}
          />
          {craftPricesOpen && serverId && (
            <CraftPricesDialog
              itemId={item.id}
              itemName={item.name}
              serverId={serverId}
              priceMode={priceMode}
              onClose={() => {
                setCraftPricesOpen(false);
                setCraftReloadKey((key) => key + 1);
                craftPricesButton.current?.focus();
              }}
            />
          )}
          {loadState === 'loading' && <p className="fm-note" role="status">Lecture des stats…</p>}
          {loadState === 'failed' && <p className="fm-error" role="alert">Les stats de cet objet n'ont pas pu être lues.</p>}
          {loadState === 'idle' && ranges.length === 0 && negativeLines.length === 0 && <p className="fm-note">Cet objet n'a aucune ligne à briser.</p>}
          {loadState === 'idle' && ranges.length === 0 && negativeLines.length > 0 && flippedLines.length === 0 && (
            <p className="fm-note brisage-negative-only">
              L'objet n'a aucune ligne exploitable : il n'a que des lignes négatives ({negativeLines.map((line) => `${statLabel(line.range.effectId)} ${line.value}`).join(', ')}), qui ne donnent aucune rune.
            </p>
          )}
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
                    <div className={`verdict brisage-verdict verdict--${adviceKnown ? 'craft' : 'insufficient-data'}`}>
                      <div className="verdict-head">
                        <span className="verdict-icon" aria-hidden="true"><Icon name={adviceKnown ? 'check' : 'info'} size={22} /></span>
                        <div className="verdict-text">
                          <span className="brisage-verdict-label">Conseil</span>
                          <p className="verdict-title">{adviceTitle}</p>
                          <p className="verdict-subtitle">{adviceHint}</p>
                          <p className="verdict-subtitle">Coefficient inconnu : indiquez-le (relevé en jeu) pour un verdict précis.</p>
                        </div>
                      </div>
                      {adviceBreakEven !== undefined && (
                        <dl className="brisage-facts">
                          <div><dt>Rentable tant que le coefficient reste au-dessus de</dt><dd>{number.format(adviceBreakEven)} %</dd></div>
                        </dl>
                      )}
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
                    {(ok.thresholdCoefficient !== undefined || ok.focusThresholdCoefficient !== undefined) && (
                      <dl className="brisage-facts">
                        {ok.thresholdCoefficient !== undefined && (
                          <div><dt>Sans focus, rentable jusqu'à</dt><dd>{number.format(ok.thresholdCoefficient)} %</dd></div>
                        )}
                        {ok.focusThresholdCoefficient !== undefined && bestFocus && (
                          <div><dt>Focus {shortRune(bestFocus)}, rentable jusqu'à</dt><dd>{number.format(ok.focusThresholdCoefficient)} %</dd></div>
                        )}
                        {ok.thresholdCoefficient !== undefined && (
                          <div><dt>Brisages possibles avant ce seuil</dt><dd>{ok.itemsCount}</dd></div>
                        )}
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
                      type="button" className="btn btn-secondary brisage-exo-add" disabled={hasNewExo || exoRunes.length <= exos.length}
                      onClick={() => { newExoCount.current += 1; changeExos([{ id: `new-${newExoCount.current}`, value: 1 }, ...exoEntries]); }}
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
                        <th scope="colgroup" colSpan={2} className="brisage-group brisage-group--plain"><span className="brisage-group-title">Sans focus</span></th>
                        <th scope="colgroup" colSpan={2} className="brisage-group brisage-group--focus"><span className="brisage-group-title">Avec focus</span></th>
                      </tr>
                      <tr role="row">
                        <th scope="col">Runes</th><th scope="col">Valeur des runes</th><th scope="col">Runes</th><th scope="col">Valeur des runes</th>
                      </tr>
                    </thead>
                    <tbody onKeyDown={enterToNextInColumn}>
                      {exoEntries.map((entry) => {
                        const plain = entry.effectId === undefined ? undefined : normal?.yields.find((y) => y.effectId === entry.effectId);
                        const taken = (effectId: number) => exos.some((other) => other.effectId === effectId && other.effectId !== entry.effectId);
                        return (
                          <ExoRow
                            key={entry.id}
                            entry={entry}
                            choices={exoRunes.filter((choice) => !taken(choice.effectId))}
                            plain={plain}
                            priceCell={(() => {
                              const exoRune = entry.effectId === undefined ? undefined : runeForStat(RUNES, entry.effectId, SETTINGS.runeSize);
                              return exoRune ? runePriceCell(exoRune.rune.id, exoRune.rune.name) : undefined;
                            })()}
                            onPick={(effectId) => {
                              const max = exoRunes.find((choice) => choice.effectId === effectId)?.max ?? 1;
                              changeExos(exoEntries.map((other) => (other === entry ? { id: entry.id, effectId, value: Math.min(Math.max(entry.value, 1), max) } : other)));
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
                            <td role="cell" data-label="Prix de la rune">{runePriceCell(found.rune.id, found.rune.name)}</td>
                            <td role="cell" data-label="Sans focus : runes">{plain ? number.format(wholeRunes(plain.count)) : '—'}</td>
                            <td role="cell" data-label="Sans focus : valeur des runes">{plain?.valueKamas !== undefined ? <Kamas value={Math.round(plain.valueKamas)} /> : <span className="fm-note">—</span>}</td>
                            <td role="cell" data-label="Focus : runes">{focusYield ? number.format(wholeRunes(focusYield.count)) : '—'}</td>
                            <td role="cell" data-label="Focus : valeur des runes">{focusValue !== undefined ? <Kamas value={Math.round(focusValue)} /> : <span className="fm-note">—</span>}</td>
                          </tr>
                        );
                      })}
                      {negativeLines.map((line) => {
                        const found = runeForStat(RUNES, line.range.effectId, SETTINGS.runeSize)!;
                        const label = statLabel(line.range.effectId);
                        // A malus turned positive by forgemagie counts like an exo: it gives runes, with no focus on it.
                        const plain = line.flipped ? normal?.yields.find((y) => y.effectId === line.range.effectId) : undefined;
                        return (
                          <tr role="row" key={`negative-${line.index}`} className={line.flipped ? 'brisage-line--exo' : 'brisage-negative'}>
                            <th scope="row" role="rowheader" data-label="Rune">
                              <span className="brisage-line-name" title={label}>
                                <ResourceDisplay resource={{ id: found.rune.id, name: found.rune.name, imageUrl: found.rune.imageUrl }} />
                                <span className="brisage-stat-name">{label}</span>
                                {line.flipped
                                  ? <span className="brisage-badge brisage-badge--exo">Malus corrigé</span>
                                  : <span className="brisage-badge brisage-badge--negative">Malus</span>}
                              </span>
                            </th>
                            <td role="cell" data-label={line.modified ? 'Jet modifié' : 'Jet'}>
                              <span className="brisage-jet">
                                {!line.fixed && <span className="brisage-bound">{line.range.from}</span>}
                                <input
                                  type="number" inputMode="decimal"
                                  className={line.modified ? 'brisage-roll is-modified' : 'brisage-roll'}
                                  aria-label={`Jet de ${label} (malus)`}
                                  aria-invalid={line.invalid || undefined}
                                  placeholder={String(line.average)}
                                  value={rolls[line.index] ?? ''}
                                  onChange={(event) => setRolls({ ...rolls, [line.index]: event.target.value })}
                                />
                                {!line.fixed && <span className="brisage-bound">{line.range.to}</span>}
                              </span>
                              <span className="brisage-roll-state fm-note">{line.tooHigh ? `jet maximal ${line.limit} : moyen utilisé` : line.invalid ? 'jet invalide : moyen utilisé' : ''}</span>
                            </td>
                            <td role="cell" data-label="Prix de la rune">{runePriceCell(found.rune.id, found.rune.name)}</td>
                            <td role="cell" data-label="Sans focus : runes">{plain ? number.format(wholeRunes(plain.count)) : '—'}</td>
                            <td role="cell" data-label="Sans focus : valeur des runes">{plain?.valueKamas !== undefined ? <Kamas value={Math.round(plain.valueKamas)} /> : <span className="fm-note">—</span>}</td>
                            <td role="cell" data-label="Focus : runes" title="Pas de focus possible sur un malus">—</td>
                            <td role="cell" data-label="Focus : valeur des runes" title="Pas de focus possible sur un malus">—</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {costKnown && (
                        <tr role="row">
                          <th scope="row" role="rowheader" colSpan={3}>Total des runes</th>
                          <td />
                          <td role="cell" data-label="Sans focus : total des runes" className={totalTone(runesTotal(normal))}>{runesTotal(normal) !== undefined ? <Kamas value={Math.round(runesTotal(normal)!)} /> : '—'}</td>
                          <td />
                          <td role="cell" data-label="Meilleur focus : total des runes" className={totalTone(runesTotal(bestFocus))}>{runesTotal(bestFocus) !== undefined ? <Kamas value={Math.round(runesTotal(bestFocus)!)} /> : '—'}</td>
                        </tr>
                      )}
                      <tr role="row">
                        <th scope="row" role="rowheader" colSpan={3}>{noCoefficient && !costKnown ? 'Total des runes' : "Total de l'objet, prix déduit"}</th>
                        <td />
                        <td role="cell" data-label="Sans focus : total" className={totalTone(gainOf(normal))}>{gainOf(normal) !== undefined ? <Kamas value={Math.round(gainOf(normal)!)} signed={!noCoefficient || costKnown} /> : '—'}</td>
                        <td />
                        <td role="cell" data-label="Meilleur focus : total" className={totalTone(gainOf(bestFocus))}>{gainOf(bestFocus) !== undefined ? <Kamas value={Math.round(gainOf(bestFocus)!)} signed={!noCoefficient || costKnown} /> : '—'}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {ignoredCount > 0 && (
                  <p className="fm-note">{ignoredCount} ligne(s) sans poids ni rune connus ne sont pas comptées.</p>
                )}
              </section>

            </>
          )}
          {nextGains.length > 0 && (
            <section className="brisage-part brisage-footline" aria-label="Informations annexes">
              <section className="brisage-gains-layout" aria-labelledby="brisage-gains-title">
                <h2 id="brisage-gains-title" className="visually-hidden">Gain selon le coefficient</h2>
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
            </section>
          )}
        </div>
      )}
        </section>
      )}
      </>
      )}
    </>
  );
}
