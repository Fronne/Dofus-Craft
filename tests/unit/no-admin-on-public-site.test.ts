import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// specs/014-admin-counters, FR-008: the public site never links to, imports or names the
// administration — the owner reaches it through its own bookmarked address.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css|html)$/.test(name) ? [path] : [];
  });
}

const root = resolve(__dirname, '../..');
const files = [...sourceFiles(join(root, 'src')), join(root, 'index.html')];

describe('no administration on the public site (FR-008)', () => {
  it('never imports the administration page', () => {
    const offenders = files.filter((file) => /from ['"][^'"]*\/admin\//.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('never names the administration Worker', () => {
    const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('dofus-craft-admin'));
    expect(offenders).toEqual([]);
  });

  it('has no administration link in the navigation', () => {
    const shell = readFileSync(join(root, 'src/app/AppShell.tsx'), 'utf8');
    expect(shell).not.toMatch(/admin/i);
  });
});
