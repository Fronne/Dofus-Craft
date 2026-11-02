import type { ReactNode } from 'react';
import { runeForStat, wholeRunes } from '../../domain/brisage';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { Kamas } from '../prices/PricesPage';
import type { BrisageAnalysis } from './brisageAnalysis';
import type { BrisageLine } from './brisageLines';
import { number, RUNES, SETTINGS, statLabel } from './brisageHelpers';

/** The positive lines of the item: rune, roll to type, price of the rune, runes and value without and with focus. */
export function BrisageLineRows({ lines, rolls, setRolls, normal, focusOptions, highlightedEffectId, runePriceCell }: {
  lines: BrisageLine[];
  rolls: Record<number, string>;
  setRolls: (rolls: Record<number, string>) => void;
  normal: BrisageAnalysis['normal'];
  focusOptions: BrisageAnalysis['focusOptions'];
  highlightedEffectId: number | undefined;
  runePriceCell: (runeId: string, runeName: string) => ReactNode;
}) {
  return (
    <>
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
            <td role="cell" className="brisage-actions" />
          </tr>
        );
      })}
    </>
  );
}
