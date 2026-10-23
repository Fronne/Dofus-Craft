import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'lazy-page-reloaded';

/** React.lazy for a page's named export. After a deployment, an open tab still points at chunk
 * files that no longer exist: the import fails, and one reload fetches the new build. The
 * sessionStorage flag keeps a page that fails for another reason from reloading forever. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same bound as React.lazy
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const module = await load();
      try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* storage unavailable */ }
      return module;
    } catch (error) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === '1';
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_KEY, '1');
      } catch { /* storage unavailable: don't risk a reload loop */ }
      if (!alreadyReloaded) {
        window.location.reload();
        // The page is going away: keep Suspense on its fallback instead of showing an error.
        return new Promise<never>(() => undefined);
      }
      throw error;
    }
  });
}
