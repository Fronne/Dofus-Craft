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
