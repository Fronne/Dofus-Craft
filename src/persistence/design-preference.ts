import { isKnownDesignId } from '../domain/designs';
import type { DesignId } from '../domain/designs';

// Renamed on 2026-09-24 when « Nouveau » became the default: the old key also held « Classique »
// values saved without the player ever choosing, so every device starts over on the new default.
const STORAGE_KEY = 'craftcheck-design-choice';
// FR-004 (révision 2026-09-24): a new device, cleared or unavailable storage all get the modern design.
const DEFAULT_DESIGN_ID: DesignId = 'modern';

export function getDesignId(): DesignId {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_DESIGN_ID;
  }
  if (!stored || !isKnownDesignId(stored)) return DEFAULT_DESIGN_ID;
  return stored;
}

export function setDesignId(designId: DesignId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, designId);
  } catch {
    // localStorage unavailable — the choice just won't survive a reload.
  }
}

// Every rule of src/styles/design-modern.css is scoped under this attribute, so leaving it off
// is exactly the classic design (FR-005).
export function applyDesign(designId: DesignId): void {
  if (designId === 'modern') document.documentElement.dataset.design = 'modern';
  else delete document.documentElement.dataset.design;
}
