import { Brand } from './brand';
import type { CSSProperties } from 'react';
import { bandStep } from '@/lib/card';
import { shortAddress } from '@/lib/format';
import { pageStyleCss } from '@/lib/page-style';
import type { CardStyle } from '@/lib/view-state';

// The skeleton reuses the wallet page's structure and classes, so data replaces content without moving the layout; the address and card colors come from the URL without waiting for the read.
export const SKELETON_SHARES = [8, 14, 26, 52];
const ROWS = [62, 48, 70, 40, 55];

function Rows() {
  return (
    <div className="bone-rows">
      {ROWS.map((width) => <span key={width} className="bone" style={{ width: `${width}%` }} />)}
    </div>
  );
}

export function WalletLoading({ address, name, card }: { address: string; name: string | null; card: CardStyle }) {
  return (
    <div className="wallet-loading" aria-busy="true">
      <style>{pageStyleCss(card)}</style>
      <header className="top">
        <Brand compact />
      </header>
      <div className="stage">
        <section className="lead">
          <div className="lead-top">
            <div className="identity">
              {/* An address URL does not know the primary name before the data arrives, so reserve room for the tag */}
              {name ? <span className="ens-name">{name}</span> : <span className="bone bone-tag" aria-hidden="true" />}
              <span className="addr">{shortAddress(address)}</span>
            </div>
            {/* Same room as the Portfolio and Story switch, which can take its own row on a phone. */}
            <div className="card-content" aria-hidden="true"><span className="card-tab"><span>Portfolio</span></span><span className="card-tab"><span>Story</span></span></div>
          </div>
          <div className="lead-figure" aria-hidden="true"><span className="bone" /></div>
          {/* The waiting hint shares the line, so the skeleton matches the usual one-line note and the layers do not move when data arrives. */}
          <p className="note" role="status">Reading this wallet across chains… <span className="slow-hint">Large wallets take up to 10 seconds.</span></p>
        </section>
        <section className="layers" aria-hidden="true">
          {SKELETON_SHARES.map((share, i) => {
            const step = bandStep(i, SKELETON_SHARES.length);
            const style = { '--band': `var(--l${step})`, '--share': share / 100 } as CSSProperties;
            return <div key={share} className="layer bone-layer" style={style} />;
          })}
        </section>
      </div>
      <div className="sheet" aria-hidden="true">
        {['Tokens', 'Positions'].map((title) => (
          <section key={title} className="block">
            <div className="rail"><h2>{title}</h2></div>
            <Rows />
          </section>
        ))}
      </div>
    </div>
  );
}
