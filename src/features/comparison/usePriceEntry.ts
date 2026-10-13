import { useEffect, useRef, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { isValidKamas, normalizeKamasInput } from '../../domain/kamas';

// specs/052-direct-price-entry: how a price field is typed in, the same for a resource's unit price
// and an item's HDV price. Focusing the field selects its content, ready to be replaced; leaving it
// (Enter, click elsewhere, Tab) hands the value over; Escape puts back the price it held; and a
// page that unloads mid-typing hands the value over too, once.
export function usePriceEntry({
  value,
  onChange,
  onBlur,
  onCommit,
  onUnloadCommit,
  onTypingChange,
}: {
  value: string;
  onChange: (value: string) => void;
  // Called on every blur with the field's current value — the caller decides whether it changed
  // against its own persisted copy (Mode personnel writes its carnet there).
  onBlur?: (value: string) => void;
  // Called on blur only when the player typed and the value differs from the one the typing
  // started from — never for a plain focus/blur. Resolving to 'rejected' (a canceled confirmation)
  // puts that starting value back.
  onCommit?: (value: string) => Promise<'accepted' | 'rejected' | void>;
  // FR-008/FR-009: called instead of `onCommit` when the page unloads with a typed, valid, changed
  // value — no confirmation can be shown then, so the caller skips a price that would need one.
  onUnloadCommit?: (value: string) => void;
  // True at the player's first keystroke, false when the field is left (Escape included) — never
  // for a value this hook puts back itself.
  onTypingChange?: (typing: boolean) => void;
}) {
  // The value the current typing started from, taken at the first keystroke rather than at focus:
  // a price arriving from the group while the field merely has focus is not the player's edit.
  const startValueRef = useRef(value);
  const typedRef = useRef(false);
  const focusValueRef = useRef(value);
  const cancelledRef = useRef(false);
  // A click focuses the field, then releases the mouse: that release would drop the selection.
  const keepSelectionRef = useRef(false);

  const latest = useRef({ value, onBlur, onCommit, onUnloadCommit });
  useEffect(() => {
    latest.current = { value, onBlur, onCommit, onUnloadCommit };
  });
  useEffect(() => {
    const flush = () => {
      const current = latest.current;
      // An emptied field is not a price to hand over while leaving.
      if (!typedRef.current || current.value === '' || current.value === startValueRef.current || !isValidKamas(current.value)) return;
      // Handed over now: a blur that would still follow has nothing left to save.
      typedRef.current = false;
      startValueRef.current = current.value;
      current.onBlur?.(current.value);
      if (current.onCommit) current.onUnloadCommit?.(current.value);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  return {
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      focusValueRef.current = value;
      event.currentTarget.select();
      keepSelectionRef.current = true;
    },
    onMouseUp: (event: MouseEvent<HTMLInputElement>) => {
      if (!keepSelectionRef.current) return;
      keepSelectionRef.current = false;
      event.preventDefault();
    },
    // Enter validates like leaving the field does; Escape puts back the price it held on entry.
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      } else if (event.key === 'Escape' && value !== focusValueRef.current) {
        cancelledRef.current = true;
        onChange(focusValueRef.current);
        event.currentTarget.blur();
      }
    },
    onChange: (rawValue: string) => {
      // `value` is still the prop from before this keystroke: the parent has not re-rendered yet.
      if (!typedRef.current) {
        startValueRef.current = value;
        onTypingChange?.(true);
      }
      typedRef.current = true;
      keepSelectionRef.current = false;
      onChange(normalizeKamasInput(rawValue));
    },
    onBlur: () => {
      keepSelectionRef.current = false;
      const typed = typedRef.current;
      typedRef.current = false;
      onTypingChange?.(false);
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      onBlur?.(value);
      if (!typed || value === startValueRef.current) return;
      const previousValue = startValueRef.current;
      const result = onCommit?.(value);
      if (result) {
        void result.then((outcome) => {
          if (outcome === 'rejected') onChange(previousValue);
        });
      }
    },
  };
}
