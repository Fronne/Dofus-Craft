import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// specs/051-site-visual-refresh (SC-003): every pair of contracts/ui-contract.md §2 keeps its
// contrast in both themes. The tokens are read from theme.css itself, so changing a color there
// is checked without touching this file.
const css = readFileSync('src/styles/theme.css', 'utf8');

type Rgba = [number, number, number, number];
type Tokens = Record<string, string>;

function declarations(selector: string): Tokens {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No « ${selector} » block in theme.css`);
  const block = css.slice(start, css.indexOf('\n}', start)).replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens: Tokens = {};
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[match[1]] = match[2].trim();
  return tokens;
}

const dark = declarations(':root');
const themes: Record<string, Tokens> = {
  sombre: dark,
  clair: { ...dark, ...declarations(':root[data-theme="light"]') },
};

function parse(value: string, tokens: Tokens): Rgba {
  const text = value.trim();
  const reference = /^var\((--[\w-]+)\)$/.exec(text);
  if (reference) {
    if (!(reference[1] in tokens)) throw new Error(`Unknown token ${reference[1]}`);
    return parse(tokens[reference[1]], tokens);
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(text);
  if (rgba) {
    const [r, g, b, a = '1'] = rgba[1].split(',').map((part) => part.trim());
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  // The only mix the theme uses: a color thinned out with transparency.
  const mix = /^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*transparent\)$/.exec(text);
  if (mix) {
    const [r, g, b, a] = parse(mix[1], tokens);
    return [r, g, b, a * Number(mix[2]) / 100];
  }
  throw new Error(`Cannot read the color « ${text} »`);
}

function over(front: Rgba, back: Rgba): Rgba {
  const a = front[3];
  return [0, 1, 2].map((i) => front[i] * a + back[i] * (1 - a)).concat(1) as Rgba;
}

function luminance([r, g, b]: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function ratio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const SHAPE = 3;

// [foregrounds, backgrounds (bottom layer last), minimum ratio]
const PAIRS: Array<[string[], string[][], number]> = [
  [['--text', '--text-muted', '--text-faint'], [['--bg'], ['--panel'], ['--panel-strong'], ['--panel-soft'], ['--nav-bg']], TEXT],
  [['--accent-bright', '--link', '--kamas'], [['--bg'], ['--panel'], ['--panel-strong']], TEXT],
  [['--on-accent'], [['--accent'], ['--accent-gradient-from'], ['--accent-gradient-to']], TEXT],
  [['--text'], [['--accent-soft', '--panel'], ['--link-soft', '--panel'], ['--kamas-soft', '--panel'], ['--warning-soft', '--panel']], TEXT],
  [['--warning', '--danger'], [['--panel'], ['--panel-strong']], SHAPE],
  [['--border-control'], [['--panel'], ['--bg']], SHAPE],
];

describe.each(Object.entries(themes))('contrastes du thème %s', (_name, tokens) => {
  const bg = parse('var(--bg)', tokens);
  // Translucent layers are flattened onto the page background, bottom layer first.
  const flatten = (layers: string[]) => [...layers].reverse().reduce((back, layer) => over(parse(`var(${layer})`, tokens), back), bg);

  for (const [foregrounds, backgrounds, minimum] of PAIRS) {
    for (const layers of backgrounds) {
      it.each(foregrounds)(`%s sur ${layers.join(' + ')} ≥ ${minimum}:1`, (foreground) => {
        const back = flatten(layers);
        const front = over(parse(`var(${foreground})`, tokens), back);
        expect(ratio(front, back)).toBeGreaterThanOrEqual(minimum);
      });
    }
  }
});
