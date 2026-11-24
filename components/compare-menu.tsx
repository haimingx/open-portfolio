'use client';

import { useRef, type RefObject } from 'react';
import { useOutsidePress } from '@/lib/use-outside-press';
import { DEFAULT_CARD, type CardStyle } from '@/lib/view-state';
import { ComparePanel } from './compare-panel';

export function CompareMenu({ wallet, name, card, open, onOpenChange, buttonRef }: {
  wallet: string; name: string | null; card: CardStyle; open: boolean; onOpenChange: (open: boolean) => void; buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useOutsidePress(menu, open, () => onOpenChange(false));
  return (
    <div className="menu" ref={menu}>
      <button ref={buttonRef} className="text-btn" aria-haspopup="true" aria-expanded={open} aria-label="Compare with another wallet" title="Compare with another wallet" onClick={() => onOpenChange(!open)}>VS</button>
      {open && <div className="popover compare-popover"><ComparePanel wallet={wallet} query={card === DEFAULT_CARD ? '' : `?card=${card}`} exclude={[name]} /></div>}
    </div>
  );
}
