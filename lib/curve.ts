import type { HistoryPoint } from './types';

// Points are placed by their position in the series, so the trend stays one shape even where marks are missing. Both axes
// are percentages of the drawing box, which lets the same numbers drive the paths and the marker.
export const X = 100;
export const Y = 100;
// Values are scaled to the window they move in, not to zero, so a small drift over seven days still shows its shape.
const PAD = 8;

export type Plotted = { x: number; y: number } | null;
export type Segment = { line: string; area: string };

// A compared wallet's curve is drawn mirrored, so the two sides of the page meet at their newest point.
export function plot(points: HistoryPoint[], mirror = false): Plotted[] {
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  if (values.length < 2) return [];
  const [low, high] = [Math.min(...values), Math.max(...values)];
  const span = high - low || 1;
  const y = (value: number) => PAD + (1 - (value - low) / span) * (Y - PAD * 2);
  const x = (i: number) => {
    const at = (i / (points.length - 1)) * X;
    return mirror ? X - at : at;
  };
  return points.map((p, i) => (p.value === null ? null : { x: x(i), y: y(p.value) }));
}

// A missing value breaks the line: the gap is real, so nothing is drawn across it.
export function curve(plotted: Plotted[]): Segment[] {
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  for (const point of plotted) {
    if (!point) {
      if (run.length > 1) runs.push(run);
      run = [];
      continue;
    }
    run.push([point.x, point.y]);
  }
  if (run.length > 1) runs.push(run);
  return runs.map((segment) => {
    const line = segment.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(2)},${py.toFixed(2)}`).join('');
    return { line, area: `${line}L${segment.at(-1)![0].toFixed(2)},${Y}L${segment[0][0].toFixed(2)},${Y}Z` };
  });
}

// The point nearest a fraction of the width, skipping the gaps; null when there is nothing to point at.
export function nearest(plotted: Plotted[], ratio: number): number | null {
  let best: number | null = null;
  let bestGap = Infinity;
  plotted.forEach((point, i) => {
    if (!point) return;
    const gap = Math.abs(point.x - ratio * X);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  });
  return best;
}

// The share cards are viewed small, so their line carries more ink than the page's; the numbers live here once.
export const CARD_CURVE = { stroke: 'rgba(11, 20, 16, 0.28)', fill: 'rgba(11, 20, 16, 0.06)' };
// A card is fetched by crawlers, so its trend gets a budget: an image without it beats no image at all.
export const CARD_CURVE_BUDGET_MS = 10_000;

// The same shape as an image, for the share cards, which next/og draws from plain markup. Null when there is nothing to draw.
export function curveImage(points: HistoryPoint[], box: { width: number; height: number; stroke: string; fill: string; mirror?: boolean; fade?: 'left' | 'right' }): string | null {
  const segments = curve(plot(points, box.mirror));
  if (!segments.length) return null;
  // A comparison's halves meet in the middle, where the fill would otherwise end in a straight edge; it clears towards that
  // side instead.
  const stops = box.fade === 'left'
    ? `<stop offset="0" stop-color="${box.fill}" stop-opacity="0"/><stop offset="0.35" stop-color="${box.fill}"/>`
    : `<stop offset="0.65" stop-color="${box.fill}"/><stop offset="1" stop-color="${box.fill}" stop-opacity="0"/>`;
  const fade = box.fade ? `<defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>` : '';
  const fill = box.fade ? 'url(#f)' : box.fill;
  const paths = segments
    .map(({ line, area }) => `<path d="${area}" fill="${fill}" stroke="none"/><path d="${line}" fill="none" stroke="${box.stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}" viewBox="0 0 ${X} ${Y}" preserveAspectRatio="none">${fade}${paths}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
