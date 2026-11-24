import type { CSSProperties } from 'react';

// Five bars from low to high show relative heat, never visit counts.
export function HeatMeter({ level, label = true }: { level: number; label?: boolean }) {
  return (
    <span className="heat" {...(label ? { role: 'img', 'aria-label': `Heat ${level} of 5` } : { 'aria-hidden': true })}>
      {[0, 1, 2, 3, 4].map((k) => <i key={k} className={k < level ? 'on' : undefined} style={{ '--k': k } as CSSProperties} />)}
    </span>
  );
}
