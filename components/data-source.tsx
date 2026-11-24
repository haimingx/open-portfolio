'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { DOCS, ENDPOINTS, SITE, TABLE_PATH, type Row } from '@/lib/data-sources';
import { CopyButton } from './copy-button';

// With all chains in view the table name shows {chain} and links to eth; with one chain selected it shows the real table name.
export function DataSource({ rows, chain, scope, curl }: { rows: Row[]; chain: string | null; scope: string[] | null; curl: string }) {
  const [open, setOpen] = useState(false);
  // Wallet panels link to /coverage, which explains the chains, tokens and protocols a total includes; /coverage does not link to itself.
  const onCoverage = usePathname() === '/coverage';
  const target = (table: string) => table.replace('{chain}', chain ?? 'eth');
  return (
    <>
      <button className="quiet-btn" aria-expanded={open} onClick={() => setOpen(!open)}>Data source</button>
      {open && (
        <div className="source">
          <table className="source-table">
            <thead><tr><th scope="col">Reads</th><th scope="col">Endpoint</th><th scope="col">Source</th></tr></thead>
            <tbody>
              {rows.map(([label, endpoint, table, type = 'normal']) => {
                const [method, path, anchor] = ENDPOINTS[endpoint];
                const linked = table.includes('.') && !table.includes(' ');
                return (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="code"><a href={`${DOCS}#${anchor}`}>{method} {path}</a></td>
                    <td className="code">{linked ? <a href={`${SITE}/${TABLE_PATH[type]}/${target(table)}`}>{table}</a> : table}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {scope && scope.length > 0 && (
            <p className="source-scope"><code>{'{chain}'}</code> is one of {scope.map((id, i) => <span key={id}>{i ? ', ' : ''}<code>{id}</code></span>)}</p>
          )}
          <a className="source-link" href={DOCS}>API reference</a>
          <CopyButton className="source-link" text={curl} label="Copy as curl" />
          {!onCoverage && <Link className="source-link" href="/coverage">Coverage</Link>}
        </div>
      )}
    </>
  );
}
