import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// specs/032-cosmos-design FR-012: every rule of the Cosmos design must be scoped under the attribute
// the « Cosmos » setting puts on <html>. That is what keeps the other designs strictly unchanged,
// and what lets Cosmos be removed as a single file.
const SCOPE = ':root[data-design="cosmos"]';

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

describe('src/styles/design-cosmos.css scope', () => {
  const css = readFileSync(resolve(__dirname, '../../src/styles/design-cosmos.css'), 'utf8');
  const selectors = selectorsOf(css);

  it('has rules', () => {
    expect(selectors.length).toBeGreaterThan(0);
  });

  it('scopes every selector under the Cosmos design attribute', () => {
    const unscoped = selectors.filter((selector) => !selector.startsWith(SCOPE));
    expect(unscoped).toEqual([]);
  });

  it('leaves the game-derived colors alone (spec Edge Cases)', () => {
    expect(css).not.toMatch(/--slot-(bg|border|glyph)\s*:/);
    expect(css).not.toMatch(/--image-bg\s*:/);
  });
});
