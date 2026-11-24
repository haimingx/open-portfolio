import type { CSSProperties } from 'react';
import { bandStep, CARD_DESIGNS, eraColor, fadeBackground } from './card';
import type { CardStyle } from './view-state';

const splitBackground = (color: string) => `linear-gradient(90deg, transparent var(--split), ${color} var(--split))`;

function sideBackground(card: CardStyle, color: string): string | null {
  const d = CARD_DESIGNS[card];
  if (d.layout === 'fade') return fadeBackground(color, d.bg);
  if (d.layout === 'side') return splitBackground(color);
  return null;
}

// In light mode the wallet page follows the selected card style; dark mode keeps the dark ramp. The structure stays the same: .stage wraps the total and the layers
// so the left column of the Side styles runs from the total into the layers: a soft fade for fade, a hard edge at --split for blend.
export function pageStyleCss(card: CardStyle): string {
  const d = CARD_DESIGNS[card];
  const top = d.layout === 'flow';
  const vars = [...d.ramp.map((color, i) => `--l${i + 1}:${color}`), ...d.text.map((color, i) => `--f${i + 1}:${color}`),
    `--top-bg:${d.bg}`, `--lead-bg:${top ? d.head : 'none'}`, `--stage-bg:${d.side ?? d.bg}`,
    `--others-bg:${sideBackground(card, d.restBg) ?? d.restBg}`, `--others-ink:${d.restInk}`, '--others-rule:transparent',
    `--others-name:${top ? d.restInk : d.ink}`, `--l7:${d.restBg}`, `--f7:${d.restInk}`, `--others-ring:${top ? d.restBg : d.bg}`];
  return `@media (prefers-color-scheme: light) {
  :root { ${vars.join(';')} }
  .layer[style*="--side-bg"] { background: var(--side-bg); }
}`;
}

const sideVars = (card: CardStyle, color: string): Record<string, string> => {
  const bg = sideBackground(card, color);
  return bg ? { '--side-bg': bg } : {};
};

export const layerSideVars = (card: CardStyle, index: number, count: number) => sideVars(card, CARD_DESIGNS[card].ramp[bandStep(index, count) - 1]);

export const eraSideVars = (card: CardStyle, band: number) => sideVars(card, eraColor(card, band));

// The ranking uses the share card's grammar: first place takes the closing --l7, and lower ranks interpolate between --l7 and --l1 in OKLab.
// Each rank is at most one step lighter, so a short ranking never jumps from the darkest to the lightest band.
export function heatBand(index: number, count: number): CSSProperties {
  const p = index * Math.min(1, count > 1 ? 6 / (count - 1) : 1);
  const a = Math.floor(p);
  const f = p - a;
  const from = 7 - a;
  const to = Math.max(1, from - 1);
  return {
    '--band': f ? `color-mix(in oklab, var(--l${from}) ${((1 - f) * 100).toFixed(0)}%, var(--l${to}))` : `var(--l${from})`,
    '--text': `var(--f${f < 0.5 ? from : to})`
  } as CSSProperties;
}
