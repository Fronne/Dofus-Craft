import { useEffect, useState } from 'react';
import type { PriceMode } from '../domain/price-modes';
import { getPriceMode, setPriceMode } from '../persistence/price-mode-preference';
import { recordVisit } from '../services/visit-api';
import { prefersReducedMotion } from '../services/motion';
import { useDofusTheme } from './useDofusTheme';

// The choices kept on this device (light or dark theme, primordial Dofus, price mode) and the visit recorded when the site opens.
export function useShellPreferences() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = window.localStorage.getItem('craftcheck-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  });
  const [dofus, setDofus] = useDofusTheme();
  const [priceMode, setPriceModeState] = useState<PriceMode>(() => getPriceMode());

  useEffect(() => {
    const root = document.documentElement;
    // A theme chosen by the player (not the one the page opens with) fades in: every color glides
    // for a moment (styles/parts).
    const switching = root.dataset.theme !== undefined && root.dataset.theme !== theme;
    root.dataset.theme = theme;
    window.localStorage.setItem('craftcheck-theme', theme);
    if (!switching || prefersReducedMotion()) return;
    root.dataset.themeSwitching = '';
    const done = window.setTimeout(() => delete root.dataset.themeSwitching, 400);
    return () => window.clearTimeout(done);
  }, [theme]);
  useEffect(() => {
    setPriceMode(priceMode);
  }, [priceMode]);
  useEffect(() => {
    void recordVisit();
  }, []);

  return { theme, setTheme, dofus, setDofus, priceMode, setPriceModeState };
}
