'use client';

import { useState } from 'react';

// Native lazy-loaded img; a missing or failed image shows an initial instead of a gap.
export function Logo({ src, label, className = 'logo', size = 24 }: { src: string | null; label: string; className?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className={`${className} monogram`} style={{ width: size, height: size }} aria-hidden="true">{label.slice(0, 1).toUpperCase()}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- third-party logos are small and many, so they skip Next image optimization
  return <img className={className} src={src} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

export function ChainLogo({ src, name }: { src: string | null; name: string }) {
  return <Logo src={src} label={name} className="chain-logo" size={20} />;
}

export function ChainPile({ chains }: { chains: { id: string; name: string; logoUrl: string | null }[] }) {
  return (
    <span className="chain-pile" aria-hidden="true">
      {chains.map((c) => <ChainLogo key={c.id} src={c.logoUrl} name={c.name} />)}
    </span>
  );
}
