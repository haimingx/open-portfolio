'use client';

import { useEffect, useState } from 'react';
import type { HistoryPoint } from './types';

// The curve is decoration: a failed or empty read draws nothing, so there is no error state to show.
export function useHistory(address: string): HistoryPoint[] | null {
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/${address}/history.json`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { points: HistoryPoint[] } | null) => setPoints(body?.points ?? null))
      .catch(() => {});
    return () => controller.abort();
  }, [address]);
  return points;
}
