import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// specs/012-modern-design FR-005: every rule of the new design must be scoped under the attribute
// the "Nouveau" setting puts on <html>. That is what keeps the classic design strictly unchanged,
// and what lets the new design be removed (or made permanent) as a single file.
const SCOPE = ':root[data-design="modern"]';

function selectorsOf(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors: string[] = [];
  const stack: string[] = [];
  let buffer = '';
  for (const char of withoutComments) {
    if (char === '{') {
      const prelude = buffer.trim();
      buffer = '';
      const inKeyframes = stack.some((entry) => entry.startsWith('@keyframes'));
      if (!prelude.startsWith('@') && !inKeyframes) selectors.push(...prelude.split(',').map((part) => part.trim()));
      stack.push(prelude);
    } else if (char === '}') {
      stack.pop();
      buffer = '';
    } else if (char === ';' && !stack.length) {
      buffer = ''; // top-level at-rule statement, e.g. @import
    } else {
      buffer += char;
    }
  }
  return selectors;
}

describe('src/styles/design-modern.css scope', () => {
  const css = readFileSync(resolve(__dirname, '../../src/styles/design-modern.css'), 'utf8');
  const selectors = selectorsOf(css);

  it('has rules', () => {
    expect(selectors.length).toBeGreaterThan(0);
  });

  it('scopes every selector under the new design attribute', () => {
    const unscoped = selectors.filter((selector) => !selector.startsWith(SCOPE));
    expect(unscoped).toEqual([]);
  });
});
