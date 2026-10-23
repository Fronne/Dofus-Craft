import { useEffect, useState } from 'react';
import { DOFUS_STORAGE_KEY, dofusById, readStoredDofus, type DofusId } from '../domain/dofus-themes';

// specs/074-dofus-color-themes: the primordial Dofus that colors the site. data-dofus on <html>
// picks the palette in theme.css (none for the emerald, the site's own colors); the tab icon and
// the address-bar color follow. index.html does the same early, before the first paint.
export function useDofusTheme(): [DofusId, (value: DofusId) => void] {
  const [dofus, setDofus] = useState<DofusId>(() => readStoredDofus(window.localStorage));

  useEffect(() => {
    const root = document.documentElement;
    if (dofus === 'emeraude') delete root.dataset.dofus;
    else root.dataset.dofus = dofus;
    const { image, themeColor } = dofusById(dofus);
    document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', image);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    try {
      window.localStorage.setItem(DOFUS_STORAGE_KEY, dofus);
    } catch {
      // Storage blocked: the choice only lasts for this visit.
    }
  }, [dofus]);

  return [dofus, setDofus];
}
