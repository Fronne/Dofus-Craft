// specs/051-site-visual-refresh (FR-027): the site has a single style, so the design and the accent
// color a device had remembered no longer mean anything. They are cleared rather than left behind.
const RETIRED_KEYS = ['craftcheck-design-choice', 'craftcheck-accent-color'];

export function clearRetiredStylePreferences(): void {
  try {
    for (const key of RETIRED_KEYS) window.localStorage.removeItem(key);
  } catch {
    // localStorage unavailable — nothing was remembered, so nothing to clear.
  }
}
