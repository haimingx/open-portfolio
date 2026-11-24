import type { CSSProperties, ReactNode } from 'react';
import { CARD_DESIGNS, cardRamp, cardTotalSize, cardTotalSlot, eraColor, fadeBackground } from '@/lib/card';
import { countChains, formatCompactMoney, formatDay, formatStamp, shortAddress } from '@/lib/format';
import type { cardData } from '@/lib/portfolio';
import { eraBand, eraLabel, type Story } from '@/lib/story';
import type { ChainTotal, Portfolio } from '@/lib/types';
import type { CardStyle } from '@/lib/view-state';

export const CARD_SIZE = { width: 1200, height: 630 };
// Every text block has a fixed place, so switching between cards changes the words and the layers but nothing moves.
const IDENTITY_HEIGHT = 40;
const SPLIT_WIDTH = 300;
const ROW_MIN_HEIGHT = 26;
const REST_ROW_HEIGHT = 44;

// next/og (Satori) supports only flex layout and inline styles; the structure mirrors cardHtml in the mock, with its grid rewritten as flex.
type Logos = Map<string, string | null>;

export function ChainMark({ src, name, ring, size = 20 }: { src: string | null | undefined; name: string; ring: string; size?: number }) {
  const base = { width: size, height: size, borderRadius: size / 2, border: `1.5px solid ${ring}`, flexShrink: 0 };
  return src
    // eslint-disable-next-line @next/next/no-img-element -- Satori only understands a native img
    ? <img src={src} width={size} height={size} alt="" style={{ ...base, background: '#FFFFFF' }} />
    : <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', color: '#0B1410', fontSize: Math.round(size * 0.55), fontWeight: 600 }}>{name.slice(0, 1)}</div>;
}

export function ShareCard({ portfolio, data, story, style, logos, brand, curve }: { portfolio: Portfolio; data: ReturnType<typeof cardData>; story: Story | null; style: CardStyle; logos: Logos; brand: string; curve: string | null }) {
  const d = CARD_DESIGNS[style];
  const { layers, others } = data;
  const ramp = cardRamp(style, layers.length);
  const fade = d.layout === 'fade';
  const rowPadding = d.layout === 'flow' ? '0 48px' : fade ? '0 40px 0 640px' : '0 40px';
  const totalText = story?.age ?? formatCompactMoney(data.total);
  const totalSize = cardTotalSize(totalText, style);
  const { tokens, positions } = data;

  // The primary name can be long, so it truncates on one line instead of crowding the brand.
  // Identity matches the wallet page: the name in a tag colored like Other chains with the short address beside it; an image has no link, so the address lets viewers confirm the wallet.
  const address = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: '0 1 auto', height: IDENTITY_HEIGHT }}>
      {portfolio.name && (
        <div style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '4px 14px', borderRadius: 4, background: d.restBg, color: d.restInk, fontSize: 26, fontWeight: 500 }}>{portfolio.name}</div>
      )}
      <div style={{ flex: 'none', fontSize: 26, color: d.muted }}>{shortAddress(portfolio.address)}</div>
    </div>
  );
  // Brand and address share the secondary color, leaving the focus on the total.
  const brandMark = <div style={{ fontSize: 26, color: d.muted }}>{brand}</div>;
  const totalFigure = <div style={{ display: 'flex', alignItems: 'flex-end', height: cardTotalSlot(style), fontSize: totalSize, lineHeight: 1, fontWeight: 500, letterSpacing: -totalSize * 0.04 }}>{totalText}</div>;
  const sayStyle = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 28, color: d.muted };
  // Satori wraps a fragment in its own box, so gap only applies between direct children.
  const say = story
    ? <div style={sayStyle}>{`on-chain since ${formatDay(story.since)}`}</div>
    : data.scope
    ? <div style={sayStyle}><span>on</span><ChainMark src={logos.get(data.scope.id)} name={data.scope.name} ring={d.ring} size={28} /><span>{data.scope.name}</span></div>
    : <div style={sayStyle}>{`across ${countChains(portfolio.chains.length)}`}</div>;
  // Cards get forwarded and screenshotted, so they state when the data was read.
  const stamp = <div style={{ fontSize: 24, color: d.muted }}>{formatStamp(portfolio.generatedAt)}</div>;
  const split = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: SPLIT_WIDTH, fontSize: 26, lineHeight: 1.2 }}>
      {(story ? [['Chains', String(story.chains)], ['Value', formatCompactMoney(data.total)]] as const : [['Tokens', formatCompactMoney(tokens)], ['Positions', formatCompactMoney(positions)]] as const).map(([label, value]) => (
        <div key={label} style={{ display: 'flex', gap: 24, justifyContent: 'space-between' }}>
          <span style={{ color: d.muted }}>{label}</span>
          <span style={{ fontWeight: 500 }}>{value}</span>
        </div>
      ))}
    </div>
  );

  // Chain layers, story years and the folded row are one kind of row: marks and a name on the left, one figure on the right.
  const row = (key: string | number, size: CSSProperties, band: string, ink: string, left: ReactNode[], right: string) => (
    <div key={key} style={{ ...size, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: rowPadding, background: fade ? fadeBackground(band, d.bg) : band, color: ink, fontSize: 18, fontWeight: 500 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{left}</div>
      <span>{right}</span>
    </div>
  );
  const grows = (grow: number) => ({ flex: `${grow} 1 0`, minHeight: ROW_MIN_HEIGHT });
  const pile = (chains: ChainTotal[]) => (
    <div key="pile" style={{ display: 'flex' }}>
      {chains.map((c, k) => <div key={c.id} style={{ display: 'flex', marginLeft: k ? -6 : 0 }}><ChainMark src={logos.get(c.id)} name={c.name} ring={d.ring} /></div>)}
    </div>
  );
  const rows = layers.map((c, i) => row(c.id, grows(c.share), ramp[i], d.text[0], [<ChainMark key="mark" src={logos.get(c.id)} name={c.name} ring={d.ring} />, c.name], `${c.share.toFixed(1)}%`));
  // Here the thickness carries time instead of value.
  const eras = story?.eras.map((era, i) => {
    const band = eraColor(style, eraBand(i, story.eras.length));
    return row(era.year, grows(era.grow), band, band === d.restBg ? d.restInk : d.text[0], [pile(era.chains), <span key="label">{eraLabel(era.chains)}</span>], String(era.year));
  });
  const rest = !story && others && row('rest', { height: REST_ROW_HEIGHT }, d.restBg, d.restInk, [pile(data.pile), `Other ${others.chains.length} ${data.unit}`], `${others.share.toFixed(1)}%`);
  // The seven-day trend sits behind the header, where the page shows it; an image has no interaction.
  const trend = curve ? (
    // eslint-disable-next-line @next/next/no-img-element -- Satori only understands a native img
    <img src={curve} width={CARD_SIZE.width} height={260} alt="" style={{ position: 'absolute', top: 0, left: 0, width: CARD_SIZE.width, height: 260 }} />
  ) : null;

  const column = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, ...(d.layout === 'flow' ? {} : { height: CARD_SIZE.height, flex: 'none', width: fade ? CARD_SIZE.width : CARD_SIZE.width - 500 }) }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{eras ?? rows}</div>
      {rest}
    </div>
  );
  const copy = (
    <div style={{
      position: (fade ? 'absolute' : 'relative') as CSSProperties['position'],
      width: 500, flex: 'none', padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: d.side ?? 'transparent', overflow: 'hidden',
      ...(fade ? { top: 0, bottom: 0, left: 0 } : {})
    }}>
      {trend && (
        // eslint-disable-next-line @next/next/no-img-element -- Satori only understands a native img
        <img src={curve!} width={500} height={320} alt="" style={{ position: 'absolute', top: 0, left: 0, width: 500, height: 320 }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {address}
        <div style={{ display: 'flex', flexDirection: 'column' }}>{totalFigure}{say}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {split}
        {stamp}
        <div style={{ display: 'flex', marginTop: 8 }}>{brandMark}</div>
      </div>
    </div>
  );

  const frame = { ...CARD_SIZE, display: 'flex', background: d.bg, color: d.ink, fontFamily: 'Libre Franklin', position: 'relative' as const };
  if (d.layout === 'flow') {
    return (
      <div style={{ ...frame, flexDirection: 'column' }}>
        <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '36px 48px 28px', background: d.head }}>
          {trend}
          {/* Keep at least 32px between identity and brand; a long name shrinks only the name tag */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>{address}<div style={{ display: 'flex', flex: 'none' }}>{brandMark}</div></div>
          {/* The two subtotals align with the bottom of the total and the chain count goes on the next line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>{totalFigure}<div style={{ display: 'flex', marginBottom: 6 }}>{split}</div></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>{say}{stamp}</div>
        </div>
        {column}
      </div>
    );
  }
  return <div style={{ ...frame, flexDirection: 'row' }}>{fade ? <>{column}{copy}</> : <>{copy}{column}</>}</div>;
}

const DECOR = [4, 7, 15, 24, 47];

// Fallback card and home page share image: heading, decorative layers and brand, so a failed read never yields a blank image.
export function FallbackCard({ brand }: { brand: string }) {
  const d = CARD_DESIGNS.vivid;
  const ramp = cardRamp('vivid', DECOR.length);
  return (
    <div style={{ ...CARD_SIZE, display: 'flex', background: d.bg, color: d.ink, fontFamily: 'Libre Franklin' }}>
      <div style={{ width: 620, flex: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 56, background: d.head }}>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.4 }}>{brand}</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, lineHeight: 1.02, fontWeight: 500, letterSpacing: -2.7 }}>See any wallet</div>
          <div style={{ fontSize: 76, lineHeight: 1.02, fontWeight: 500, letterSpacing: -2.7 }}>in layers</div>
          <div style={{ marginTop: 24, fontSize: 28, color: d.muted }}>Paste any EVM address or ENS name to get a page you can share.</div>
        </div>
      </div>
      <div style={{ flex: 'none', width: CARD_SIZE.width - 620, display: 'flex', flexDirection: 'column' }}>
        {DECOR.map((share, i) => <div key={share} style={{ flex: `${share} 1 0`, background: ramp[i] }} />)}
      </div>
    </div>
  );
}
