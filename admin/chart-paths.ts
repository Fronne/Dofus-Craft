export type Point = { x: number; y: number };

// A smooth line through the points (Catmull-Rom turned into Bézier curves). The control points keep the line from going
// below or above its neighbours, so a flat stretch stays flat and a curve never dips under 0.
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x} ${points[0].y}`;
  let path = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const before = points[i - 1] ?? points[i];
    const from = points[i];
    const to = points[i + 1];
    const after = points[i + 2] ?? to;
    const low = Math.min(from.y, to.y);
    const high = Math.max(from.y, to.y);
    const clamp = (y: number) => Math.min(high, Math.max(low, y));
    const c1 = { x: from.x + (to.x - before.x) / 6, y: clamp(from.y + (to.y - before.y) / 6) };
    const c2 = { x: to.x - (after.x - from.x) / 6, y: clamp(to.y - (after.y - from.y) / 6) };
    path += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`;
  }
  return path;
}

/** The same line closed down to the baseline, to fill the area under it. */
export function areaPath(points: Point[], baseline: number): string {
  if (points.length === 0) return '';
  return `${smoothPath(points)} L${points[points.length - 1].x} ${baseline} L${points[0].x} ${baseline} Z`;
}

const PILL_CHAR = 6.6;
const PILL_PADDING = 18;
export const PILL_HEIGHT = 20;

export type Pill = { id: string; text: string; endX: number; endY: number };
export type PlacedPill = Pill & { x: number; y: number; width: number };

// A pill at the end of a curve, as wide as its text (so nothing is cut), kept inside the chart, and nudged so that two
// pills whose curves end close together do not sit on top of each other.
export function placePills(pills: Pill[], width: number, top: number, bottom: number): PlacedPill[] {
  const sized = pills
    .map((pill) => ({ ...pill, width: Math.ceil(pill.text.length * PILL_CHAR + PILL_PADDING) }))
    .sort((a, b) => a.endY - b.endY);
  let previousBottom = -Infinity;
  return sized.map((pill) => {
    const fitsRight = pill.endX + 8 + pill.width <= width;
    const x = fitsRight ? pill.endX + 8 : pill.endX - 8 - pill.width;
    let y = pill.endY - PILL_HEIGHT / 2;
    y = Math.max(y, previousBottom + 4, top);
    y = Math.min(y, bottom - PILL_HEIGHT);
    previousBottom = y + PILL_HEIGHT;
    return { ...pill, x, y };
  });
}
