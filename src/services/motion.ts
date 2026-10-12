// True when the player asked their system for less motion: a scroll then jumps instead of gliding.
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
