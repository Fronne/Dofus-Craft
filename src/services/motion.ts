// True when the player asked their system for less motion: a scroll then jumps instead of gliding.
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Plays a one-off animation on an element: `data-<flag>` is set on it for the time of the animation
// that global.css ties to that attribute. Set on the element itself, as nothing else depends on it.
export function playOnce(element: HTMLElement, flag: string) {
  delete element.dataset[flag];
  // Reading the layout between the two lets the animation start over when played twice in a row.
  void element.offsetWidth;
  element.dataset[flag] = '';
  // Cleared by a timer rather than on `animationend`: the animation may be a descendant's, and
  // others bubble up from there too.
  window.setTimeout(() => delete element.dataset[flag], 1000);
}

// Lets an element fade out (`data-leaving`, global.css) before `remove` takes it away. Without
// animations — less motion asked for, or no way to know — it is removed at once.
export function leaveThen(element: HTMLElement | null, remove: () => void) {
  if (!element || typeof window.matchMedia !== 'function' || prefersReducedMotion()) {
    remove();
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    remove();
  };
  element.dataset.leaving = '';
  // The element's own animation only: its descendants' bubble up to it too.
  element.addEventListener('animationend', (event) => {
    if (event.target === element) finish();
  });
  // A hidden tab never ends the animation.
  window.setTimeout(finish, 260);
}
