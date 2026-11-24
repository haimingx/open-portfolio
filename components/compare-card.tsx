import type { CSSProperties, ReactNode } from 'react';
import { CARD_DESIGNS, cardRamp, compareTotalSize, compareTotalSlot, fadeBackground } from '@/lib/card';
import type { Comparison, Verdict } from '@/lib/compare';
import { countChains, formatCompactMoney, formatStamp, shortAddress } from '@/lib/format';
import type { cardData } from '@/lib/portfolio';
import type { Story } from '@/lib/story';
import type { Portfolio } from '@/lib/types';
import type { CardStyle } from '@/lib/view-state';
import { CARD_SIZE, ChainMark } from './share-card';

export type CompareSide = { portfolio: Portfolio; data: ReturnType<typeof cardData>; story: Story | null; logos: Map<string, string | null> };

const HALF = CARD_SIZE.width / 2;
const SIDE_PANEL = 300;
const HEAD_HEIGHT = 246;
const ROW_MIN_HEIGHT = 26;
const REST_ROW_HEIGHT = 40;
const IDENTITY_HEIGHT = 40;
const PARTIAL = 'Partial data';
// Half a card holds fewer logos than a whole one, and a Side column fewer again; the count says how many there are.
export const COMPARE_PILE = 6;
const SIDE_PILE = 3;
// Each half's trend stops short of the centre line, so the two never meet and read as one continuous line across the card.
export const TREND_GAP = 40;

// One wallet's half of the card. mirror lays it out from the right edge, so the two halves meet at the centre as one card.
function Half({ side, style, mirror, position, comparison, foot, curve }: { side: CompareSide; style: CardStyle; mirror: boolean; position: Verdict; comparison: Comparison; foot: ReactNode; curve: string | null }) {
  const d = CARD_DESIGNS[style];
  const flow = d.layout === 'flow';
  const fade = d.layout === 'fade';
  const { portfolio, data, story, logos } = side;
  const direction = (mirror ? 'row-reverse' : 'row') as CSSProperties['flexDirection'];
  const edge = mirror ? 'flex-end' : 'flex-start';
  const behind = (verdict: Verdict) => verdict === -position;
  const emphasis = (verdict: Verdict) => (behind(verdict) ? { color: d.muted, fontWeight: 400 } : { color: d.ink, fontWeight: 600 });

  // Satori paints children in order, so the trend goes first in each block: above the block's own background, under its text.
  const trend = curve ? (
    // eslint-disable-next-line @next/next/no-img-element -- Satori only understands a native img
    <img src={curve} width={HALF - TREND_GAP} height={HEAD_HEIGHT} alt="" style={{ position: 'absolute', top: 0, [mirror ? 'right' : 'left']: 0, width: HALF - TREND_GAP, height: HEAD_HEIGHT }} />
  ) : null;
  const money = formatCompactMoney(portfolio.total);
  const size = compareTotalSize(money, style);
  const figure = <div style={{ display: 'flex', alignItems: 'flex-end', height: compareTotalSlot(style), fontSize: size, lineHeight: 1, letterSpacing: -size * 0.04, ...emphasis(comparison.value) }}>{money}</div>;
  const name = portfolio.name && (
    <div style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '3px 12px', borderRadius: 4, fontSize: 24, fontWeight: 500, ...(behind(comparison.value) ? { border: `1px solid ${d.muted}`, color: d.muted } : { border: `1px solid ${d.restBg}`, background: d.restBg, color: d.restInk }) }}>{portfolio.name}</div>
  );
  const address = <div style={{ flex: 'none', fontSize: 22, color: d.muted }}>{shortAddress(portfolio.address)}</div>;
  const age = story && <span style={emphasis(comparison.age)}>{story.age}</span>;
  const chains = <span style={emphasis(comparison.chains)}>{countChains(portfolio.chains.length)}</span>;

  const padding = flow ? (mirror ? '0 40px 0 24px' : '0 24px 0 40px') : fade ? (mirror ? `0 ${SIDE_PANEL + 16}px 0 20px` : `0 20px 0 ${SIDE_PANEL + 16}px`) : '0 24px';
  const band = (color: string) => (fade ? fadeBackground(color, d.bg, undefined, undefined, undefined, mirror ? 270 : 90) : color);
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: direction, padding, fontSize: 18, fontWeight: 500 } as CSSProperties;
  const ramp = cardRamp(style, data.layers.length);
  const layers = (
    <div key="layers" style={{ display: 'flex', flexDirection: 'column', ...(flow ? { flex: 1, width: HALF } : { height: CARD_SIZE.height, width: fade ? HALF : HALF - SIDE_PANEL }) }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {data.layers.map((c, i) => (
          <div key={c.id} style={{ ...row, flex: `${c.share} 1 0`, minHeight: ROW_MIN_HEIGHT, background: band(ramp[i]), color: d.text[0] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: direction }}><ChainMark src={logos.get(c.id)} name={c.name} ring={d.ring} /><span>{c.name}</span></div>
            <span>{`${c.share.toFixed(1)}%`}</span>
          </div>
        ))}
      </div>
      {data.others && (
        <div style={{ ...row, height: REST_ROW_HEIGHT, background: band(d.restBg), color: d.restInk }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: direction }}>
            <div style={{ display: 'flex' }}>{data.pile.slice(0, flow ? COMPARE_PILE : SIDE_PILE).map((c, k) => <div key={c.id} style={{ display: 'flex', marginLeft: k ? -6 : 0 }}><ChainMark src={logos.get(c.id)} name={c.name} ring={d.ring} /></div>)}</div>
            <span>{`Other ${data.others.chains.length} chains`}</span>
          </div>
          <span>{`${data.others.share.toFixed(1)}%`}</span>
        </div>
      )}
    </div>
  );

  if (flow) {
    return (
      <div style={{ width: HALF, height: CARD_SIZE.height, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', overflow: 'hidden', height: HEAD_HEIGHT, display: 'flex', flexDirection: 'column', alignItems: edge, padding: mirror ? '34px 40px 28px 24px' : '34px 24px 28px 40px', background: d.head }}>
          {trend}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: IDENTITY_HEIGHT, maxWidth: 420, flexDirection: direction }}>{name}{address}</div>
          <div style={{ display: 'flex', marginTop: 12 }}>{figure}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, fontSize: 28 }}>{age}{age && <span style={{ color: d.muted }}>·</span>}{chains}</div>
        </div>
        {layers}
      </div>
    );
  }
  const panel = (
    <div key="panel" style={{ position: fade ? 'absolute' : 'relative', top: 0, [mirror ? 'right' : 'left']: 0, width: SIDE_PANEL, height: CARD_SIZE.height, padding: mirror ? '40px 36px 36px 12px' : '40px 12px 36px 36px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: edge, background: d.side ?? 'transparent' }}>
      {trend && (
        // eslint-disable-next-line @next/next/no-img-element -- Satori only understands a native img
        <img src={curve!} width={SIDE_PANEL} height={320} alt="" style={{ position: 'absolute', top: 0, [mirror ? 'right' : 'left']: 0, width: SIDE_PANEL, height: 320 }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: edge, gap: 8, maxWidth: SIDE_PANEL - 48 }}>
        {/* The name keeps its row when a wallet has none, so both addresses and totals line up. */}
        <div style={{ display: 'flex', alignItems: 'center', height: IDENTITY_HEIGHT, maxWidth: '100%' }}>{name}</div>
        {address}
        <div style={{ display: 'flex', marginTop: 16 }}>{figure}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: edge, gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: edge, gap: 2, fontSize: 24 }}>{age}{chains}</div>
        {foot}
      </div>
    </div>
  );
  // Satori wraps a fragment in its own box, so the two children are passed as an array for the direction to apply.
  return <div style={{ width: HALF, height: CARD_SIZE.height, display: 'flex', flexDirection: fade ? 'row' : direction, position: 'relative', background: d.bg }}>{fade ? [layers, panel] : [panel, layers]}</div>;
}

// The share card, twice: two wallets mirrored around the centre, each measure darker on the side that is ahead.
export function CompareCard({ first, second, comparison, style, brand, curves }: { first: CompareSide; second: CompareSide; comparison: Comparison; style: CardStyle; brand: string; curves: [string | null, string | null] }) {
  const d = CARD_DESIGNS[style];
  const flow = d.layout === 'flow';
  const stamp = formatStamp(first.portfolio.generatedAt);
  const partial = first.portfolio.failedChains.length > 0 || second.portfolio.failedChains.length > 0;
  const line = (text: string) => <div key={text} style={{ display: 'flex' }}>{text}</div>;
  const foot = (lines: string[]) => <div style={{ display: 'flex', flexDirection: 'column', fontSize: 20, color: d.muted }}>{lines.map(line)}</div>;
  return (
    <div style={{ ...CARD_SIZE, display: 'flex', position: 'relative', background: d.bg, color: d.ink, fontFamily: 'Libre Franklin' }}>
      <Half side={first} style={style} mirror={false} position={1} comparison={comparison} foot={foot([brand])} curve={curves[0]} />
      <Half side={second} style={style} mirror position={-1} comparison={comparison} foot={foot(partial ? [stamp, PARTIAL] : [stamp])} curve={curves[1]} />
      {flow && <div style={{ position: 'absolute', top: 36, left: 0, width: CARD_SIZE.width, display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 20, lineHeight: 1.3, color: d.muted }}>{[brand, stamp, ...(partial ? [PARTIAL] : [])].map(line)}</div>}
      {/* Keeps the two halves apart where both show the same color. */}
      <div style={{ position: 'absolute', top: flow ? HEAD_HEIGHT : 0, left: HALF - 1, width: 2, height: flow ? CARD_SIZE.height - HEAD_HEIGHT : CARD_SIZE.height, background: `${d.bg}80` }} />
    </div>
  );
}
