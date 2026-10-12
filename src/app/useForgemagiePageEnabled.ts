import { useEffect, useState } from 'react';
import { getSiteSettings } from '../services/site-settings-api';
import { cacheSiteSettings, readCachedSiteSettings } from '../persistence/site-settings-cache';

// specs/050-forgemagie-page-toggle: whether the owner has the Forgemagie page enabled. Starts from the
// last state read on this device (disabled when none), then follows what the service answers; a
// failed read changes nothing (FR-009). `reading` is true until that first answer, so the page's
// address can wait for it rather than say « indisponible » about a page that is enabled.
export function useForgemagiePageEnabled(): { enabled: boolean; reading: boolean } {
  const [enabled, setEnabled] = useState(() => readCachedSiteSettings().forgemagiePage);
  const [reading, setReading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void getSiteSettings().then((settings) => {
      if (cancelled) return;
      if (settings) {
        cacheSiteSettings(settings);
        setEnabled(settings.forgemagiePage);
      }
      setReading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { enabled, reading };
}
