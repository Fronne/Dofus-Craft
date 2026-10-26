import { describe, expect, it } from 'vitest';
import { PILL_HEIGHT, areaPath, placePills, smoothPath } from '../../admin/chart-paths';

describe('chart-paths', () => {
  it('draws nothing for no point and a single move for one point', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 5, y: 7 }])).toBe('M5 7');
    expect(areaPath([], 100)).toBe('');
  });

  it('keeps a curve between the heights of its neighbours, never dipping under a flat stretch', () => {
    const path = smoothPath([{ x: 0, y: 100 }, { x: 10, y: 100 }, { x: 20, y: 40 }]);
    const ys = [...path.matchAll(/C([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/g)].flatMap((m) => [Number(m[2]), Number(m[4])]);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(40);
  });

  it('closes the area down to the baseline', () => {
    expect(areaPath([{ x: 0, y: 10 }, { x: 20, y: 30 }], 100)).toMatch(/L20 100 L0 100 Z$/);
  });

  it('sizes each pill from its text and keeps it inside the chart, never on the curve', () => {
    const [pill] = placePills([{ id: 'a', text: 'Écritures 120 %', endX: 470, endY: 50 }], 600, 10, 150);
    expect(pill.width).toBeGreaterThan(90);
    expect(pill.x + pill.width).toBeLessThanOrEqual(598);
    expect(pill.x).toBeGreaterThanOrEqual(474);
  });

  it('moves apart two pills whose curves end at the same height', () => {
    const placed = placePills([
      { id: 'a', text: 'Requêtes 10 %', endX: 300, endY: 100 },
      { id: 'b', text: 'Lectures 10 %', endX: 300, endY: 101 },
    ], 600, 10, 150);
    const [first, second] = placed;
    expect(second.y).toBeGreaterThanOrEqual(first.y + PILL_HEIGHT);
  });
});
