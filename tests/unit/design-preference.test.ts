import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDesign, getDesignId, setDesignId } from '../../src/persistence/design-preference';

describe('design preference (specs/012-modern-design)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.design;
  });

  it('defaults to the modern design when nothing is stored (FR-004)', () => {
    expect(getDesignId()).toBe('modern');
  });

  it('defaults to the modern design for an unknown value', () => {
    window.localStorage.setItem('craftcheck-design-choice', 'retro');
    expect(getDesignId()).toBe('modern');
  });

  it('defaults to the modern design when localStorage is unavailable, without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getDesignId()).toBe('modern');
  });

  it('remembers the chosen design', () => {
    setDesignId('modern');
    expect(getDesignId()).toBe('modern');
  });

  it('puts the modern design on the document root and takes it off again', () => {
    applyDesign('modern');
    expect(document.documentElement.dataset.design).toBe('modern');
    applyDesign('classic');
    expect(document.documentElement.hasAttribute('data-design')).toBe(false);
  });
});
