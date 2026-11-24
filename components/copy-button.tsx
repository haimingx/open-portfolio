'use client';

import type { ReactNode } from 'react';
import { copyText } from '@/lib/copy-text';
import { useCopied } from '@/lib/use-copied';

export function CopyButton({ text, label, className, icon }: { text: string; label: string; className: string; icon?: ReactNode }) {
  const [copied, markCopied] = useCopied();
  return (
    <button className={className} onClick={async (e) => { if (await copyText(text, e.currentTarget.parentElement ?? undefined)) markCopied(); }}>
      {icon}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}
