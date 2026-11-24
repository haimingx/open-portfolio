'use client';

import { usePathname } from 'next/navigation';
import { Brand } from './brand';
import { useCallback, useEffect, useRef, useState } from 'react';
import { shortAddress, walletLabel } from '@/lib/format';
import { Money } from './money';
import type { Others } from '@/lib/portfolio';
import type { Portfolio } from '@/lib/types';
import type { ViewState } from '@/lib/view-state';
import { ChainLogo, ChainPile } from './logo';
import { AskAiMenu } from './ask-ai-menu';
import { CompareMenu } from './compare-menu';
import { SectionsMenu } from './sections-menu';
import { ShareDialog } from './share-dialog';
import type { Story } from '@/lib/story';

export function TopBar({ portfolio, story, view, others, onViewChange }: {
  portfolio: Portfolio; story: Story | null; view: ViewState; others: Others | null; onViewChange: (next: ViewState) => void;
}) {
  const [openMenu, setOpenMenu] = useState<'sections' | 'ask' | 'compare' | null>(null);
  const pathname = usePathname();
  const [sharing, setSharing] = useState(false);
  const sectionsButton = useRef<HTMLButtonElement>(null);
  const askButton = useRef<HTMLButtonElement>(null);
  const compareButton = useRef<HTMLButtonElement>(null);
  const shareButton = useRef<HTMLButtonElement>(null);

  // Esc closes an open menu first, then clears the filter; while sharing, the native dialog handles it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || sharing) return;
      if (openMenu) {
        setOpenMenu(null);
        ({ sections: sectionsButton, ask: askButton, compare: compareButton })[openMenu].current?.focus();
      } else if (view.chain) {
        onViewChange({ ...view, chain: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openMenu, sharing, view, onViewChange]);

  const closeShare = useCallback(() => {
    setSharing(false);
    shareButton.current?.focus();
  }, []);

  const chain = view.chain && view.chain !== 'other' ? portfolio.chains.find((c) => c.id === view.chain) : undefined;
  const selected = view.chain === 'other' && others
    ? { name: `Other ${others.chains.length} chains`, value: others.value, share: others.share, logo: <ChainPile chains={others.chains} /> }
    : chain ? { ...chain, logo: <ChainLogo src={chain.logoUrl} name={chain.name} /> } : null;

  // Wallet identity: the same name tag as the total area (a size smaller in the bar), or the short address without a name. It appears after scrolling past the total, filtered or not.
  const identity = portfolio.name
    ? <span className="ens-name wallet-id" title={portfolio.name}>{portfolio.name}</span>
    : <span className="quiet wallet-id">{shortAddress(portfolio.address)}</span>;

  return (
    <header className="top">
      <Brand compact />
      <span className="context summary">
        {identity}
        <span className="strong"><Money value={portfolio.total} /></span>
      </span>
      {selected && (
        <span className="context filter">
          {identity}
          {selected.logo}
          <span className="strong">{selected.name}</span>
          <span><Money value={selected.value} /></span>
          <span className="quiet">{selected.share.toFixed(1)}%</span>
          <button className="text-btn" onClick={() => onViewChange({ ...view, chain: null })}>All chains</button>
        </span>
      )}
      <div className="tools">
        <SectionsMenu view={view} onViewChange={onViewChange} open={openMenu === 'sections'} onOpenChange={(open) => setOpenMenu(open ? 'sections' : null)} buttonRef={sectionsButton} />
        <AskAiMenu open={openMenu === 'ask'} onOpenChange={(open) => setOpenMenu(open ? 'ask' : null)} buttonRef={askButton} />
        <CompareMenu wallet={pathname.slice(1)} name={portfolio.name} card={view.card} open={openMenu === 'compare'} onOpenChange={(open) => setOpenMenu(open ? 'compare' : null)} buttonRef={compareButton} />
        <button ref={shareButton} className="primary" aria-haspopup="dialog" onClick={() => setSharing(true)}>Share</button>
      </div>
      {sharing && (
        <ShareDialog label={walletLabel(portfolio)} total={chain?.value ?? portfolio.total} scope={chain ?? null} chainCount={portfolio.chains.length} story={story} view={view} onViewChange={onViewChange} onClose={closeShare} />
      )}
    </header>
  );
}
