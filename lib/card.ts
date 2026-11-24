import type { CardStyle } from './view-state';

const DARK_TEXT = '#0B1410';
const VIVID = ['#F2FBB8', '#BDE531', '#93E236', '#5BD85C', '#2BC873', '#0FA968'];
const RAMP_STEPS = VIVID.length;
// A story adds the closing color below the ramp for its oldest layer.
export const ERA_BANDS = RAMP_STEPS + 1;

type CardDesign = {
  name: string; group: 'Top' | 'Side'; layout: 'flow' | 'fade' | 'side';
  ink: string; muted: string; ring: string; bg: string; head?: string; side?: string;
  ramp: string[]; text: string[]; restBg: string; restInk: string;
};

const BASE = { ink: DARK_TEXT, ring: '#9EB83A', text: Array(6).fill(DARK_TEXT), restBg: '#0B7A53', restInk: '#FFFFFF' };

// Matches cardDesigns in the mock; the wallet page in light mode and the share card share this definition.
export const CARD_DESIGNS: Record<CardStyle, CardDesign> = {
  vivid: { ...BASE, name: 'Vivid', group: 'Top', layout: 'flow', muted: '#47561A', bg: '#F4FBC4', head: 'linear-gradient(180deg, #F4FBC4 0%, #D3EE62 100%)', ramp: VIVID },
  soft: { ...BASE, name: 'Soft', group: 'Top', layout: 'flow', muted: '#566222', bg: '#FBFEEC', head: 'linear-gradient(180deg, #FBFEEC 0%, #F0FAC4 100%)', ramp: ['#FBFEEC', '#E6F7A6', '#C9EC52', '#8CE03D', '#3FD07A', '#0FA968'] },
  fade: { ...BASE, name: 'Fade', group: 'Side', layout: 'fade', muted: '#47561A', bg: '#F4FBC4', ramp: VIVID },
  blend: { ...BASE, name: 'Blend', group: 'Side', layout: 'side', muted: '#47561A', bg: '#F4FBC4', side: 'linear-gradient(180deg, #F4FBC4 0%, #D3EE62 100%)', ramp: VIVID }
};

// Era bands count from 0: the six-step ramp, then the closing color for the oldest layer.
export const eraColor = (style: CardStyle, band: number): string => [...CARD_DESIGNS[style].ramp, CARD_DESIGNS[style].restBg][band];

const srgbToLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

function hexToOklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const n = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * n, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * n, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * n];
}

function oklabToHex([L, a, b]: number[]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const n = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * n, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * n, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * n];
  return '#' + channels.map((v) => Math.round(Math.min(1, Math.max(0, linearToSrgb(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('');
}

// Mixing the light tint and deep green directly in sRGB passes through grey, so the stops are sampled in OKLab along an easing curve and written as plain color stops that next/og can render.
export function fadeBackground(to: string, from = '#F4FBC4', start = 30, end = 64, count = 14, angle = 90): string {
  const [a, b] = [hexToOklab(from), hexToOklab(to)];
  const stops = Array.from({ length: count + 1 }, (_, i) => {
    const x = i / count;
    const t = x * x * x * (x * (6 * x - 15) + 10);
    const boost = 1 + 1.1 * Math.max(0, a[0] - b[0] - 0.08) * Math.sin(Math.PI * t);
    const mixed = a.map((v, k) => (v + (b[k] - v) * t) * (k === 0 ? 1 : boost));
    return `${oklabToHex(mixed)} ${(start + (end - start) * x).toFixed(1)}%`;
  });
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
}

// Layers go from light at the top to strong at the bottom, and the bottom layer uses step 6; with few layers take the last steps, with more than 6 spread the 6 steps evenly so every layer has a color.
export function bandStep(index: number, count: number): number {
  if (count <= RAMP_STEPS) return RAMP_STEPS - (count - 1 - index);
  return 1 + Math.round((index * (RAMP_STEPS - 1)) / (count - 1));
}

export function cardRamp(style: CardStyle, layerCount: number): string[] {
  const ramp = CARD_DESIGNS[style].ramp;
  return Array.from({ length: layerCount }, (_, i) => ramp[bandStep(i, layerCount) - 1]);
}

// Shrink the total by character count so it fits both the full-width Top layout and the 500px left column of Side.
const totalFit = (style: CardStyle) => (CARD_DESIGNS[style].layout === 'flow' ? { slot: 104, fits: 11 } : { slot: 92, fits: 8 });

// The figure's slot keeps its full height while a long figure shrinks inside it, so nothing around it moves between cards.
export const cardTotalSlot = (style: CardStyle): number => totalFit(style).slot;

const fitSize = (text: string, { slot, fits }: { slot: number; fits: number }) => (text.length <= fits ? slot : Math.floor((slot * fits) / text.length));

export const cardTotalSize = (text: string, style: CardStyle): number => fitSize(text, totalFit(style));

// A comparison gives each wallet half the card.
const compareFit = (style: CardStyle) => ({ slot: CARD_DESIGNS[style].layout === 'flow' ? 84 : 54, fits: 9 });

export const compareTotalSlot = (style: CardStyle): number => compareFit(style).slot;

export const compareTotalSize = (text: string, style: CardStyle): number => fitSize(text, compareFit(style));

// Option swatches are the card in miniature: the total area takes 40% (top for Top, left for Side) and the layers are two bands.
// Fade layers fade out of the left background and Blend has a separate gradient panel on the left, so the two are easy to tell apart.
export function swatchBackground(d: CardDesign): string {
  const bands = `linear-gradient(180deg, ${d.ramp[2]} 0 50%, ${d.ramp[5]} 50%)`;
  if (d.layout === 'flow') return `${d.head ?? d.bg} top / 100% 40% no-repeat, ${bands} bottom / 100% 60% no-repeat`;
  if (d.layout === 'fade') return `linear-gradient(90deg, ${d.bg} 30%, transparent 64%), ${bands}`;
  return `${d.side ?? d.bg} left / 42% 100% no-repeat, ${bands}`;
}
