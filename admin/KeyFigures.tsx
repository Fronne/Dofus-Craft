import type { KeyFigure } from './dashboard-summary';

// specs/071-admin-dashboard-moderne (contracts/admin-dashboard-ui.md « Chiffres clés »): the row of figures at the top of
// the dashboard. The value is big, the title small and the state written out; a figure with a section is a link to it.
// The glow and the colour of a tone are decoration: the detail line always says the state in words (FR-012).
export function KeyFigures({ figures }: { figures: KeyFigure[] }) {
  return (
    <ul className="dashboard-figures" aria-label="Chiffres clés">
      {figures.map((figure) => {
        const content = (
          <>
            <span className="dashboard-figure-title">{figure.title}</span>
            <span className="dashboard-figure-value">{figure.value}</span>
            <span className="dashboard-figure-detail">{figure.detail}</span>
          </>
        );
        const className = `dashboard-figure dashboard-figure--${figure.tone}${figure.state === 'ok' ? '' : ' dashboard-figure--pending'}`;
        return (
          <li key={figure.id}>
            {figure.href ? <a href={`#${figure.href}`} className={className}>{content}</a> : <div className={className}>{content}</div>}
          </li>
        );
      })}
    </ul>
  );
}
