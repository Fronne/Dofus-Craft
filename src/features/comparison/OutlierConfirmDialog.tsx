import { useCallback, useRef, useState, type ReactNode } from 'react';
import { formatKamas, formatPercent } from '../../domain/kamas';

export type OutlierConfirmDetails = {
  medianAmountKamas: number;
  enteredAmountKamas: number;
  deviationPercent: number;
  // specs/016: what the reference is called — « Dernier prix » for an item's HDV price, whose
  // confirmation also shows the deviation (FR-006). Omitted for resources: dialog unchanged.
  referenceLabel?: string;
};

// specs/007-outlier-confirmation, FR-004/FR-005/FR-007: blocks a commit until the player explicitly
// confirms or cancels, showing the three values that motivate the confirmation. Uses the native
// <dialog> element (showModal/close) rather than a custom overlay — no modal component exists
// elsewhere in this codebase, and <dialog> already provides interaction blocking, Escape-to-cancel,
// and focus handling for free (research.md).
export function useOutlierConfirm(): readonly [ReactNode, (details: OutlierConfirmDetails) => Promise<boolean>] {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | undefined>(undefined);
  const [details, setDetails] = useState<OutlierConfirmDetails | undefined>(undefined);

  const confirmOutlier = useCallback((next: OutlierConfirmDetails) => {
    setDetails(next);
    // showModal() is called on the next paint via the ref, once the <dialog> exists in the DOM —
    // requestAnimationFrame keeps this a single fire-and-forget call without introducing a second
    // effect just to react to `details` changing.
    requestAnimationFrame(() => dialogRef.current?.showModal());
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function respond(confirmed: boolean) {
    dialogRef.current?.close();
    resolveRef.current?.(confirmed);
  }

  const dialog = details && (
    <dialog
      ref={dialogRef}
      className="outlier-confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        respond(false);
      }}
    >
      <p>{details.referenceLabel ?? 'Prix habituel'} : <b>{formatKamas(details.medianAmountKamas)}</b></p>
      <p>Votre prix : <b>{formatKamas(details.enteredAmountKamas)}</b></p>
      {details.referenceLabel && Number.isFinite(details.deviationPercent) && (
        <p>Écart : <b>{formatPercent(details.deviationPercent)}</b></p>
      )}
      <p className="outlier-confirm-dialog-question">
        Ce prix semble inhabituel. L'enregistrer quand même ?
      </p>
      <div className="outlier-confirm-dialog-actions">
        <button type="button" onClick={() => respond(false)}>Annuler</button>
        <button type="button" className="outlier-confirm-dialog-confirm" onClick={() => respond(true)}>
          Enregistrer quand même
        </button>
      </div>
    </dialog>
  );

  return [dialog ?? null, confirmOutlier] as const;
}
