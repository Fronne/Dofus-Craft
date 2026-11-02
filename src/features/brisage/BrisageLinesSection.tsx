import type { ReactNode } from 'react';
import { enterToNextInColumn } from './brisageHelpers';

/**
 * The « Lignes de l'objet » block: its title with the « + Exo » button, the table head with the Min / Moyen / Max switch
 * of the Jet column, then the rows (`children`) and the totals (`foot`).
 */
export function BrisageLinesSection({ showAddExo, addExoDisabled, onAddExo, rollMode, onSetAllRolls, ignoredCount, foot, children }: {
  showAddExo: boolean;
  addExoDisabled: boolean;
  onAddExo: () => void;
  rollMode: 'min' | 'average' | 'max' | undefined;
  onSetAllRolls: (mode: 'min' | 'average' | 'max') => void;
  ignoredCount: number;
  foot: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="brisage-part brisage-block" aria-labelledby="brisage-lines-title">
      <div className="brisage-block-head">
        <h2 id="brisage-lines-title">Lignes de l'objet</h2>
        {showAddExo && (
          <button
            type="button" className="btn btn-secondary brisage-exo-add" disabled={addExoDisabled}
            onClick={onAddExo}
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
                    <button key={mode} type="button" aria-pressed={rollMode === mode} className={rollMode === mode ? 'is-on' : undefined} onClick={() => onSetAllRolls(mode)}>{text}</button>
                  ))}
                </span>
              </th>
              <th scope="col" rowSpan={2}>Prix unitaire</th>
              <th scope="colgroup" colSpan={2} className="brisage-group brisage-group--plain"><span className="brisage-group-title">Sans focus</span></th>
              <th scope="colgroup" colSpan={2} className="brisage-group brisage-group--focus"><span className="brisage-group-title">Avec focus</span></th>
              <th scope="col" rowSpan={2} className="brisage-actions"><span className="visually-hidden">Actions</span></th>
            </tr>
            <tr role="row">
              <th scope="col">Runes</th><th scope="col">Valeur des runes</th><th scope="col">Runes</th><th scope="col">Valeur des runes</th>
            </tr>
          </thead>
          <tbody onKeyDown={enterToNextInColumn}>
            {children}
          </tbody>
          <tfoot>
            {foot}
          </tfoot>
        </table>
      </div>
      {ignoredCount > 0 && (
        <p className="fm-note">{ignoredCount} ligne(s) sans poids ni rune connus ne sont pas comptées.</p>
      )}
    </section>
  );
}
