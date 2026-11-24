'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { columnWidth, countChains, formatAmount, formatDay, formatMoney, formatStamp, priceLabel } from '@/lib/format';
import { pageStyleCss } from '@/lib/page-style';
import { useScrolled } from '@/lib/use-scrolled';
import { groupTokens, splitLayers } from '@/lib/portfolio';
import type { Portfolio } from '@/lib/types';
import { parseView, serializeView, type ViewState } from '@/lib/view-state';
import { CopyAddress } from './copy-address';
import { Money } from './money';
import { CURL } from '@/lib/curl';
import { SOURCE_ROWS } from '@/lib/data-sources';
import { DataSource } from './data-source';
import { Layers, StoryLayers } from './layers';
import { CardContentTabs } from './card-content-tabs';
import { storyData } from '@/lib/story';
import { PositionsTable } from './positions-table';
import { Credits } from './credit-links';
import { TokensTable } from './tokens-table';
import { TopBar } from './top-bar';
import { ValueCurve } from './value-curve';

export function WalletView({ portfolio, heat }: { portfolio: Portfolio; heat?: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const chainIds = useMemo(() => portfolio.chains.map((c) => c.id), [portfolio.chains]);
  const view = parseView(new URLSearchParams(params.toString()), chainIds);
  // The layers stack in only once, on first entry.
  const [entering, setEntering] = useState(true);
  // After scrolling past the total, the top bar shows the wallet and its total.
  const scrolled = useScrolled();
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // View changes only rewrite the URL without navigating, so a shared link always carries the current view.
  const update = useCallback((next: ViewState) => window.history.replaceState(null, '', `${pathname}${serializeView(next)}`), [pathname]);
  const select = (chain: string) => update({ ...view, chain: view.chain === chain ? null : chain });

  const { layers, others } = splitLayers(portfolio.chains);
  const folded = others?.chains.map((c) => c.id) ?? [];
  const inChain = (chain: string) => !view.chain || (view.chain === 'other' ? folded.includes(chain) : chain === view.chain);
  const chainName = (id: string) => portfolio.chains.find((c) => c.id === id)?.name ?? id;
  const chainLogo = (id: string) => portfolio.chains.find((c) => c.id === id)?.logoUrl ?? null;
  const sourceChain = view.chain && view.chain !== 'other' ? view.chain : null;
  const scope = sourceChain ? null : view.chain === 'other' ? folded : chainIds;
  const shown = (id: 'chains' | 'tokens' | 'positions') => !view.hidden.includes(id);
  const empty = portfolio.tokens.length === 0 && portfolio.positions.length === 0;
  // Sections only decides whether the layers are on screen; what the page tells is a separate choice.
  const storyAvailable = useMemo(() => (empty ? null : storyData(portfolio)), [empty, portfolio]);
  const story = view.story ? storyAvailable : null;
  const holdingsNote = `Tokens and positions${portfolio.debt > 0 ? `, net of ${formatMoney(portfolio.debt)} debt,` : ''} across ${countChains(portfolio.chains.length)}.`;
  // Value and amount columns widen to the longest value on the page, so very large values never press into the share column.
  const columns = useMemo(() => {
    const assets = portfolio.positions.flatMap((p) => [...p.supplied, ...p.borrowed, ...p.rewards]);
    // Merged rows add up amounts and values, so they can be the longest on the page.
    const groups = groupTokens(portfolio.tokens, true);
    const priced = [...portfolio.tokens, ...groups, ...assets].flatMap((t) => (t.price === null ? [] : [t.price]));
    return {
      '--col-value': columnWidth([...portfolio.chains.map((c) => c.value), ...portfolio.tokens.map((t) => t.value), ...groups.map((g) => g.value), ...assets.map((a) => a.value), ...portfolio.positions.map((p) => p.net)].map(formatMoney), 112),
      '--col-detail': columnWidth([...portfolio.tokens, ...groups, ...assets].map((t) => formatAmount(t.amount)), 176),
      // The subscript form is shorter, so the column fits the text actually shown.
      '--col-price': columnWidth(priced.map(priceLabel), 112)
    } as CSSProperties;
  }, [portfolio]);
  const tokens = portfolio.tokens.filter((t) => inChain(t.chain));
  const positions = portfolio.positions.filter((p) => inChain(p.chain));

  return (
    <div className={[view.chain && 'has-filter', scrolled && 'scrolled'].filter(Boolean).join(' ') || undefined} style={columns}>
      <style>{pageStyleCss(view.card)}</style>
      <TopBar portfolio={portfolio} story={storyAvailable} view={view} others={others} onViewChange={update} />
      <div className="stage">
        <section className="lead">
          <div className="lead-top">
            <CopyAddress address={portfolio.address} name={portfolio.name} />
            {storyAvailable && <CardContentTabs view={view} onViewChange={update} />}
          </div>
          {/* The total and the lines that explain it: the seven-day trend runs behind this whole block. */}
          <div className="lead-body">
            {!empty && <ValueCurve address={portfolio.address} name={portfolio.name} />}
            <h1 className="num">{story ? story.age : <Money value={portfolio.total} />}</h1>
            {heat}
            {!empty && <p className="note" suppressHydrationWarning>
              {story
                ? <span className="note-text"><span>On-chain since {formatDay(story.since)}<span className="hide-phone"> across {countChains(story.chains)}</span>.</span><span className="note-ghost">{holdingsNote}</span></span>
                : holdingsNote}{' '}
              {/* Page HTML is cached and a relative time would go stale, so write the absolute time, as on the share card. "As of" wraps together with the time. */}
              <span className="stamp">As of <time dateTime={new Date(portfolio.generatedAt).toISOString()}>{formatStamp(portfolio.generatedAt)}</time>.</span>
            </p>}
            {portfolio.failedChains.length > 0 && (
              <p className="note">{portfolio.failedChains.map((c) => c.name).join(', ')} could not be read, so this total leaves it out. Try again in a minute.</p>
            )}
          </div>
        </section>
        {empty && (
          <section className="state">
            <h3>No assets found on any supported chain</h3>
            <p>This address has no counted tokens or positions. New activity can take a minute to appear.</p>
          </section>
        )}
        {!empty && shown('chains') && (
          <div className={`layer-frame${story ? ' story' : ''}`}>
            {story && <StoryLayers story={story} card={view.card} entering={entering} />}
            <div className="chain-layers">
              <Layers layers={layers} others={others} selected={view.chain} card={view.card} entering={entering} onSelect={select} />
            </div>
          </div>
        )}
      </div>
      {!empty && shown('chains') && (
        <div className="chains-source"><DataSource rows={SOURCE_ROWS.chains()} chain={null} scope={null} curl={CURL.chains(portfolio.address)} /></div>
      )}
      {!empty && (shown('tokens') || shown('positions')) && (
        <div className="sheet">
          {shown('tokens') && (
            <TokensTable tokens={tokens} total={portfolio.total} chainName={chainName} chainLogo={chainLogo} curl={CURL.tokens(portfolio.address)} sourceChain={sourceChain} scope={scope} merge={!view.chain} />
          )}
          {shown('positions') && (
            <PositionsTable positions={positions} total={portfolio.total} chainName={chainName} curl={CURL.positions(portfolio.address, sourceChain ?? 'eth')} sourceChain={sourceChain} scope={scope} />
          )}
        </div>
      )}
      <footer>
        <p>Values are estimates from public on-chain data, not financial advice.</p>
        <p><Credits /></p>
      </footer>
    </div>
  );
}
