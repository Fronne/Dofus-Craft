import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom (used by Vitest) does not implement <dialog>'s showModal()/close() methods
// (specs/007-outlier-confirmation's OutlierConfirmDialog relies on them) — real browsers do, so
// this only affects the jsdom-based unit/integration suite, never Playwright e2e or production.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

// The suite runs with .env.local, i.e. the real community API's URL and key. A test that doesn't
// stub the community service (Mode communautaire is the default for a new player) would otherwise
// send real contributions and visits to production — it did, with the test id "resource-1".
// Any request to that API is refused here; tests that need it stub `fetch` or the service module
// themselves (vi.stubGlobal replaces this guard and restores it afterwards).
const communityApiUrl = import.meta.env.VITE_COMMUNITY_API_URL as string | undefined;
if (communityApiUrl && typeof globalThis.fetch === 'function') {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith(communityApiUrl)) {
      return Promise.reject(new TypeError(`Real community API blocked in tests: ${url}`));
    }
    return realFetch(input, init);
  };
}
