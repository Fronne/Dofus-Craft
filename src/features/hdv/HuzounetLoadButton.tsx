import {
  durationLabel,
  estimatedSeconds,
  loadMessage,
  UNAVAILABLE_REASONS,
  type LoadAvailability,
  type LoadState,
} from '../../domain/huzounet-load';

// specs/046-hdv-huzounet-load (contracts/hdv-huzounet-ui.md): the button of an HDV tab that loads its
// prices from Huzounet — how many items it covers and roughly how long it takes before the click,
// the progress and « Arrêter » while it runs, and what happened once it is over.
export function HuzounetLoadButton({
  availability,
  count,
  state,
  onStart,
  onStop,
}: {
  availability: LoadAvailability;
  /** The number of items of the tab, never the number the filters keep. */
  count: number;
  state: LoadState;
  onStart: () => void;
  onStop: () => void;
}) {
  if (state.status === 'running') {
    return (
      <div className="hdv-huzounet">
        <button type="button" className="hdv-huzounet-button" onClick={onStop}>Arrêter</button>
        <span className="hdv-huzounet-status" role="status">
          Chargement : {state.done} sur {state.total} {state.total > 1 ? 'objets' : 'objet'}
        </span>
        <progress className="hdv-huzounet-progress" value={state.done} max={state.total} aria-label="Avancement du chargement" />
      </div>
    );
  }
  const duration = durationLabel(estimatedSeconds(count));
  const message = availability === 'ready' ? loadMessage(state) : UNAVAILABLE_REASONS[availability];
  return (
    <div className="hdv-huzounet">
      <button type="button" className="hdv-huzounet-button" disabled={availability !== 'ready'} onClick={onStart}>
        Charger depuis Huzounet ({count} {count > 1 ? 'objets' : 'objet'})
      </button>
      {availability === 'ready' && duration && state.status === 'idle' && <span className="hdv-huzounet-hint">{duration}</span>}
      {message && <span className="hdv-huzounet-status" role="status">{message}</span>}
    </div>
  );
}
