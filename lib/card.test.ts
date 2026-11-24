import { describe, expect, it } from 'vitest';
import { bandStep, CARD_DESIGNS, cardRamp, cardTotalSize, cardTotalSlot, fadeBackground, swatchBackground } from './card';
import { heatBand } from './page-style';

describe('share card', () => {
  it('sizes the total to fit its column', () => {
    expect(cardTotalSize('$132,753', 'vivid')).toBe(104);
    expect(cardTotalSize('$132,753', 'fade')).toBe(92);
    expect(cardTotalSize('$9,999,999', 'fade')).toBeLessThan(92);
    expect(cardTotalSize('$9,999,999', 'vivid')).toBe(104);
  });

  it('keeps every figure inside the slot of its layout', () => {
    for (const style of ['vivid', 'fade'] as const) {
      for (const text of ['11 years', '11 months', '$9,999,999', '-$9,999,999']) expect(cardTotalSize(text, style)).toBeLessThanOrEqual(cardTotalSlot(style));
    }
  });

  it('fades with plain color stops from the card background', () => {
    expect(fadeBackground('#0FA968')).not.toContain('oklab');
    expect(fadeBackground('#0FA968').startsWith('linear-gradient(90deg, #f4fbc4 30.0%')).toBe(true);
  });

  it('keeps the largest layer on the deepest green', () => {
    expect(cardRamp('vivid', 2).at(-1)).toBe('#0FA968');
    expect(cardRamp('soft', 5)[0]).toBe('#E6F7A6');
  });

  it('gives every layer a color when there are more layers than ramp steps', () => {
    expect(cardRamp('vivid', 9)).toHaveLength(9);
    expect(cardRamp('vivid', 9).every(Boolean)).toBe(true);
    expect(cardRamp('vivid', 9).at(-1)).toBe('#0FA968');
    const steps = Array.from({ length: 9 }, (_, i) => bandStep(i, 9));
    expect(Math.min(...steps)).toBe(1);
    expect(steps.at(-1)).toBe(6);
  });
});

describe('heatBand', () => {
  const band = (i: number, n: number) => (heatBand(i, n) as Record<string, string>)['--band'];

  it('starts at the deepest step', () => {
    expect(band(0, 1)).toBe('var(--l7)');
    expect(band(0, 10)).toBe('var(--l7)');
  });

  it('lightens by at most one step per rank when the list is short', () => {
    expect(band(1, 2)).toBe('var(--l6)');
    expect(band(2, 3)).toBe('var(--l5)');
  });

  it('spreads across the whole ramp when the list is full', () => {
    expect(band(6, 7)).toBe('var(--l1)');
    expect(band(9, 10)).toBe('var(--l1)');
  });
});

describe('swatchBackground', () => {
  it('draws each style the way its card is laid out, so no two styles look alike', () => {
    const swatches = (['vivid', 'soft', 'fade', 'blend'] as const).map((id) => swatchBackground(CARD_DESIGNS[id]));
    expect(new Set(swatches).size).toBe(4);
  });

  it('puts the total area on top for Top styles and on the left for Side styles', () => {
    expect(swatchBackground(CARD_DESIGNS.vivid)).toContain('top / 100% 40% no-repeat');
    expect(swatchBackground(CARD_DESIGNS.blend)).toContain('left / 42% 100% no-repeat');
    expect(swatchBackground(CARD_DESIGNS.fade)).toMatch(/^linear-gradient\(90deg, #F4FBC4 30%, transparent 64%\)/);
  });
});
