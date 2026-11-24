'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type FormEvent, type MouseEvent } from 'react';
import { walletSegment } from '@/lib/address';
import { FAMOUS_WALLETS, pickFamousWallet } from '@/lib/famous-wallets';
import { PendingBar } from './pending-bar';

export function AddressForm({ children, prefillFromPath }: { children: React.ReactNode; prefillFromPath?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [invalid, setInvalid] = useState(false);
  // Navigation runs in a transition so the clicked button or link shows a progress bar until the server responds.
  const [pending, startTransition] = useTransition();
  const [via, setVia] = useState<'submit' | 'peek'>('submit');
  const go = (path: string, from: 'submit' | 'peek') => {
    setVia(from);
    startTransition(() => router.push(path));
  };
  // The invalid address page puts the input back into the field for a quick fix; only the value changes, not the layout.
  useEffect(() => {
    if (!prefillFromPath || !input.current) return;
    const raw = window.location.pathname.slice(1);
    try {
      input.current.value = decodeURIComponent(raw);
    } catch {
      input.current.value = raw;
    }
  }, [prefillFromPath]);
  // Validate on submit and show errors in place without navigating.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = (input.current?.value ?? '').trim();
    const segment = walletSegment(value);
    if (segment) return go(`/${segment}`, 'submit');
    setInvalid(true);
    input.current?.focus();
  };
  // The link points to the first wallet so it works before scripts load; a click picks one at random.
  const openRandom = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(`/${pickFamousWallet(Math.random()).address}`, 'peek');
  };
  return (
    <form onSubmit={submit} noValidate>
      {children}
      <label htmlFor="address">Address or ENS name</label>
      <div className="field">
        <input ref={input} id="address" type="text" placeholder="0x… or name.eth" spellCheck={false} autoComplete="off"
          aria-invalid={invalid || undefined} aria-describedby={invalid ? 'address-error' : undefined} onChange={() => invalid && setInvalid(false)} />
        <button className="go" type="submit" aria-busy={(pending && via === 'submit') || undefined}>
          View wallet<PendingBar active={pending && via === 'submit'} />
        </button>
      </div>
      {/* The error and the sample link share one fixed-height row, so a validation error does not shift the layout. */}
      <div className="field-note">
        {invalid
          ? <p className="field-error" id="address-error" role="alert">Enter a 0x address or an ENS name such as vitalik.eth.</p>
          : <a className="sample" href={`/${FAMOUS_WALLETS[0].address}`} onClick={openRandom}>
              Peek at a whale<PendingBar active={pending && via === 'peek'} />
            </a>}
      </div>
    </form>
  );
}
