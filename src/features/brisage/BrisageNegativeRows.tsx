import type { ReactNode } from 'react';
import { runeForStat, wholeRunes } from '../../domain/brisage';
import { ResourceDisplay } from '../catalogue/ResourceDisplay';
import { Kamas } from '../prices/PricesPage';
import type { BrisageAnalysis } from './brisageAnalysis';
import type { BrisageNegativeLine } from './brisageLines';
import { number, RUNES, SETTINGS, statLabel } from './brisageHelpers';

/** The negative lines (maluses) of the item, listed after the positive ones; no focus is possible on them. */
export function BrisageNegativeRows({ negativeLines, rolls, setRolls, normal, runePriceCell }: {
  negativeLines: BrisageNegativeLine[];
  rolls: Record<number, string>;
  setRolls: (rolls: Record<number, string>) => void;
  normal: BrisageAnalysis['normal'];
  runePriceCell: (runeId: string, runeName: string) => ReactNode;
}) {
  return (
    <>
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
            <td role="cell" className="brisage-actions" />
          </tr>
        );
      })}
    </>
  );
}
