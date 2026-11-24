'use client';
import { recordWalletView } from '@/app/[address]/record-view';

import { useEffect } from 'react';

// Reported by the browser: crawlers and link previews do not run scripts, so they never count toward heat.
export function ViewBeacon({ address }: { address: string }) {
  useEffect(() => {
    void recordWalletView(address);
  }, [address]);
  return null;
}
