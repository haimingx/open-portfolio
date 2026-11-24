'use client';

import { Fragment, useState } from 'react';
import { formatShare } from '@/lib/format';
import { healthLevel, previewList } from '@/lib/portfolio';
import { useToggleSet } from '@/lib/use-toggle-set';
import { Amount } from './amount';
import { Caret } from './caret';
import { Money } from './money';
import { Price, Unpriced } from './price';
import type { Position, PositionAsset } from '@/lib/types';
import { SOURCE_ROWS } from '@/lib/data-sources';
import { DataSource } from './data-source';
import { Logo } from './logo';
import { Rail } from './rail';

function AssetRows({ title, rows }: { title: string; rows: PositionAsset[] }) {
  if (!rows.length) return null;
  return (
    <div className="ledger-group">
      {/* Each group's title row doubles as column headings, right above the numbers */}
      <div className="ledger-row ledger-head">
        <h3>{title}</h3>
        <span>Amount</span>
        <span className="hide-phone">Price</span>
        <span>Value</span>
      </div>
      {rows.map((a, i) => (
        <div className="ledger-row" key={`${a.tokenId}:${i}`}>
          <span className="asset"><Logo src={a.logoUrl} label={a.symbol} /><span>{a.symbol}</span></span>
          <span className="quiet"><Amount value={a.amount} /></span>
          <span className="quiet hide-phone"><Price value={a.price} /></span>
          <span className="strong">{a.price === null ? <Unpriced /> : <Money value={a.value} />}</span>
        </div>
      ))}
    </div>
  );
}

export function PositionsTable({ positions, total, chainName, curl, sourceChain, scope }: {
  positions: Position[]; total: number; chainName: (id: string) => string; curl: string; sourceChain: string | null; scope: string[] | null;
}) {
  const [open, toggle] = useToggleSet();
  const [all, setAll] = useState(false);
  const { visible, expandable } = previewList(positions, all);
  return (
    <section className="block" aria-label="Positions">
      <Rail title="Positions" value={positions.reduce((s, p) => s + p.net, 0)} total={total} />
      <div>
        {positions.length ? (
          <table>
            {/* A position's Value is its net value; amounts and prices appear only in the expanded details, with headings in each group's title row */}
            <colgroup><col /><col className="c-value" /><col className="c-share" /></colgroup>
            <thead><tr><th scope="col">Position</th><th scope="col">Value</th><th scope="col" className="hide-phone">Share</th></tr></thead>
            <tbody>
              {visible.map((p) => {
                const key = `${p.chain}:${p.poolId}`;
                const expanded = open.has(key);
                return (
                  <Fragment key={key}>
                    <tr>
                      <td>
                        <button className="position" aria-expanded={expanded} onClick={() => toggle(key)}>
                          <span className="asset">
                            <Logo src={p.protocolLogoUrl} label={p.protocol} />
                            <span className="text">
                              <span className="title"><span className="strong">{p.protocol}</span><Caret /></span>
                              <span className="sub">{p.kind}{p.assets.length ? `, ${p.assets.join(' and ')}` : ''} on {chainName(p.chain)}</span>
                              {/* Debt and health factor describe the same thing, so they share a line that shows without expanding */}
                              {p.debt > 0 && <span className="sub">Borrowed <Money value={p.debt} />{p.health !== null && <> · <span className={`health ${healthLevel(p.health) ?? ''}`}>Health factor {p.health.toFixed(2)}</span></>}</span>}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="strong"><Money value={p.net} /></td>
                      <td className="quiet hide-phone">{formatShare(p.net, total)}</td>
                    </tr>
                    {expanded && (
                      <tr className="position-detail">
                        <td colSpan={3}>
                          <div className="ledger">
                            <AssetRows title="Supplied" rows={p.supplied} />
                            <AssetRows title="Borrowed" rows={p.borrowed} />
                            <AssetRows title="Rewards" rows={p.rewards} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : <p className="omitted" style={{ borderTop: 0, paddingTop: 0 }}>No positions on these chains.</p>}
        {expandable && (
          <div className="more">
            <button className="text-btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${positions.length} positions`}</button>
          </div>
        )}
        <DataSource rows={SOURCE_ROWS.positions(sourceChain ?? '{chain}')} chain={sourceChain} scope={scope} curl={curl} />
      </div>
    </section>
  );
}
