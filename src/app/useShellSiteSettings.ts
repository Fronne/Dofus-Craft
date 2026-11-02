import { useMemo, useState } from 'react';
import { useSiteSettings } from './useSiteSettings';
import { applyBonsPlansAccessFromSearch, withoutBonsPlansParameter } from '../persistence/bons-plans-access';

// specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle: the owner turns the Forgemagie and
// HDV pages on or off; off, a page's link is gone and its address says so (FR-003, FR-004).
export function useShellSiteSettings() {
  const { settings: sharedSettings, reading: readingSiteSettings } = useSiteSettings();
  // specs/081-bons-plans-aide-acces (US2): a browser the owner opened with `?bonsplans=1` keeps that page, whatever the
  // shared setting says. Read here because the navigation shows its link on every page.
  const [bonsPlansAccess] = useState(() => {
    const { access, touched } = applyBonsPlansAccessFromSearch(window.location.search);
    if (touched) window.history.replaceState(window.history.state, '', withoutBonsPlansParameter(window.location));
    return access;
  });
  const siteSettings = useMemo(() => (bonsPlansAccess ? { ...sharedSettings, bonsPlansPage: true } : sharedSettings), [bonsPlansAccess, sharedSettings]);
  return { siteSettings, readingSiteSettings };
}
