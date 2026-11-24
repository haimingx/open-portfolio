import { Brand } from './brand';
import { SKELETON_SHARES } from './wallet-loading';
import type { CSSProperties } from 'react';
import { bandStep } from '@/lib/card';
import { shortAddress } from '@/lib/format';
import { pageStyleCss } from '@/lib/page-style';
import type { CardStyle } from '@/lib/view-state';

type Wallet = { address: string; name: string | null };

function Side({ wallet: { address, name }, mirror }: { wallet: Wallet; mirror: boolean }) {
  return (
    <div className={`vs-side${mirror ? ' mirror' : ''}`}>
      <div className="vs-identity">
        <div className="vs-name-slot">{name ? <span className="ens-name">{name}</span> : <span className="bone bone-tag" aria-hidden="true" />}</div>
        <span className="vs-address">{shortAddress(address)}</span>
      </div>
      <div className="vs-figure" aria-hidden="true"><span className="bone" /></div>
      <p className="vs-facts" aria-hidden="true"><span className="bone">&nbsp;</span></p>
    </div>
  );
}

function Strata({ mirror }: { mirror: boolean }) {
  return (
    <div className={`vs-strata${mirror ? ' mirror' : ''}`} aria-hidden="true">
      {SKELETON_SHARES.map((share, i) => (
        <div key={share} className="vs-layer bone-layer" style={{ '--share': share, '--band': `var(--l${bandStep(i, SKELETON_SHARES.length)})` } as CSSProperties} />
      ))}
    </div>
  );
}

// The comparison page's structure with its classes, so the data replaces it without moving the layout; names and colors come from the URL.
export function CompareLoading({ first, second, card }: { first: Wallet; second: Wallet; card: CardStyle }) {
  return (
    <div className="compare-page" aria-busy="true">
      <style>{pageStyleCss(card)}</style>
      <header className="top">
        <Brand compact />
      </header>
      <section className="vs-lead">
        <p className="vs-stamp" role="status">Reading both wallets…</p>
        <Side wallet={first} mirror={false} />
        <Side wallet={second} mirror />
      </section>
      <div className="vs-layers">
        <Strata mirror={false} />
        <Strata mirror />
      </div>
    </div>
  );
}
