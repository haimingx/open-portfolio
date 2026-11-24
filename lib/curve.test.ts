import { describe, expect, it } from 'vitest';
import { curve, curveImage, nearest, plot } from './curve';

const at = (value: number | null, i = 0) => ({ time: `2026-11-0${i + 1}T00:00:00Z`, value });
const draw = (values: (number | null)[]) => curve(plot(values.map((value, i) => at(value, i))));

describe('plot', () => {
  it('spreads points across the width and leaves gaps out', () => {
    const plotted = plot([at(10, 0), at(null, 1), at(20, 2)]);
    expect(plotted[1]).toBeNull();
    expect(plotted[0]!.x).toBe(0);
    expect(plotted[2]!.x).toBe(100);
  });

  it('scales to the values shown, so a small drift still reads as a shape', () => {
    const spread = (values: number[]) => {
      const ys = plot(values.map((value, i) => at(value, i))).map((p) => p!.y);
      return Math.max(...ys) - Math.min(...ys);
    };
    expect(spread([1_000_000, 1_000_010])).toBeCloseTo(spread([0, 1_000_000]), 1);
  });

  it('plots nothing from fewer than two values', () => {
    expect(plot([])).toEqual([]);
    expect(plot([at(10)])).toEqual([]);
    expect(plot([at(10), at(null)])).toEqual([]);
  });
});

describe('curve', () => {
  it('draws one segment for a series without gaps', () => {
    const [segment, ...rest] = draw([10, 20, 15]);
    expect(rest).toEqual([]);
    expect(segment.line.split('L')).toHaveLength(3);
    expect(segment.line).toMatch(/^M0\.00,.+L50\.00,[\d.]+L100\.00,[\d.]+$/);
    expect(segment.area.endsWith('Z')).toBe(true);
  });

  it('fills the whole width, so the first and last points sit on its edges', () => {
    const [segment] = draw([10, 20]);
    expect(segment.line).toMatch(/^M0\.00,/);
    expect(segment.line).toMatch(/L100\.00,/);
  });

  it('breaks the line where a value is missing', () => {
    const segments = draw([10, 20, null, 30, 25]);
    expect(segments).toHaveLength(2);
    expect(segments[0].line).toMatch(/^M0\.00,[\d.]+L25\.00,[\d.]+$/);
    expect(segments[1].line).toMatch(/^M75\.00,[\d.]+L100\.00,[\d.]+$/);
  });

  it('draws a flat series as a straight line', () => {
    const [segment] = draw([5, 5, 5]);
    const ys = segment.line.split('L').map((part) => Number(part.replace('M', '').split(',')[1]));
    expect(new Set(ys).size).toBe(1);
  });
});

describe('nearest', () => {
  const plotted = plot([at(10, 0), at(20, 1), at(null, 2), at(30, 3)]);

  it('picks the point closest to the cursor, across the whole width', () => {
    expect(nearest(plotted, 0)).toBe(0);
    expect(nearest(plotted, 0.33)).toBe(1);
    expect(nearest(plotted, 1)).toBe(3);
  });

  it('skips the gaps', () => {
    expect(nearest(plotted, 0.67)).toBe(3);
  });

  it('returns nothing when there is no point to pick', () => {
    expect(nearest([null, null], 0.5)).toBeNull();
    expect(nearest([], 0.5)).toBeNull();
  });
});

describe('curveImage', () => {
  const box = { width: 600, height: 300, stroke: '#000', fill: '#fff' };

  it('renders the shape as an image for the share cards', () => {
    const image = curveImage([at(10, 0), at(20, 1)], box)!;
    expect(image.startsWith('data:image/svg+xml,')).toBe(true);
    const svg = decodeURIComponent(image.slice('data:image/svg+xml,'.length));
    expect(svg).toContain('width="600"');
    expect(svg).toContain('<path');
    expect(svg).toContain('stroke="#000"');
  });

  it('mirrors the shape when asked, so compared cards meet at the centre', () => {
    const points = [at(10, 0), at(20, 1)];
    const read = (image: string) => decodeURIComponent(image.slice('data:image/svg+xml,'.length));
    expect(read(curveImage(points, box)!)).toContain('M0.00,');
    expect(read(curveImage(points, { ...box, mirror: true })!)).toContain('M100.00,');
  });

  it('can clear the fill towards one side, so two halves meet without a straight edge', () => {
    const read = (image: string) => decodeURIComponent(image.slice('data:image/svg+xml,'.length));
    const faded = read(curveImage([at(10, 0), at(20, 1)], { ...box, fade: 'left' })!);
    expect(faded).toContain('<linearGradient');
    expect(faded).toContain('url(#f)');
    expect(read(curveImage([at(10, 0), at(20, 1)], box)!)).not.toContain('linearGradient');
  });

  it('is nothing without a shape', () => {
    expect(curveImage([at(10)], box)).toBeNull();
    expect(curveImage([], box)).toBeNull();
  });
});
