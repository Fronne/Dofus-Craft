import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../services/motion';

const DURATION_MS = 450;

// The amount to display while `target` is being reached: it counts from `from` (or from the amount
// shown so far, when the target changes) instead of jumping. Without animation frames, or when the
// player asked for less motion, it is the target straight away.
export function useCountUp(target: number, from = 0): number {
  const animated = typeof requestAnimationFrame === 'function' && typeof window.matchMedia === 'function' && !prefersReducedMotion();
  const [shown, setShown] = useState(animated ? from : target);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (!animated) return;
    const start = shownRef.current;
    if (start === target) return;
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function step(now: number) {
      const progress = Math.min((now - startedAt) / DURATION_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      shownRef.current = progress === 1 ? target : Math.round(start + (target - start) * eased);
      setShown(shownRef.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, animated]);

  return animated ? shown : target;
}
