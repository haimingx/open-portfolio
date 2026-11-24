'use client';

import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/lib/copy-text';
import { shortAddress } from '@/lib/format';
import { CheckIcon } from './icons';

export function CopyAddress({ address, name }: { address: string; name: string | null }) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    const ok = await copyText(address);
    setStatus(ok ? 'Address copied' : 'The address could not be copied');
    if (!ok) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  // The name is the wallet's identity and stands alone; the copy button wraps only the address, so clicking the name copies nothing.
  return (
    <div className="identity">
      {name && <span className="ens-name" title={name}>{name}</span>}
      <button className={`addr${copied ? ' copied' : ''}`} onClick={copy} title={address} aria-label={`Copy address ${shortAddress(address)}`}>
        {shortAddress(address)}
        <svg className="icon-copy" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="4.5" y="4.5" width="8" height="8" /><path d="M9.5 2H1.8v7.7" /></svg>
        <CheckIcon className="icon-check" />
      </button>
      <span className="sr-status" role="status">{status}</span>
    </div>
  );
}
