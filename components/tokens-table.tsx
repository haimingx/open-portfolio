'use client';

import { Fragment, useState } from 'react';
import { formatAmount, formatShare, shortAddress } from '@/lib/format';
import { groupTokens, previewList, type TokenGroup } from '@/lib/portfolio';
import { useToggleSet } from '@/lib/use-toggle-set';
import { Amount } from './amount';
import { Caret } from './caret';
import { Money } from './money';
import { Price, Unpriced } from './price';
import type { TokenHolding } from '@/lib/types';
import { SOURCE_ROWS } from '@/lib/data-sources';
import { DataSource } from './data-source';
import { Logo } from './logo';
import { Rail } from './rail';

function HoldingRows({ group, chainName, chainLogo }: { group: TokenGroup; chainName: (id: string) => string; chainLogo: (id: string) => string | null }) {
  const onChain = (chain: string) => group.holdings.filter((h) => h.chain === chain).length;
  return (
    <div className="ledger">
      <div className="ledger-group">
        {group.holdings.map((h) => (
          <div className="ledger-row" key={`${h.chain}:${h.tokenId}`}>
            {/* Two contracts of one asset on a chain (native and bridged USDC) are told apart by address */}
            <span className="asset"><Logo src={chainLogo(h.chain)} label={chainName(h.chain)} /><span>{chainName(h.chain)}{onChain(h.chain) > 1 ? ` · ${shortAddress(h.tokenId)}` : ''}</span></span>
            <span className="quiet"><Amount value={h.amount} /></span>
            <span className="quiet hide-phone"><Price value={h.price} /></span>
            <span className="strong"><Money value={h.value} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TokensTable({ tokens, total, chainName, chainLogo, curl, sourceChain, scope, merge }: {
  tokens: TokenHolding[]; total: number; chainName: (id: string) => string; chainLogo: (id: string) => string | null; curl: string; sourceChain: string | null; scope: string[] | null; merge: boolean;
}) {
  const [all, setAll] = useState(false);
  const [open, toggle] = useToggleSet();
  const groups = groupTokens(tokens, merge);
  const { visible, expandable } = previewList(groups, all);
  return (
    <section className="block" aria-label="Tokens">
      <Rail title="Tokens" value={tokens.reduce((s, t) => s + t.value, 0)} total={total} />
      <div>
        <table>
          <colgroup><col /><col className="c-detail" /><col className="c-price" /><col className="c-value" /><col className="c-share" /></colgroup>
          <thead><tr><th scope="col">Token</th><th scope="col" className="hide-phone">Amount</th><th scope="col" className="hide-phone">Price</th><th scope="col">Value</th><th scope="col" className="hide-phone">Share</th></tr></thead>
          <tbody>
            {visible.map((g) => {
              const merged = g.holdings.length > 1;
              const expanded = open.has(g.key);
              const logo = <span className="logos"><Logo src={g.logoUrl} label={g.symbol} /></span>;
              return (
                <Fragment key={g.key}>
                  <tr>
                    <td>
                      {merged ? (
                        <button className="position token-group" aria-expanded={expanded} onClick={() => toggle(g.key)}>
                          <span className="asset">{logo}<span className="text"><span className="title"><span className="strong">{g.symbol}</span><Caret /></span><span className="sub">{new Set(g.holdings.map((h) => h.chain)).size} chains</span></span></span>
                        </button>
                      ) : (
                        <span className="asset">{logo}<span className="text"><span className="strong">{g.symbol}</span><span className="sub">{chainName(g.holdings[0].chain)}</span></span></span>
                      )}
                    </td>
                    <td className="hide-phone">{formatAmount(g.amount)}</td>
                    {/* Amount × price = value, so an odd price stands out here */}
                    <td className="hide-phone"><Price value={g.price} /></td>
                    <td className="strong">{g.price === null ? <Unpriced /> : <Money value={g.value} />}</td>
                    <td className="quiet hide-phone">{g.price === null ? <Unpriced /> : formatShare(g.value, total)}</td>
                  </tr>
                  {merged && expanded && <tr className="position-detail"><td colSpan={5}><HoldingRows group={g} chainName={chainName} chainLogo={chainLogo} /></td></tr>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {(expandable || groups.length === 0) && (
          <div className="more">
            {expandable && <button className="text-btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${groups.length} tokens`}</button>}
            {groups.length === 0 && <span className="sub" style={{ padding: '11px 0' }}>No tokens on these chains.</span>}
          </div>
        )}
        <DataSource rows={SOURCE_ROWS.tokens(sourceChain ?? '{chain}')} chain={sourceChain} scope={scope} curl={curl} />
      </div>
    </section>
  );
}
