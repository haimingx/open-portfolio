'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { pageStyleCss } from '@/lib/page-style';
import { DEFAULT_CARD, parseView, type CardStyle } from '@/lib/view-state';
import { Brand } from './brand';
import { ShareFrame } from './share-dialog';

// The comparison page's frame: the same top bar and Share dialog as a wallet, around content rendered on the server.
export function CompareShell({ title, firstPath, secondPath, children }: { title: string; firstPath: string; secondPath: string; children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const card = parseView(new URLSearchParams(params.toString()), []).card;
  const [sharing, setSharing] = useState(false);
  const query = (style: CardStyle) => (style === DEFAULT_CARD ? '' : `?card=${style}`);
  const url = () => `${window.location.origin}${pathname}${query(card)}`;
  return (
    <div className="compare-page">
      <style>{pageStyleCss(card)}</style>
      <header className="top">
        <Brand compact />
        <div className="tools"><button className="primary" aria-haspopup="dialog" onClick={() => setSharing(true)}>Share</button></div>
      </header>
      {children}
      {sharing && (
        <ShareFrame title="Share this comparison" card={card} onCardChange={(style) => window.history.replaceState(null, '', `${pathname}${query(style)}`)}
          imageFor={(style) => `/${firstPath}/vs/${secondPath}/card?card=${style}`} preloadKey="compare" url={url()}
          post={`https://x.com/intent/post?${new URLSearchParams({ text: title, url: url() })}`} alt={`${title} on Open Portfolio`}
          fileName={`open-portfolio-${title.replaceAll(' ', '-').replaceAll('…', '-')}.png`} onClose={() => setSharing(false)} />
      )}
    </div>
  );
}
