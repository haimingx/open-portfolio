'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { curve, nearest, plot, X, Y } from '@/lib/curve';
import { formatMoney, formatStamp } from '@/lib/format';
import { useHistory } from '@/lib/use-history';

const shift = (value: number, from: number) => `${value >= from ? '+' : '−'}${Math.abs((value / from - 1) * 100).toFixed(1)}%`;
// The label keeps this much room at each end of the box, so it never runs off the card; it flips below a point that sits in
// the upper half, where there is no room above it.
const LABEL_MARGIN = 92;
const FLIP_BELOW = 55;

// The seven-day trend drawn behind the total and the lines that explain it. Pointing at the block reads out one mark: the
// line itself is decoration, so assistive technology gets the trend in words instead of the figure.
export function ValueCurve({ address, name, mirror = false }: { address: string; name: string | null; mirror?: boolean }) {
  const points = useHistory(address);
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const plotted = useMemo(() => (points ? plot(points, mirror) : []), [points, mirror]);
  const drawn = curve(plotted);
  const priced = (points ?? []).filter((p): p is { time: string; value: number } => p.value !== null);
  const pointAt = active !== null ? points?.[active] : null;
  const spot = active !== null ? plotted[active] ?? null : null;

  // The text sits above the curve, so the block around it listens; the curve keeps pointer-events off so the text stays
  // selectable. A mouse keeps the reading until it leaves, a touch only while it is down.
  useEffect(() => {
    // The wrapper can be pointer-events: none (the comparison page), so listening climbs to the nearest element that takes
    // the pointer; the x fraction always comes from the curve's own box, which is the width the shape is drawn in.
    let host = box.current?.parentElement ?? null;
    while (host && getComputedStyle(host).pointerEvents === 'none') host = host.parentElement;
    if (!host || !plotted.length) return;
    let shown: number | null = null;
    const read = (index: number | null) => {
      if (index === shown) return;
      shown = index;
      setActive(index);
    };
    const pick = (event: PointerEvent) => {
      const rect = box.current?.getBoundingClientRect();
      if (!rect?.width) return;
      read(nearest(plotted, Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))));
    };
    const clear = () => read(null);
    const lift = (event: PointerEvent) => { if (event.pointerType !== 'mouse') clear(); };
    host.addEventListener('pointermove', pick);
    host.addEventListener('pointerdown', pick);
    host.addEventListener('pointerup', lift);
    host.addEventListener('pointercancel', clear);
    host.addEventListener('pointerleave', clear);
    return () => {
      host.removeEventListener('pointermove', pick);
      host.removeEventListener('pointerdown', pick);
      host.removeEventListener('pointerup', lift);
      host.removeEventListener('pointercancel', clear);
      host.removeEventListener('pointerleave', clear);
    };
  }, [plotted]);

  return (
    <>
      <div className={`value-curve${mirror ? ' mirror' : ''}`} ref={box}>
        {drawn.length > 0 && (
          // The plate mounts with the values, so the reveal starts then, not when the empty box first appeared.
          <div className="value-curve-plate">
            <svg viewBox={`0 0 ${X} ${Y}`} preserveAspectRatio="none" aria-hidden="true">
              {drawn.map(({ line, area }) => (
                <g key={line}>
                  <path className="value-curve-fill" d={area} />
                  <path className="value-curve-line" d={line} vectorEffect="non-scaling-stroke" />
                </g>
              ))}
            </svg>
          </div>
        )}
      </div>
      {/* The reading is its own layer, above the text the curve runs behind. */}
      {pointAt?.value != null && spot && (
        <span className="value-curve-reading" aria-hidden="true">
          <span className="value-curve-guide" style={{ left: `${spot.x}%` }} />
          <span className="value-curve-dot" style={{ left: `${spot.x}%`, top: `${spot.y}%` }} />
          <span className={`value-curve-label${spot.y < FLIP_BELOW ? ' below' : ''}`} style={{ left: `clamp(${LABEL_MARGIN}px, ${spot.x}%, calc(100% - ${LABEL_MARGIN}px))`, top: `${spot.y}%` }}>
            <span className="value-curve-time">{formatStamp(Date.parse(pointAt.time))}</span>
            <span className="value-curve-amounts">
              <span className="value-curve-value">{formatMoney(pointAt.value)}</span>
              {priced.length > 1 && <span className="value-curve-change">{shift(pointAt.value, priced[0].value)}</span>}
            </span>
          </span>
        </span>
      )}
      {priced.length > 1 && (
        <span className="sr-status">
          {`${name ?? address} was worth ${formatMoney(priced[0].value)} seven days ago and ${formatMoney(priced.at(-1)!.value)} at the last four-hour mark.`}
        </span>
      )}
    </>
  );
}
