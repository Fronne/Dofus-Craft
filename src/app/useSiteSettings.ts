import { useEffect, useState } from 'react';
import type { SiteSettings } from '../domain/site-settings';
import { getSiteSettings } from '../services/site-settings-api';
import { cacheSiteSettings, readCachedSiteSettings } from '../persistence/site-settings-cache';

// specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle: which pages the owner has enabled.
// Starts from the last settings read on this device (the defaults when none), then follows what the
// service answers; a failed read changes nothing (FR-009). `reading` is true until that first
// answer, so a page's address can wait for it rather than say « indisponible » about a page that is
// enabled.
export function useSiteSettings(): { settings: SiteSettings; reading: boolean } {
  const [settings, setSettings] = useState(readCachedSiteSettings);
  const [reading, setReading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void getSiteSettings().then((read) => {
      if (cancelled) return;
      if (read) {
        cacheSiteSettings(read);
        setSettings(read);
      }
      setReading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { settings, reading };
}
