'use client';

import { useLinkStatus } from 'next/link';

// A thin progress bar under an element while navigating, so a click never looks ignored before the server responds.
export function PendingBar({ active }: { active: boolean }) {
  return <span className="pending-bar" data-active={active || undefined} aria-hidden="true" />;
}

// Placed inside a <Link> to read that navigation's status.
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <PendingBar active={pending} />;
}
