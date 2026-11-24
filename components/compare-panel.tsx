'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { walletSegment } from '@/lib/address';
import { pickWhale } from '@/lib/famous-wallets';
import { PendingBar } from './pending-bar';

// Picks the wallet to compare against, by address or name, or a well-known wallet at random so a first comparison takes one tap.
export function ComparePanel({ wallet, query, exclude }: { wallet: string; query: string; exclude: (string | null)[] }) {
  const router = useRouter();
  const [invalid, setInvalid] = useState(false);
  const [pending, startTransition] = useTransition();
  const go = (other: string) => startTransition(() => router.push(`/${wallet}/vs/${other}${query}`));
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const other = walletSegment(String(new FormData(e.currentTarget).get('other')));
    if (other) go(other);
    else setInvalid(true);
  };
  return (
    <section className="compare-panel" aria-label="Compare with another wallet" aria-busy={pending}>
      <h2>Compare with <button type="button" aria-label="Compare with a whale" disabled={pending} onClick={() => go(pickWhale(exclude, Math.random()))}>a whale</button></h2>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <input name="other" type="text" aria-label="Address or ENS name" aria-invalid={invalid} placeholder="Address or ENS name" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={() => setInvalid(false)} />
          <button className="go" disabled={pending}>Go<PendingBar active={pending} /></button>
        </div>
        {invalid && <p className="field-note field-error" role="alert">Enter an EVM address or ENS name.</p>}
      </form>
    </section>
  );
}
