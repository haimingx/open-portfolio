import Link from 'next/link';

// compact gives up the visible name on the narrowest phones, where a top bar with actions cannot fit it on one row.
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`mark${compact ? ' compact' : ''}`} href="/">
      {/* eslint-disable-next-line @next/next/no-img-element -- an 18px SVG has nothing to optimize */}
      <img src="/icon.svg" alt="" width={18} height={18} />
      <span className="mark-text">Open Portfolio</span>
    </Link>
  );
}
