import type { KeyboardEvent } from 'react';

// Keyboard moves inside a tab list: Left / Right go to the neighbouring tab (wrapping around), Home
// and End to the first and last. Returns the tab to open, and moves the focus onto it; undefined for
// any other key.
export function tabOnKey<T extends string>(event: KeyboardEvent<HTMLElement>, ids: readonly T[], current: T): T | undefined {
  const index = ids.indexOf(current);
  const target =
    event.key === 'ArrowRight' ? (index + 1) % ids.length
      : event.key === 'ArrowLeft' ? (index - 1 + ids.length) % ids.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? ids.length - 1
            : undefined;
  if (target === undefined || target === index) return undefined;
  event.preventDefault();
  const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
  tabs?.[target]?.focus();
  return ids[target];
}
