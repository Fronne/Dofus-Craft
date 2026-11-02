import { useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { DEFAULT_RANKING_VIEW, type RankingView } from '../../domain/brisage-ranking';
import type { PriceMode } from '../../domain/price-modes';
import { Kamas } from '../prices/PricesPage';
import { BrisageAdvice } from './BrisageAdvice';
import { BrisageExoRows } from './BrisageExoRows';
import { BrisageLineRows } from './BrisageLineRows';
import { BrisageLinesSection } from './BrisageLinesSection';
import { BrisageNegativeRows } from './BrisageNegativeRows';
import { BrisageNextGains } from './BrisageNextGains';
import { BrisageTotals } from './BrisageTotals';
import { BrisageVerdictPanel } from './BrisageVerdictPanel';
import { CraftPricesDialog } from './CraftPricesDialog';
import { ItemFinder } from './ItemFinder';
import { ItemHeader } from './ItemHeader';
import { RankingTab } from './RankingTab';
import { RunePriceInput } from './RunePriceInput';
import { analyseBrisageItem } from './brisageAnalysis';
import { RUNES, SETTINGS, statLabel } from './brisageHelpers';
import { buildBrisageLines } from './brisageLines';
import { useBrisageCoefficient } from './useBrisageCoefficient';
import { useBrisageCost } from './useBrisageCost';
import { useBrisageExos } from './useBrisageExos';
import { useBrisageItem } from './useBrisageItem';
import { useBrisageRunePrices } from './useBrisageRunePrices';
import { useRankingAccess } from './useRankingAccess';

// specs/065-refonte-page-brisage: the page opens on the item search (ItemFinder: name, filters, cards), then the item
// header (ItemHeader), the table, and a compact line of side figures at the bottom.
// specs/061-simplification-page-brisage: pick an item, read the verdict. The cost comes from the price
// already noted on Recherche, the coefficient is remembered per item, each line starts at its average
// roll. Everything shown is an ESTIMATE from unofficial formulas (specs/060-page-brisage H1–H4).

export function BrisagePage({ priceMode }: { priceMode: PriceMode }) {
  const { serverId } = useActiveServer();
  const rankingAccess = useRankingAccess();
  const [tab, setTab] = useState<'sheet' | 'ranking'>('sheet');
  // The sort and filters of the ranking live here so they survive a trip to the item page (FR-010).
  const [rankingView, setRankingView] = useState<RankingView>(DEFAULT_RANKING_VIEW);
  const {
    item, ranges, negativeRanges, loadState, rolls, setRolls, storedExos, setExos, setStored, shownCoefficient,
    coefficientText, setCoefficientText, manualCost, setManualCost, priceSource, setPriceSource, openItem,
  } = useBrisageItem(serverId);
  const { exoEntries, exos, changeExos, addExo, removedExo, removeExo, undoRemoveExo } = useBrisageExos(serverId, item, ranges, negativeRanges, storedExos, setExos);
  const { forgetCoefficient, rememberCoefficient } = useBrisageCoefficient(serverId, item, coefficientText, setCoefficientText, setStored);
  const {
    hdvCost, craftCost, craftPricesOpen, setCraftPricesOpen, setCraftReloadKey, craftPricesButton,
    source, priceLoading, resolvedPrice, coefficient, cost, priceOrigin, noPriceReason,
  } = useBrisageCost(serverId, item, priceMode, priceSource, manualCost, coefficientText, shownCoefficient);
  const { prices, fetched, dateOverrides, overrideKey, saveOverride } = useBrisageRunePrices(serverId, priceMode, ranges, negativeRanges, storedExos);

  /** The price of a rune: typed in the table when a server is chosen, else only shown. */
  const runePriceCell = (runeId: string, runeName: string) => (serverId
    ? (
      <RunePriceInput
        key={runeId} runeId={runeId} runeName={runeName} serverId={serverId} priceMode={priceMode} price={prices[runeId]}
        updatedAt={dateOverrides[overrideKey(runeId)] ?? fetched.dates[runeId]}
        updatedBy={dateOverrides[overrideKey(runeId)] ? undefined : fetched.authors[runeId]}
        onSaved={saveOverride}
      />
    )
    : typeof prices[runeId] === 'number' ? <Kamas value={prices[runeId]!} /> : <span className="fm-note">—</span>);

  const lineSet = buildBrisageLines(ranges, negativeRanges, rolls);
  const { lines, negativeLines, flippedLines, freeLines, rollMode, ignoredCount } = lineSet;
  const setAllRolls = (mode: 'min' | 'average' | 'max') => setRolls(
    mode === 'average' ? {} : Object.fromEntries(freeLines.map((line) => [line.index, String(mode === 'min' ? line.range.from : line.range.to)])),
  );
  const {
    offeredExo, exoRunes, analysis, advice, adviceOk, ok, best, normal, focusOptions, bestFocus, focusWins,
    noCoefficient, costKnown, highlightedEffectId, nextGains, verdict, invalidReason,
    adviceKnown, adviceTitle, adviceHint, adviceBreakEven,
  } = analyseBrisageItem({ item, ranges, negativeRanges, exos, lines: lineSet, prices, priceLoading, cost, coefficient });
  const addBestExo = () => {
    if (!offeredExo) return;
    addExo(offeredExo.effectId);
  };
  const hasNewExo = exoEntries.some((exo) => exo.effectId === undefined);

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
                <BrisageAdvice
                  adviceKnown={adviceKnown} adviceTitle={adviceTitle} adviceHint={adviceHint} adviceBreakEven={adviceBreakEven}
                  offeredExo={offeredExo} onAddExo={addBestExo}
                />
              )}

              {ok && (
                <BrisageVerdictPanel
                  verdict={verdict} ok={ok} best={best} normal={normal} bestFocus={bestFocus} focusWins={focusWins}
                  offeredExo={offeredExo} onAddExo={addBestExo}
                />
              )}

              {removedExo && (
                <div className="brisage-undo-toast" role="status">
                  <span>Exo retiré</span>
                  <button type="button" onClick={undoRemoveExo}>Annuler</button>
                </div>
              )}

              <BrisageLinesSection
                showAddExo={ranges.length > 0}
                addExoDisabled={hasNewExo || exoRunes.length <= exos.length}
                onAddExo={() => addExo()}
                rollMode={rollMode}
                onSetAllRolls={setAllRolls}
                ignoredCount={ignoredCount}
                foot={<BrisageTotals normal={normal} bestFocus={bestFocus} noCoefficient={noCoefficient} costKnown={costKnown} cost={cost} />}
              >
                <BrisageExoRows
                  exoEntries={exoEntries} exos={exos} exoRunes={exoRunes} normal={normal}
                  changeExos={changeExos} removeExo={removeExo} runePriceCell={runePriceCell}
                />
                <BrisageLineRows
                  lines={lines} rolls={rolls} setRolls={setRolls} normal={normal} focusOptions={focusOptions}
                  highlightedEffectId={highlightedEffectId} runePriceCell={runePriceCell}
                />
                <BrisageNegativeRows negativeLines={negativeLines} rolls={rolls} setRolls={setRolls} normal={normal} runePriceCell={runePriceCell} />
              </BrisageLinesSection>

            </>
          )}
          {nextGains.length > 0 && <BrisageNextGains nextGains={nextGains} />}
        </div>
      )}
        </section>
      )}
      </>
      )}
    </>
  );
}
